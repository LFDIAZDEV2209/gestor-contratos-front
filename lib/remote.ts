// Capa de integración remota (hidratación + cola write-through)
// Implementa exactamente la sección 2.3 y 2.4 de CONEXION_API.md

import type {
  DB,
  Contract,
  Company,
  User,
  Subcontract,
  Obligation,
  Deliverable,
  Exec,
  Payment,
  Acta,
  Modification,
  Risk,
  Breach,
  Plan,
  Guarantee,
  Cupo,
  Document,
  Task,
  AuditEntry,
  AlertState,
  Settings
} from './types';
import { api, ApiCallError, getStoredToken } from './api';
import { Store } from './store';
import { defaultPerms, defaultCatalogs } from './catalog';
import { nowStamp, todayIso } from './format';

const QUEUE_STORAGE_KEY = 'ss_write_queue_v1';

export const COL_API_MAP: Record<string, string> = {
  users: 'users',
  companies: 'companies',
  contracts: 'contracts',
  subcontracts: 'subcontracts',
  obligations: 'obligations',
  deliverables: 'deliverables',
  execs: 'execs',
  payments: 'payments',
  actas: 'actas',
  modifications: 'modifications',
  risks: 'risks',
  breaches: 'breaches',
  plans: 'plans',
  guarantees: 'guarantees',
  cupos: 'quotas',
  documents: 'documents',
  tasks: 'tasks',
  audit: 'audit',
  alerts: 'alerts',
};

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncInfo {
  status: SyncStatus;
  retryCount: number;
  maxRetries: number;
  nextRetryMs: number | null;
  lastSyncedAt: Date | null;
  error: string | null;
}

const MAX_RETRIES = 3;
const BACKOFF_MS = [1000, 2000, 4000]; // 1s, 2s, 4s

let currentSyncInfo: SyncInfo = {
  status: 'idle',
  retryCount: 0,
  maxRetries: MAX_RETRIES,
  nextRetryMs: null,
  lastSyncedAt: null,
  error: null,
};

type SyncListener = (info: SyncInfo) => void;
const syncListeners = new Set<SyncListener>();

function notifySyncListeners() {
  syncListeners.forEach((fn) => {
    try {
      fn({ ...currentSyncInfo });
    } catch {}
  });
}

export function getSyncInfo(): SyncInfo {
  return { ...currentSyncInfo };
}

export function subscribeSyncInfo(listener: SyncListener): () => void {
  syncListeners.add(listener);
  listener({ ...currentSyncInfo });
  return () => {
    syncListeners.delete(listener);
  };
}

let inFlightHydration: Promise<DB | null> | null = null;
let retryTimeoutId: any = null;

/** Mapea claves canónicas del servidor (GET /alerts) a claves del cliente (Alerts.compute) */
export function serverKeyToClientKeys(serverKey: string): string[] {
  const parts = serverKey.split('|');
  const [prefix, id, extra] = parts;

  // 1. Contrato por vencer: contrato|ID|umbral -> venc|ID|umbral
  if (prefix === 'contrato' && extra && /^\d+$/.test(extra)) {
    return [`venc|${id}|${extra}`];
  }
  // 2. Contrato vencido: contrato|ID|v -> vencido|ID
  if (prefix === 'contrato' && extra === 'v') {
    return [`vencido|${id}`];
  }
  // 3. Garantía vencida: gar|ID|v -> garv|ID
  if (prefix === 'gar' && extra === 'v') {
    return [`garv|${id}`];
  }
  // 4. Garantía por vencer: gar|ID|umbral -> idéntica
  if (prefix === 'gar' && extra && /^\d+$/.test(extra)) {
    return [serverKey];
  }
  // 5. Obligación vencida o incumplida: obl|ID|v u obl|ID|i -> obl|ID
  if (prefix === 'obl' && (extra === 'v' || extra === 'i')) {
    return [`obl|${id}`];
  }
  // 6. Entregable vencido: ent|ID|v -> ent|ID
  if (prefix === 'ent' && extra === 'v') {
    return [`ent|${id}`];
  }
  // 7. Pago pendiente: pag|ID|p -> pag|ID|Pendiente, pag|ID|En revisión
  if (prefix === 'pag' && extra === 'p') {
    return [`pag|${id}|Pendiente`, `pag|${id}|En revisión`];
  }
  // 8. Ejecución superior al 100%: ejec|ID|o -> ejec|ID
  if (prefix === 'ejec' && extra === 'o') {
    return [`ejec|${id}`];
  }
  // 9. Presupuesto próximo a agotarse: ejec|ID|s -> ppto|ID
  if (prefix === 'ejec' && extra === 's') {
    return [`ppto|${id}`];
  }
  // 10. Incumplimiento abierto: inc|ID|v -> inc|ID
  if (prefix === 'inc' && extra === 'v') {
    return [`inc|${id}`];
  }
  // 11. Cupo excedido: cupo|ID|o -> cupox|ID
  if (prefix === 'cupo' && extra === 'o') {
    return [`cupox|${id}`];
  }
  // 12. Cupo 85%: cupo|ID|85 -> cupo85|ID
  if (prefix === 'cupo' && extra === '85') {
    return [`cupo85|${id}`];
  }
  // 13. Cupo vencido: cupo|ID|v -> cupov|ID
  if (prefix === 'cupo' && extra === 'v') {
    return [`cupov|${id}`];
  }
  // 14. Cupo por vencer: cupo|ID|umbral -> cupod|ID|umbral
  if (prefix === 'cupo' && extra && /^\d+$/.test(extra)) {
    return [`cupod|${id}|${extra}`];
  }
  // 15. Documento faltante: doc|ID|categoria -> doc|ID|categoria
  if (prefix === 'doc') {
    return [serverKey, `doc|${id}`];
  }

  return [serverKey];
}

/** Mapea claves del cliente (Alerts.compute) a claves canónicas del servidor (GET /alerts) */
export function clientKeyToServerKey(clientKey: string): string {
  const parts = clientKey.split('|');
  const [prefix, id, extra] = parts;

  // 1. venc|ID|umbral -> contrato|ID|umbral
  if (prefix === 'venc' && extra && /^\d+$/.test(extra)) {
    return `contrato|${id}|${extra}`;
  }
  // 2. vencido|ID -> contrato|ID|v
  if (prefix === 'vencido' && id) {
    return `contrato|${id}|v`;
  }
  // 3. garv|ID -> gar|ID|v
  if (prefix === 'garv' && id) {
    return `gar|${id}|v`;
  }
  // 4. gar|ID|umbral -> gar|ID|umbral
  if (prefix === 'gar' && extra && /^\d+$/.test(extra)) {
    return clientKey;
  }
  // 5. obl|ID -> obl|ID|i si incumplida, sino obl|ID|v
  if (prefix === 'obl' && id) {
    const o = Store.get('obligations', id);
    if (o && o.estado === 'Incumplida') {
      return `obl|${id}|i`;
    }
    return `obl|${id}|v`;
  }
  // 6. ent|ID -> ent|ID|v
  if (prefix === 'ent' && id) {
    return `ent|${id}|v`;
  }
  // 7. pag|ID|estado -> pag|ID|p
  if (prefix === 'pag' && id) {
    return `pag|${id}|p`;
  }
  // 8. ejec|ID -> ejec|ID|o
  if (prefix === 'ejec' && id) {
    return `ejec|${id}|o`;
  }
  // 9. ppto|ID -> ejec|ID|s
  if (prefix === 'ppto' && id) {
    return `ejec|${id}|s`;
  }
  // 10. inc|ID -> inc|ID|v
  if (prefix === 'inc' && id) {
    return `inc|${id}|v`;
  }
  // 11. cupox|ID -> cupo|ID|o
  if (prefix === 'cupox' && id) {
    return `cupo|${id}|o`;
  }
  // 12. cupo85|ID -> cupo|ID|85
  if (prefix === 'cupo85' && id) {
    return `cupo|${id}|85`;
  }
  // 13. cupov|ID -> cupo|ID|v
  if (prefix === 'cupov' && id) {
    return `cupo|${id}|v`;
  }
  // 14. cupod|ID|umbral -> cupo|ID|umbral
  if (prefix === 'cupod' && extra && /^\d+$/.test(extra)) {
    return `cupo|${id}|${extra}`;
  }

  // Clave canónica del servidor ya establecida o no reconocida
  return clientKey;
}

/** Enviar gestión de alerta al servidor (POST /alerts/:key/read|resolve|delegate) con key codificada */
export async function gestionarAlertaRemota(
  key: string,
  patch: { estado?: string; delegadoA?: string; nota?: string }
): Promise<void> {
  const serverKey = clientKeyToServerKey(key);
  const encKey = encodeURIComponent(serverKey);

  try {
    if (patch.estado === 'Leída') {
      await api.post(`/alerts/${encKey}/read`, {});
    } else if (patch.estado === 'Resuelta') {
      await api.post(`/alerts/${encKey}/resolve`, {
        nota: patch.nota || 'Alerta resuelta desde interfaz',
      });
    } else if (patch.estado === 'Delegada') {
      let usuarioId = patch.delegadoA || '';
      const db = Store.getDB();
      const foundUser = (db?.users || []).find(
        (u) => u.id === patch.delegadoA || u.nombre === patch.delegadoA
      );
      if (foundUser) {
        usuarioId = foundUser.id;
      }
      await api.post(`/alerts/${encKey}/delegate`, { usuarioId });
    }
  } catch (err) {
    console.warn(`[Remote] Error gestionando alerta remota ${serverKey}:`, err);
  }
}

export type RemoteOp =
  | { tipo: 'insert'; col: string; tempId: string; obj: any; retries?: number }
  | { tipo: 'update'; col: string; id: string; patch: any; version?: number; retries?: number }
  | { tipo: 'anular'; col: string; id: string; motivo: string; retries?: number };

let memQueue: RemoteOp[] = [];
let isFlushing = false;

function loadStoredQueue(): RemoteOp[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredQueue(queue: RemoteOp[]) {
  if (typeof window === 'undefined') return;
  try {
    if (queue.length === 0) {
      window.localStorage.removeItem(QUEUE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    }
  } catch {}
}

// Inicializar cola en memoria si hay guardada
if (typeof window !== 'undefined') {
  memQueue = loadStoredQueue();
}

/** Paginación completa de colecciones hasta agotar total */
async function fetchAllPages<T = any>(
  path: string,
  queryParam: Record<string, unknown> = {}
): Promise<T[]> {
  const pageSize = 500;
  let page = 1;
  const all: T[] = [];
  let total = Infinity;

  while (all.length < total) {
    const res = await api.get<{ data?: T[]; total?: number; page?: number; pageSize?: number } | T[]>(
      path,
      { query: { ...queryParam, page, pageSize } }
    );
    if (Array.isArray(res)) {
      return res;
    }
    const data = res?.data || [];
    all.push(...data);
    total = typeof res?.total === 'number' ? res.total : data.length;
    if (data.length === 0 || all.length >= total) {
      break;
    }
    page++;
  }
  return all;
}

/** Remapea ID temporal generado en local por el ID y versión reales del servidor */
function remapearId(col: string, oldId: string, newId: string, newVersion?: number) {
  const db = Store.getDB();
  if (!db) return;

  const list = (db as any)[col] as any[];
  if (Array.isArray(list)) {
    const item = list.find((x) => x.id === oldId);
    if (item) {
      item.id = newId;
      if (typeof newVersion === 'number') {
        item.version = newVersion;
      }
    }
  }

  // Si se remapeó un contrato, actualizar contractId en colecciones hijas
  if (col === 'contracts') {
    const childCols: (keyof DB)[] = [
      'subcontracts',
      'obligations',
      'deliverables',
      'execs',
      'payments',
      'actas',
      'modifications',
      'risks',
      'breaches',
      'plans',
      'guarantees',
      'documents',
    ];
    for (const cName of childCols) {
      const items = (db as any)[cName] as any[];
      if (Array.isArray(items)) {
        for (const it of items) {
          if (it.contractId === oldId) {
            it.contractId = newId;
          }
        }
      }
    }
  }

  // Actualizar también en las operaciones pendientes en cola
  for (const op of memQueue) {
    if (op.tipo === 'update' || op.tipo === 'anular') {
      if (op.id === oldId) op.id = newId;
    } else if (op.tipo === 'insert') {
      if (op.tempId === oldId) op.tempId = newId;
      if (op.obj && op.obj.contractId === oldId) op.obj.contractId = newId;
    }
    if ((op as any).patch && (op as any).patch.contractId === oldId) {
      (op as any).patch.contractId = newId;
    }
  }

  Store.persist();
  saveStoredQueue(memQueue);
}

/** Refresca una entidad individual del servidor (ej. ante conflicto 409) */
export async function refrescarEntidad(col: string, id: string): Promise<void> {
  const apiCol = COL_API_MAP[col] || col;
  try {
    let fresh: any = null;
    if (col === 'contracts' || col === 'companies' || col === 'users') {
      fresh = await api.get(`/${apiCol}/${encodeURIComponent(id)}`);
    } else if (col === 'guarantees' || col === 'cupos') {
      // Pólizas y cupos
      const all = await fetchAllPages(`/${apiCol}`);
      fresh = (all || []).find((x: any) => x.id === id);
    } else {
      // Colecciones hijas
      const local = Store.get(col as any, id);
      if (local && local.contractId) {
        const list = await api.get<any[]>(`/contracts/${encodeURIComponent(local.contractId)}/${apiCol}`);
        fresh = Array.isArray(list) ? list.find((x) => x.id === id) : null;
      } else {
        const all = await fetchAllPages(`/${apiCol}`);
        fresh = (all || []).find((x: any) => x.id === id);
      }
    }

    if (fresh) {
      const db = Store.getDB();
      const list = (db as any)[col] as any[];
      if (Array.isArray(list)) {
        const idx = list.findIndex((x) => x.id === id);
        if (idx >= 0) {
          list[idx] = fresh;
        } else {
          list.push(fresh);
        }
        Store.persist();
      }
    }
  } catch (err) {
    console.warn(`[Remote] No se pudo refrescar entidad ${col}/${id}:`, err);
  }
}

/** Encola una operación para write-through hacia la API */
export function enCola(op: RemoteOp) {
  memQueue.push(op);
  saveStoredQueue(memQueue);
  flush().catch((err) => {
    console.warn('[Remote] Error en write-through:', err);
  });
}

/** Ejecuta las escrituras pendientes contra la API */
export async function flush(): Promise<void> {
  if (isFlushing || typeof window === 'undefined') return;
  const token = getStoredToken();
  if (!token) return;

  isFlushing = true;
  try {
    while (memQueue.length > 0) {
      const op = memQueue[0];
      const apiCol = COL_API_MAP[op.col] || op.col;

      try {
        if (op.tipo === 'insert') {
          const payload = { ...op.obj };
          delete payload.id;
          delete payload.metricas;
          delete payload.aseguradoras;

          const res = await api.post<any>(`/${apiCol}`, payload, { force: true });
          if (res && res.id) {
            remapearId(op.col, op.tempId, res.id, res.version);
          }
          memQueue.shift();
          saveStoredQueue(memQueue);
        } else if (op.tipo === 'update') {
          const currentItem = Store.get(op.col as any, op.id);
          const version = op.version ?? (currentItem?.version || 1);
          const payload = { ...op.patch, version };
          delete payload.id;
          delete payload.metricas;
          delete payload.aseguradoras;

          try {
            const res = await api.put<any>(`/${apiCol}/${encodeURIComponent(op.id)}`, payload, {
              force: true,
            });
            if (res && typeof res.version === 'number') {
              if (currentItem) {
                currentItem.version = res.version;
                Store.persist();
              }
            }
            memQueue.shift();
            saveStoredQueue(memQueue);
          } catch (putErr: any) {
            if (putErr instanceof ApiCallError && putErr.status === 409) {
              console.warn(
                `[Remote] Conflicto 409 al actualizar ${op.col}/${op.id}. Re-hidratando entidad.`
              );
              await refrescarEntidad(op.col, op.id);
              memQueue.shift();
              saveStoredQueue(memQueue);
            } else {
              throw putErr;
            }
          }
        } else if (op.tipo === 'anular') {
          const body = { motivo: op.motivo || 'Anulación solicitada desde la interfaz' };
          await api.post<any>(`/${apiCol}/${encodeURIComponent(op.id)}/void`, body);
          memQueue.shift();
          saveStoredQueue(memQueue);
        }
      } catch (err: any) {
        op.retries = (op.retries || 0) + 1;
        if (op.retries <= 3) {
          const backoffMs = Math.min(5000, 1000 * Math.pow(2, op.retries));
          console.warn(
            `[Remote] Fallo de red en ${op.tipo} ${op.col}. Reintento ${op.retries}/3 en ${backoffMs}ms.`,
            err?.message || err
          );
          await new Promise((r) => setTimeout(r, backoffMs));
          // Sale para reintentar en el siguiente ciclo
          break;
        } else {
          console.error(
            `[Remote] Máximo de reintentos alcanzado para ${op.tipo} ${op.col}. Se mantiene cambio local.`,
            err
          );
          memQueue.shift();
          saveStoredQueue(memQueue);
        }
      }
    }
  } finally {
    isFlushing = false;
  }
}

/** Hidratación completa: descarga todas las colecciones y mapea al DB de lib/types.ts */
export async function hidratar(isRetry = false): Promise<DB | null> {
  const token = getStoredToken();
  if (!token) {
    currentSyncInfo = {
      ...currentSyncInfo,
      status: 'idle',
      retryCount: 0,
      nextRetryMs: null,
      error: null,
    };
    notifySyncListeners();
    return null;
  }

  if (inFlightHydration) {
    return inFlightHydration;
  }

  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }

  if (!isRetry && currentSyncInfo.status !== 'offline') {
    currentSyncInfo.retryCount = 0;
  }

  currentSyncInfo = {
    ...currentSyncInfo,
    status: 'syncing',
    nextRetryMs: null,
    error: null,
  };
  notifySyncListeners();

  inFlightHydration = (async () => {
    try {
      const existingDb = Store.getDB();

      // 1. Descargas en paralelo: colecciones raíz fallan si la API no está disponible
      const [
        users,
        companies,
        contracts,
        subcontracts,
        obligations,
        deliverables,
        execs,
        payments,
        actas,
        modifications,
        risks,
        breaches,
        plans,
        guarantees,
        cupos,
        tasks,
        audit,
        alertsRes,
        settingsRes,
        rolesRes,
      ] = await Promise.all([
        // Endpoints primarios sin catch: lanzan error ante caída del servidor/red
        api.get<User[]>('/users'),
        fetchAllPages<Company>('/companies'),
        fetchAllPages<Contract>('/contracts'),
        // Colecciones hijas
        fetchAllPages<Subcontract>('/subcontracts').catch(() => existingDb?.subcontracts || []),
        fetchAllPages<Obligation>('/obligations').catch(() => existingDb?.obligations || []),
        fetchAllPages<Deliverable>('/deliverables').catch(() => existingDb?.deliverables || []),
        fetchAllPages<Exec>('/execs').catch(() => existingDb?.execs || []),
        fetchAllPages<Payment>('/payments').catch(() => existingDb?.payments || []),
        fetchAllPages<Acta>('/actas').catch(() => existingDb?.actas || []),
        fetchAllPages<Modification>('/modifications').catch(() => existingDb?.modifications || []),
        fetchAllPages<Risk>('/risks').catch(() => existingDb?.risks || []),
        fetchAllPages<Breach>('/breaches').catch(() => existingDb?.breaches || []),
        fetchAllPages<Plan>('/plans').catch(() => existingDb?.plans || []),
        // Seguros y cupos
        fetchAllPages<Guarantee>('/guarantees').catch(() => existingDb?.guarantees || []),
        fetchAllPages<Cupo>('/quotas').catch(() => existingDb?.cupos || []),
        // Tareas, auditoría y alertas
        api.get<Task[]>('/tasks').catch(() => existingDb?.tasks || []),
        fetchAllPages<AuditEntry>('/audit').catch(() => existingDb?.audit || []),
        api.get<{ data: any[]; total: number }>('/alerts', { query: { pageSize: 500 } }).catch(() => ({ data: [], total: 0 })),
        api.get<any>('/settings').catch(() => null),
        api.get<any>('/roles/permissions').catch(() => null),
      ]);

      // 2. Documentos por cada contrato (en paralelo)
      let documents: Document[] = [];
      if (contracts.length > 0) {
        const docsArrays = await Promise.all(
          contracts.map((c: any) =>
            api.get<Document[]>(`/contracts/${encodeURIComponent(c.id)}/documents`).catch(() => [])
          )
        );
        documents = docsArrays.flat();
      } else {
        documents = existingDb?.documents || [];
      }

      // 3. Mapear alertState: guardar bajo clave de servidor y mapear a claves cliente
      const alertState: AlertState = { ...(existingDb?.alertState || {}) };
      const rawAlerts = Array.isArray(alertsRes?.data) ? alertsRes.data : [];
      for (const a of rawAlerts) {
        if (!a.key) continue;
        const g = a.gestion || {};
        const stItem = {
          estado: g.estado || a.estado || 'Nueva',
          delegadoA: g.delegadoA || undefined,
          nota: g.nota || undefined,
          usuario: g.usuario || undefined,
          fechaGestion: g.fechaGestion ? String(g.fechaGestion) : undefined,
        };
        // Clave canónica del servidor
        alertState[a.key] = stItem;
        // Claves correspondientes del cliente para Alerts.compute()
        const clientKeys = serverKeyToClientKeys(a.key);
        for (const ck of clientKeys) {
          alertState[ck] = stItem;
        }
      }

      // 4. Mapear settings y matriz de permisos
      const baseSettings = existingDb?.settings || {
        currentUser: 'U1',
        alertDays: [30, 15, 10, 5, 3, 1],
        criticalDays: 5,
        budgetPct: 15,
        gapPct: 20,
        perms: defaultPerms(),
        catalogs: defaultCatalogs(),
      };

      const mergedSettings: Settings = {
        currentUser: baseSettings.currentUser || 'U1',
        alertDays: settingsRes?.alertDays || baseSettings.alertDays || [30, 15, 10, 5, 3, 1],
        criticalDays: settingsRes?.criticalDays ?? baseSettings.criticalDays ?? 5,
        budgetPct: settingsRes?.budgetPct ?? baseSettings.budgetPct ?? 15,
        gapPct: settingsRes?.gapPct ?? baseSettings.gapPct ?? 20,
        perms: { ...(baseSettings.perms || defaultPerms()) },
        catalogs: { ...(baseSettings.catalogs || defaultCatalogs()) },
      };

      if (rolesRes?.matriz) {
        for (const [rol, pMap] of Object.entries(rolesRes.matriz as Record<string, Record<string, boolean>>)) {
          mergedSettings.perms[rol] = mergedSettings.perms[rol] || {};
          for (const [permKey, val] of Object.entries(pMap)) {
            mergedSettings.perms[rol][permKey.toLowerCase()] = val ? 1 : 0;
            mergedSettings.perms[rol][permKey.toUpperCase()] = val ? 1 : 0;
          }
        }
      }

      // 5. Mapear auditoría garantizando tipos estables
      const rawAudit = Array.isArray(audit) ? audit : [];
      const mappedAudit: AuditEntry[] = rawAudit.map((x: any) => ({
        id: String(x.id),
        ts: x.ts ? (typeof x.ts === 'string' ? x.ts : new Date(x.ts).toISOString()) : nowStamp(),
        fecha: x.fecha || todayIso(),
        hora: x.hora || '00:00',
        usuario: x.usuario || 'Sistema',
        rol: x.rol || '—',
        contractId: x.contractId || undefined,
        modulo: x.modulo || 'General',
        accion: x.accion || '',
        campo: x.campo || undefined,
        anterior: x.anterior != null ? String(x.anterior) : undefined,
        nuevo: x.nuevo != null ? String(x.nuevo) : undefined,
        ip: x.ip || undefined,
        obs: x.obs || undefined,
      }));

      // 6. Construir base de datos unificada
      const hydratedDb: DB = {
        version: '2.0',
        created: existingDb?.created || nowStamp(),
        alertState,
        tasks: Array.isArray(tasks) ? tasks : [],
        audit: mappedAudit.length > 0 ? mappedAudit : (existingDb?.audit || []),
        users: Array.isArray(users) && users.length > 0 ? users : (existingDb?.users || []),
        settings: mergedSettings,
        companies: Array.isArray(companies) ? companies : [],
        contracts: Array.isArray(contracts) ? contracts : [],
        subcontracts: Array.isArray(subcontracts) ? subcontracts : [],
        execs: Array.isArray(execs) ? execs : [],
        payments: Array.isArray(payments) ? payments : [],
        obligations: Array.isArray(obligations) ? obligations : [],
        deliverables: Array.isArray(deliverables) ? deliverables : [],
        guarantees: Array.isArray(guarantees) ? guarantees : [],
        actas: Array.isArray(actas) ? actas : [],
        modifications: Array.isArray(modifications) ? modifications : [],
        risks: Array.isArray(risks) ? risks : [],
        breaches: Array.isArray(breaches) ? breaches : [],
        plans: Array.isArray(plans) ? plans : [],
        documents,
        cupos: Array.isArray(cupos) ? cupos : [],
      };

      Store.setDB(hydratedDb);

      // Estado sincronizado con éxito
      currentSyncInfo = {
        ...currentSyncInfo,
        status: 'synced',
        retryCount: 0,
        nextRetryMs: null,
        lastSyncedAt: new Date(),
        error: null,
      };
      notifySyncListeners();

      // Transición discreta a idle después de 2.5s
      setTimeout(() => {
        if (currentSyncInfo.status === 'synced') {
          currentSyncInfo = { ...currentSyncInfo, status: 'idle' };
          notifySyncListeners();
        }
      }, 2500);

      // Intentar vaciar cola pendiente tras hidratar
      flush().catch(console.error);

      return hydratedDb;
    } catch (err: any) {
      console.warn('[Remote] Error durante hidratación; operando con caché local offline:', err);

      const nextAttempt = currentSyncInfo.retryCount + 1;
      if (nextAttempt <= MAX_RETRIES) {
        const delay = BACKOFF_MS[nextAttempt - 1] || 4000;
        currentSyncInfo = {
          ...currentSyncInfo,
          status: 'offline',
          retryCount: nextAttempt,
          nextRetryMs: delay,
          error: err?.message || 'Sin conexión con el servidor',
        };
        notifySyncListeners();

        retryTimeoutId = setTimeout(() => {
          retryTimeoutId = null;
          hidratar(true).catch(() => {});
        }, delay);
      } else {
        currentSyncInfo = {
          ...currentSyncInfo,
          status: 'offline',
          retryCount: nextAttempt,
          nextRetryMs: null,
          error: err?.message || 'Sin conexión con el servidor',
        };
        notifySyncListeners();
      }

      return Store.getDB();
    } finally {
      inFlightHydration = null;
    }
  })();

  return inFlightHydration;
}

/** Dispara reintento manual inmediato de hidratación */
export function reintentarHidratacion(): Promise<DB | null> {
  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }
  currentSyncInfo = {
    ...currentSyncInfo,
    retryCount: 0,
    nextRetryMs: null,
    error: null,
  };
  return hidratar(false);
}

// Reconexión automática al volver la red en navegador
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (currentSyncInfo.status === 'offline') {
      reintentarHidratacion().catch(() => {});
    }
  });
}
