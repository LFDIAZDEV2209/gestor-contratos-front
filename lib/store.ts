// Capa de datos y persistencia en localStorage ('gic_store_v2') según files/02, files/08 y prototipo HTML
// Adaptado con write-through y conexión real a la API según CONEXION_API.md § 2.4
import type { DB, UID, User, Perm } from './types';
import { Seed } from './demo';
import { nowStamp, iso, pad, uid } from './format';
import { PERM_LABEL } from './catalog';
import { api } from './api';
import { enCola, hidratar } from './remote';

const STORE_KEY = 'gic_store_v2';

let dbInstance: DB | null = null;
const SESSION_IP = '10.20.' + (10 + Math.floor(Math.random() * 40)) + '.' + (20 + Math.floor(Math.random() * 200));

export const LocalStorageAdapter = {
  load(): DB | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  save(db: DB): boolean {
    if (typeof window === 'undefined') return false;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(db));
      return true;
    } catch {
      return false;
    }
  },
  clear() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(STORE_KEY);
    } catch {}
  }
};

export const AuthService = {
  AUTH_KEY: 'ss_auth_v1',
  TOKEN_KEY: 'ss_token_v1',
  USER_KEY: 'ss_user_v1',
  PERMS_KEY: 'ss_perms_v1',

  getToken(): string {
    if (typeof window === 'undefined') return '';
    return (
      window.localStorage.getItem(AuthService.TOKEN_KEY) ||
      window.sessionStorage.getItem(AuthService.TOKEN_KEY) ||
      ''
    );
  },

  isAuthed(): boolean {
    if (typeof window === 'undefined') return true; // SSR seguro: el guard decide en cliente
    return Boolean(AuthService.getToken());
  },

  /** Login real contra la API (POST /auth/login con email) */
  async login(
    email: string,
    _password?: string,
    remember = true
  ): Promise<{ token: string; usuario: User; permisos: string[] }> {
    const res = await api.post<{ token: string; usuario: User; permisos: string[] }>('/auth/login', {
      email: email.trim().toLowerCase(),
    });

    const storage = remember ? window.localStorage : window.sessionStorage;
    storage.setItem(AuthService.TOKEN_KEY, res.token);
    storage.setItem(AuthService.AUTH_KEY, '1');
    storage.setItem(AuthService.USER_KEY, JSON.stringify(res.usuario));
    storage.setItem(AuthService.PERMS_KEY, JSON.stringify(res.permisos || []));

    const otherStorage = remember ? window.sessionStorage : window.localStorage;
    otherStorage.removeItem(AuthService.TOKEN_KEY);
    otherStorage.removeItem(AuthService.AUTH_KEY);
    otherStorage.removeItem(AuthService.USER_KEY);
    otherStorage.removeItem(AuthService.PERMS_KEY);

    AuthService.setCurrentUser(res.usuario.id);
    return res;
  },

  /** Compatibilidad: si recibe correo o ID */
  async signIn(emailOrId: string, remember = true): Promise<void> {
    if (typeof window === 'undefined') return;
    if (emailOrId.includes('@')) {
      await AuthService.login(emailOrId, 'demo1234', remember);
    } else {
      const db = Store.getDB();
      const u = (db?.users || []).find((x) => x.id === emailOrId);
      if (u?.email) {
        await AuthService.login(u.email, 'demo1234', remember);
      } else {
        (remember ? window.localStorage : window.sessionStorage).setItem(AuthService.AUTH_KEY, '1');
        AuthService.setCurrentUser(emailOrId);
      }
    }
  },

  signOut(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(AuthService.TOKEN_KEY);
    window.sessionStorage.removeItem(AuthService.TOKEN_KEY);
    window.localStorage.removeItem(AuthService.AUTH_KEY);
    window.sessionStorage.removeItem(AuthService.AUTH_KEY);
    window.localStorage.removeItem(AuthService.USER_KEY);
    window.sessionStorage.removeItem(AuthService.USER_KEY);
    window.localStorage.removeItem(AuthService.PERMS_KEY);
    window.sessionStorage.removeItem(AuthService.PERMS_KEY);
  },

  currentUser(): User {
    if (typeof window !== 'undefined') {
      const rawUser =
        window.localStorage.getItem(AuthService.USER_KEY) ||
        window.sessionStorage.getItem(AuthService.USER_KEY);
      if (rawUser) {
        try {
          const u = JSON.parse(rawUser);
          if (u && u.id) return u;
        } catch {}
      }
    }
    const db = Store.getDB();
    if (!db) {
      return { id: 'U1', nombre: 'Laura Méndez', email: 'lmendez@empresa.co', rol: 'ADMINISTRADOR', estado: 'Activo' };
    }
    const curId = db.settings?.currentUser || 'U1';
    const u = (db.users || []).find((x) => x.id === curId);
    return u || (db.users && db.users[0]) || { id: 'U1', nombre: 'Laura Méndez', email: 'lmendez@empresa.co', rol: 'ADMINISTRADOR', estado: 'Activo' };
  },

  setCurrentUser(id: string) {
    const db = Store.getDB();
    if (db && db.settings) {
      db.settings.currentUser = id;
      const found = (db.users || []).find((u) => u.id === id);
      if (found && typeof window !== 'undefined') {
        const storage = window.localStorage.getItem(AuthService.TOKEN_KEY)
          ? window.localStorage
          : window.sessionStorage;
        storage.setItem(AuthService.USER_KEY, JSON.stringify(found));
      }
      Store.persist();
    }
  },

  can(p: string): boolean {
    const u = AuthService.currentUser();
    if (!u) return false;
    if (u.rol === 'ADMINISTRADOR') return true;
    const pLower = p.toLowerCase();
    const pUpper = p.toUpperCase();
    const db = Store.getDB();
    const r = (db?.settings?.perms && db.settings.perms[u.rol]) || {};
    if (r[pLower] !== undefined) return Boolean(r[pLower]);
    if (r[pUpper] !== undefined) return Boolean(r[pUpper]);
    if (Array.isArray(u.perms)) {
      return u.perms.map((x) => x.toLowerCase()).includes(pLower);
    }
    return false;
  },

  guard(p: string): boolean {
    if (AuthService.can(p)) return true;
    const u = AuthService.currentUser();
    const lbl = (PERM_LABEL as Record<string, string>)[p] || p;
    if (typeof window !== 'undefined') {
      alert(`Tu rol ${u ? u.rol : ''} no tiene permiso para «${lbl}». Cambia de usuario en el menú superior.`);
    }
    return false;
  }
};

export const Audit = {
  log(e: {
    contractId?: UID;
    modulo?: string;
    accion?: string;
    campo?: string;
    anterior?: any;
    nuevo?: any;
    obs?: string;
  }) {
    const db = Store.getDB();
    if (!db) return;
    const u = AuthService.currentUser();
    const d = new Date();
    const entry = Object.freeze({
      id: uid('AUD'),
      ts: nowStamp(),
      fecha: iso(d),
      hora: pad(d.getHours()) + ':' + pad(d.getMinutes()),
      usuario: u ? u.nombre : 'Sistema',
      rol: u ? u.rol : '—',
      contractId: e.contractId || '',
      modulo: e.modulo || '',
      accion: e.accion || '',
      campo: e.campo || '',
      anterior: e.anterior == null ? '' : String(e.anterior),
      nuevo: e.nuevo == null ? '' : String(e.nuevo),
      ip: SESSION_IP + ' (simulada)',
      obs: e.obs || ''
    });
    if (!db.audit) db.audit = [];
    db.audit.push(entry as any);
    Store.persist();
    return entry;
  },
  diff(modulo: string, contractId: string, before: any, after: any, labels: Record<string, string>) {
    let n = 0;
    for (const k in labels) {
      const a = before ? before[k] : undefined;
      const b = after ? after[k] : undefined;
      if (String(a == null ? '' : a) !== String(b == null ? '' : b)) {
        Audit.log({
          contractId,
          modulo,
          accion: before ? 'Modificación' : 'Creación',
          campo: labels[k],
          anterior: before ? a : '',
          nuevo: b
        });
        n++;
      }
    }
    return n;
  },
  sentence(a: any): string {
    const c = Store.get('contracts', a.contractId);
    const cn = c ? (c.numero || c.num || '') : '';
    if (a.accion === 'Modificación' && a.campo) {
      return `${a.usuario} modificó ${a.campo.toLowerCase()}${cn ? ' del contrato ' + cn : ''} de «${a.anterior || 'vacío'}» a «${a.nuevo || 'vacío'}».`;
    }
    if (a.accion === 'Creación' && a.campo) {
      return `${a.usuario} registró ${a.campo.toLowerCase()}: «${a.nuevo}»${cn ? ' en ' + cn : ''}.`;
    }
    return `${a.usuario} · ${a.accion}${a.campo ? ' · ' + a.campo : ''}${cn ? ' · ' + cn : ''}${a.obs ? ' — ' + a.obs : ''}`;
  }
};

export const Store = {
  fresh: false,
  getDB(): DB {
    if (!dbInstance) {
      Store.init();
    }
    return dbInstance!;
  },
  setDB(db: DB) {
    dbInstance = db;
    Store.persist();
  },
  init(seed?: DB) {
    let loaded = LocalStorageAdapter.load();
    if (!loaded || !loaded.version) {
      loaded = seed || Seed.build();
      LocalStorageAdapter.save(loaded);
      Store.fresh = true;
    }
    dbInstance = loaded;
    if (!dbInstance.alertState) dbInstance.alertState = {};
    if (!dbInstance.tasks) dbInstance.tasks = [];
    if (!dbInstance.audit) dbInstance.audit = [];

    // Si hay sesión activa en navegador, refrescar en segundo plano con la API
    if (typeof window !== 'undefined' && AuthService.isAuthed()) {
      hidratar().catch((err) => {
        console.warn('[Store] Hidratación inicial en segundo plano completada con caché:', err);
      });
    }
  },
  persist() {
    if (dbInstance) {
      LocalStorageAdapter.save(dbInstance);
    }
  },
  all<K extends keyof DB>(col: K): NonNullable<DB[K]> extends any[] ? NonNullable<DB[K]> : any[] {
    const db = Store.getDB();
    const list = db[col];
    return (Array.isArray(list) ? list : []) as any;
  },
  get<K extends keyof DB>(col: K, id: UID): any | null {
    const list = Store.all(col);
    return list.find((item: any) => item.id === id) || null;
  },
  byContract<K extends keyof DB>(col: K, cid: UID): any[] {
    const list = Store.all(col);
    return list.filter((item: any) => item.contractId === cid);
  },
  insert<K extends keyof DB>(col: K, obj: any): any {
    const db = Store.getDB();
    if (!obj.id) {
      obj.id = uid(String(col).slice(0, 3).toUpperCase());
    }
    const list = (db[col] as any[]) || [];
    list.push(obj);
    (db as any)[col] = list;
    Store.persist();

    // Write-through a la API
    enCola({
      tipo: 'insert',
      col: String(col),
      tempId: obj.id,
      obj: { ...obj }
    });

    return obj;
  },
  update<K extends keyof DB>(col: K, id: UID, patch: any): any | null {
    const item = Store.get(col, id);
    if (!item) return null;
    const versionAntes = item.version;
    Object.assign(item, patch);
    Store.persist();

    // Write-through a la API
    enCola({
      tipo: 'update',
      col: String(col),
      id: String(id),
      patch: { ...patch },
      version: versionAntes
    });

    return item;
  },
  anular(col: string, id: UID, motivo: string): boolean {
    const item = Store.get(col as any, id);
    if (!item) return false;
    const estadoPrevio = item.estado;
    if (col === 'contracts') {
      item.anulado = true;
      item.estado = 'Anulado';
    } else {
      item.estado = item.estado ? (item.estado.endsWith('a') ? 'Anulada' : 'Anulado') : 'Anulado';
    }
    Audit.log({
      contractId: item.contractId || (col === 'contracts' ? id : ''),
      modulo: col.charAt(0).toUpperCase() + col.slice(1),
      accion: 'Anulación',
      campo: 'Estado',
      anterior: estadoPrevio,
      nuevo: item.estado,
      obs: motivo
    });
    Store.persist();

    // Write-through a la API
    enCola({
      tipo: 'anular',
      col: String(col),
      id: String(id),
      motivo
    });

    return true;
  },
  reset(seed?: DB) {
    // Si hay sesión activa, reset SOLO re-hidrata de la API
    if (typeof window !== 'undefined' && AuthService.isAuthed()) {
      hidratar().catch((err) => {
        console.warn('[Store] Error al re-hidratar en reset:', err);
      });
      return;
    }
    LocalStorageAdapter.clear();
    dbInstance = seed || Seed.build();
    LocalStorageAdapter.save(dbInstance);
  }
};
