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
import { nowStamp } from './format';

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
export async function hidratar(): Promise<DB | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const existingDb = Store.getDB();

    // 1. Descargas en paralelo de colecciones raíz y secundarias
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
      // users: array directo
      api.get<User[]>('/users').catch(() => (existingDb?.users || [])),
      // companies: paginado
      fetchAllPages<Company>('/companies').catch(() => (existingDb?.companies || [])),
      // contracts: paginado
      fetchAllPages<Contract>('/contracts').catch(() => (existingDb?.contracts || [])),
      // 10 colecciones hijas del contrato
      fetchAllPages<Subcontract>('/subcontracts').catch(() => (existingDb?.subcontracts || [])),
      fetchAllPages<Obligation>('/obligations').catch(() => (existingDb?.obligations || [])),
      fetchAllPages<Deliverable>('/deliverables').catch(() => (existingDb?.deliverables || [])),
      fetchAllPages<Exec>('/execs').catch(() => (existingDb?.execs || [])),
      fetchAllPages<Payment>('/payments').catch(() => (existingDb?.payments || [])),
      fetchAllPages<Acta>('/actas').catch(() => (existingDb?.actas || [])),
      fetchAllPages<Modification>('/modifications').catch(() => (existingDb?.modifications || [])),
      fetchAllPages<Risk>('/risks').catch(() => (existingDb?.risks || [])),
      fetchAllPages<Breach>('/breaches').catch(() => (existingDb?.breaches || [])),
      fetchAllPages<Plan>('/plans').catch(() => (existingDb?.plans || [])),
      // Seguros
      fetchAllPages<Guarantee>('/guarantees').catch(() => (existingDb?.guarantees || [])),
      fetchAllPages<Cupo>('/quotas').catch(() => (existingDb?.cupos || [])),
      // Tareas y auditoría
      api.get<Task[]>('/tasks').catch(() => (existingDb?.tasks || [])),
      fetchAllPages<AuditEntry>('/audit').catch(() => (existingDb?.audit || [])),
      // Alertas
      api.get<{ data: any[]; total: number }>('/alerts', { query: { pageSize: 500 } }).catch(() => ({ data: [] })),
      // Configuración y roles
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

    // 3. Mapear alertState
    const alertState: AlertState = { ...(existingDb?.alertState || {}) };
    const rawAlerts = Array.isArray(alertsRes?.data) ? alertsRes.data : [];
    for (const a of rawAlerts) {
      if (a.key && a.gestion) {
        alertState[a.key] = {
          estado: a.gestion.estado,
          delegadoA: a.gestion.delegadoA || undefined,
          nota: a.gestion.nota || undefined,
          usuario: a.gestion.usuario || undefined,
          fechaGestion: a.gestion.fechaGestion ? String(a.gestion.fechaGestion) : undefined,
        };
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

    // 5. Construir base de datos unificada
    const hydratedDb: DB = {
      version: '2.0',
      created: existingDb?.created || nowStamp(),
      alertState,
      tasks: Array.isArray(tasks) ? tasks : [],
      audit: Array.isArray(audit) ? audit : [],
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

    // Intentar vaciar cola pendiente tras hidratar
    flush().catch(console.error);

    return hydratedDb;
  } catch (err) {
    console.warn('[Remote] Error durante hidratación; operando con caché local offline:', err);
    return Store.getDB();
  }
}
