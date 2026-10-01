// Utilidades de formateo
export const money = (v: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
export const moneyM = (v: number) => `${(v / 1e6).toFixed(1)}M`;
export const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
export const num = (v: number) => new Intl.NumberFormat('es-CO').format(v);
export const fdate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  // Compensar zona horaria si se asume UTC
  d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
};
export const iso = (d: Date) => d.toISOString().split('T')[0];
export const addDays = (d: string, days: number) => {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  return iso(nd);
};
export const diffDays = (d1: string, d2: string) => Math.round((new Date(d2).getTime() - new Date(d1).getTime()) / 864e5);
export const monthKey = (d: string) => d.substring(0, 7);
export const esc = (s: string) => s;
export const uid = () => Math.random().toString(36).substring(2, 9);
export const initials = (n: string) => n.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const sum = <T>(arr: T[], fn: (i: T) => number) => arr.reduce((a, b) => a + fn(b), 0);
export const groupBy = <T>(arr: T[], keyFn: (i: T) => string) => arr.reduce((r, v) => {
  const k = keyFn(v);
  (r[k] = r[k] || []).push(v);
  return r;
}, {} as Record<string, T[]>);
export const pad = (n: number) => n.toString().padStart(2, '0');
export const nowStamp = () => new Date().toISOString();
export const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
export const MESES_L = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
export const DIAS_L = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
export const monthLabel = (m: number) => MESES[m];
export const lastMonths = (n: number) => {
  const res = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    res.unshift(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    d.setMonth(d.getMonth() - 1);
  }
  return res;
};
export const todayIso = () => iso(new Date());
