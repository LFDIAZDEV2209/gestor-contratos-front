export const ROLES = ['Admin', 'Supervisor', 'Auditor', 'Consulta'];
export const PERMS = ['read', 'write', 'delete', 'approve', 'admin'];
export const PERM_LABEL: Record<string, string> = { read: 'Lectura', write: 'Escritura', delete: 'Borrado', approve: 'Aprobación', admin: 'Admin' };
export const defaultPerms = () => [...PERMS];
export const defaultCatalogs = () => ({});
export const CLOSED_STATES = ['Liquidado', 'Terminado', 'Cancelado'];
export const STATE_BADGE: Record<string, string> = {
  'Activo': 'b-ok', 'Borrador': 'b-na', 'Firmado': 'b-info', 'Suspendido': 'b-warn',
  'Liquidado': 'b-brand', 'Terminado': 'b-na', 'Cancelado': 'b-crit',
  'Vigente': 'b-ok', 'Vencida': 'b-crit', 'Por Vencer': 'b-warn'
};
export const LEVEL = { OK: 0, WARN: 1, RISK: 2, CRIT: 3 };
export const LEVEL_TXT = ['Normal', 'Precaución', 'Riesgo', 'Crítico'];
export const ALV = { info: 'lv-info', proxima: 'lv-proxima', riesgo: 'lv-riesgo', critica: 'lv-critica' };
