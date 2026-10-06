/**
 * Cliente HTTP del API (Seven Save API).
 * Base URL: NEXT_PUBLIC_API_URL (dev local: http://localhost:4000/api) o prod por defecto.
 */
import { AuthService } from './store';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.sevensave.com.co/api';

export class ApiCallError extends Error {
  status: number;
  code: string;
  fields?: string[];
  warnings?: string[];

  constructor(status: number, code: string, message: string, fields?: string[], warnings?: string[]) {
    super(message);
    this.name = 'ApiCallError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.warnings = warnings;
  }
}

/** Lanza ApiCallError con los datos del error uniforme del API {error:{code,message,fields?,warnings?}}. */
async function aError(res: Response): Promise<ApiCallError> {
  let code = 'INTERNAL_ERROR';
  let message = res.statusText || 'Error inesperado';
  let fields: string[] | undefined;
  let warnings: string[] | undefined;
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string; fields?: string[]; warnings?: string[] } };
    if (body?.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
      fields = body.error.fields;
      warnings = body.error.warnings;
    }
  } catch {
    /* cuerpo no JSON: mantener defaults */
  }

  // Caso 401: limpiar sesión y redirigir a /login
  if (res.status === 401 && typeof window !== 'undefined') {
    AuthService.signOut();
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  return new ApiCallError(res.status, code, message, fields, warnings);
}

export function authHeaders(): Record<string, string> {
  const token = AuthService.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getStoredToken(): string {
  return AuthService.getToken();
}

/**
 * fetchJson — método + path (relativo a API_BASE) + body JSON.
 * `force` añade ?force=true para confirmar advertencias 422 del servidor.
 */
export async function fetchJson<T>(
  metodo: 'GET' | 'POST' | 'PUT',
  path: string,
  opts: { body?: unknown; query?: Record<string, string | number | undefined>; force?: boolean } = {},
): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  if (opts.force) qs.set('force', 'true');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE}${cleanPath}${qs.size ? `?${qs.toString()}` : ''}`;
  const res = await fetch(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw await aError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T = any>(path: string, opts?: { query?: Record<string, string | number | undefined>; force?: boolean }) =>
    fetchJson<T>('GET', path, opts),
  post: <T = any>(path: string, body?: unknown, opts?: { query?: Record<string, string | number | undefined>; force?: boolean }) =>
    fetchJson<T>('POST', path, { ...opts, body }),
  put: <T = any>(path: string, body?: unknown, opts?: { query?: Record<string, string | number | undefined>; force?: boolean }) =>
    fetchJson<T>('PUT', path, { ...opts, body }),
};

/** POST multipart (documentos/evidencias). Campos extra como form-data de texto. */
export async function fetchMultipart<T>(
  path: string,
  fields: Record<string, string | undefined>,
  archivo: File,
): Promise<T> {
  const fd = new FormData();
  fd.append('archivo', archivo);
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== '') fd.append(k, v);
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const res = await fetch(`${API_BASE}${cleanPath}`, { method: 'POST', headers: { ...authHeaders() }, body: fd });
  if (!res.ok) throw await aError(res);
  return (await res.json()) as T;
}

/** GET binario directo (descarga por URL firmada del API local). */
export async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { headers: { ...authHeaders() } });
  if (!res.ok) throw await aError(res);
  return await res.blob();
}
