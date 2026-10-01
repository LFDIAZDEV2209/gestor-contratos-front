// Utilidades de formateo 1:1 con el prototipo HTML y files/05

export const pad = (n: number) => n.toString().padStart(2, '0');

export const iso = (d: Date): string => {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
};

export const todayIso = (): string => iso(new Date());

export const parseD = (s?: string | null): Date | null => {
  if (!s) return null;
  const p = String(s).slice(0, 10).split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]);
};

export const diffDays = (a?: string | null, b?: string | null): number => {
  if (!a || !b) return 0;
  const da = parseD(a);
  const db = parseD(b);
  if (!da || !db) return 0;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
};

export const addDays = (s: string, n: number): string => {
  const d = parseD(s) || new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

export const fdate = (s?: string | null): string => {
  if (!s) return '—';
  const p = String(s).slice(0, 10).split('-');
  if (p.length !== 3) return String(s);
  return p[2] + '/' + p[1] + '/' + p[0];
};

export const nowStamp = (): string => {
  const d = new Date();
  return iso(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
};

export const money = (n?: number | null): string => {
  return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
};

export const moneyM = (n?: number | null): string => {
  const val = Number(n) || 0;
  const abs = Math.abs(val);
  if (abs >= 1e9) {
    return '$' + (val / 1e9).toLocaleString('es-CO', { maximumFractionDigits: 2 }) + ' mil M';
  }
  if (abs >= 1e6) {
    return '$' + (val / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' M';
  }
  return money(val);
};

export const pct = (n?: number | null, d?: number): string => {
  let val = Number(n);
  // Si se pasa en escala 0..1 (p.ej. 0.85 en vez de 85), verificar si tiene decimales pequeños
  // Pero según el HTML, pct(m.pctFin) recibe 88.5 para 88.5%
  if (!Number.isFinite(val)) val = 0;
  return val.toLocaleString('es-CO', {
    minimumFractionDigits: d == null ? 1 : d,
    maximumFractionDigits: d == null ? 1 : d
  }) + '%';
};

export const num = (v: any): number => {
  if (v === '' || v == null) return 0;
  if (typeof v === 'number') return v;
  return +String(v).replace(/[^0-9,\-.]/g, '').replace(/\./g, '').replace(',', '.') || 0;
};

export const esc = (s: any): string => {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c] || c;
  });
};

export const uid = (p: string = 'ID'): string => {
  return p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
};

export const clamp = (v: number, a: number, b: number): number => {
  return Math.max(a, Math.min(b, v));
};

export const daysTxt = (d?: number | null): string => {
  if (d == null) return '—';
  if (d === 0) return 'Vence hoy';
  if (d < 0) return `Vencido (${Math.abs(d)} d)`;
  return `${d} días`;
};

export const sum = <T>(arr: T[], fn?: (item: T) => number): number => {
  let t = 0;
  for (let i = 0; i < arr.length; i++) {
    t += (fn ? fn(arr[i]) : (arr[i] as any)) || 0;
  }
  return t;
};

export const groupBy = <T>(arr: T[], fn: (item: T) => string): Record<string, T[]> => {
  const o: Record<string, T[]> = {};
  arr.forEach((x) => {
    const k = fn(x);
    (o[k] = o[k] || []).push(x);
  });
  return o;
};

export const initials = (n?: string | null): string => {
  return String(n || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
};

export const monthKey = (s?: string | null): string => {
  return String(s || '').slice(0, 7);
};

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const DIAS_L = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export const monthLabel = (k: string): string => {
  if (!k) return '';
  const p = k.split('-');
  return MESES[(+p[1] || 1) - 1] + ' ' + p[0].slice(2);
};

export const lastMonths = (n: number): string[] => {
  const out: string[] = [];
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth(), 1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(x.getFullYear() + '-' + pad(x.getMonth() + 1));
  }
  return out;
};
