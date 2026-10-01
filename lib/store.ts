import type { DB, UID } from './types';
import { uid, nowStamp } from './format';

const STORE_KEY = 'gic_store_v2';

let memDb: DB | null = null;

export const Store = {
  init(defaultDb: DB) {
    if (typeof window === 'undefined') return defaultDb;
    const ls = localStorage.getItem(STORE_KEY);
    if (ls) {
      try { memDb = JSON.parse(ls); } catch(e) {}
    }
    if (!memDb) {
      memDb = defaultDb;
      this.persist();
    }
    return memDb;
  },
  persist() {
    if (typeof window !== 'undefined' && memDb) {
      localStorage.setItem(STORE_KEY, JSON.stringify(memDb));
    }
  },
  all<K extends keyof DB>(col: K): DB[K] {
    return memDb ? memDb[col] : [] as any;
  },
  get<K extends keyof DB>(col: K, id: UID): any {
    return (this.all(col) as any[]).find(x => x.id === id);
  },
  byContract<K extends keyof DB>(col: K, cid: UID): DB[K] {
    return (this.all(col) as any[]).filter(x => x.contractId === cid) as any;
  },
  insert<K extends keyof DB>(col: K, item: any) {
    if(!memDb) return;
    (memDb[col] as any[]).push(item);
    this.persist();
  },
  update<K extends keyof DB>(col: K, id: UID, changes: any) {
    if(!memDb) return;
    const arr = memDb[col] as any[];
    const idx = arr.findIndex(x => x.id === id);
    if (idx >= 0) {
      arr[idx] = { ...arr[idx], ...changes };
      this.persist();
    }
  },
  reset(newDb: DB) {
    memDb = newDb;
    this.persist();
  }
};

export const Audit = {
  log(user: UID, action: string, entity: string, entityId: UID, details: string) {
    Store.insert('audits', { id: uid(), date: nowStamp(), user, action, entity, entityId, details });
  },
  diff() { return ''; },
  sentence() { return ''; }
};

export const AuthService = {
  getUser() { return Store.all('users')?.[0]; }
};
