/**
 * Documentos reales contra el API (S3): subida, nueva versión, anulación y descarga.
 * No muta Store: tras una escritura exitosa el llamador recarga para re-hidratar del API.
 */
import { API_BASE, fetchBlob, fetchJson, fetchMultipart, type ApiCallError } from './api';
import type { Document, DocumentVersion } from './types';

export const MAX_ARCHIVO_MB = 25;
const QUEUE_KEY = 'ss_write_queue_v1';

const conForce = (path: string, force?: boolean) => (force ? `${path}?force=true` : path);

export function subirDocumento(
  contractId: string,
  nombre: string,
  categoria: string,
  obs: string | undefined,
  file: File,
  force = false,
): Promise<Document> {
  return fetchMultipart<Document>(conForce('/documents', force), { contractId, nombre, categoria, obs }, file);
}

/** Adjunto polimórfico (sin contrato): entidad propietaria `refId` de tipo `refTipo` (p. ej. cupo). */
export function subirSoportePolimorfico(
  refId: string,
  refTipo: string,
  nombre: string,
  obs: string | undefined,
  file: File,
  force = false,
): Promise<Document> {
  return fetchMultipart<Document>(conForce('/documents', force), { refId, refTipo, nombre, categoria: 'Soporte', obs }, file);
}

/** Adjuntos polimórficos de una entidad (documentos con versions[] desc). */
export function listarSoportesPorRef(refId: string, refTipo?: string): Promise<Document[]> {
  return fetchJson<Document[]>('GET', `/documents/by-ref/${encodeURIComponent(refId)}`, { query: { refTipo } });
}

export function subirNuevaVersion(
  documentId: string,
  motivo: string,
  cambios: string | undefined,
  file: File,
  force = false,
): Promise<{ documento: Document; version: DocumentVersion }> {
  return fetchMultipart(
    conForce(`/documents/${encodeURIComponent(documentId)}/versions`, force),
    { motivo, cambios },
    file,
  );
}

export function anularDocumento(documentId: string, motivo: string): Promise<Document> {
  return fetchJson('POST', `/documents/${encodeURIComponent(documentId)}/void`, { body: { motivo } });
}

/** Espera (máx. `max` ms) a que la cola write-through de lib/remote.ts quede vacía. */
export async function esperarCola(max = 10_000): Promise<void> {
  const fin = Date.now() + max;
  while (Date.now() < fin) {
    try {
      if (!window.localStorage.getItem(QUEUE_KEY)) return;
    } catch {
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

function guardar(blob: Blob, nombre: string) {
  const a = document.createElement('a');
  const href = URL.createObjectURL(blob);
  a.href = href;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

/**
 * Descarga una versión. URL absoluta de otro origen (presigned S3) → window.open;
 * relativa o del mismo origen del API (dev local) → fetchBlob autenticado + descarga.
 */
export async function descargarVersion(documentId: string, v: number, nombreArchivo = `documento_v${v}`): Promise<void> {
  const { url } = await fetchJson<{ url: string; expira?: string }>(
    'GET',
    `/documents/${encodeURIComponent(documentId)}/versions/${v}/url`,
  );
  const destino = new URL(url, API_BASE);
  if (destino.origin !== new URL(API_BASE).origin) {
    window.open(destino.toString(), '_blank', 'noopener');
    return;
  }
  guardar(await fetchBlob(destino.toString()), nombreArchivo.split(/[\\/]/).pop() || nombreArchivo);
}

/** Error 422 con advertencias del servidor (permite «Continuar de todos modos» con force=true). */
export function advertenciasDe(e: unknown): string[] | null {
  const err = e as Partial<ApiCallError>;
  return err?.status === 422 && err.warnings?.length ? err.warnings : null;
}

/** 409: el registro cambió en el servidor (el llamador debe recargar). */
export const esConflicto = (e: unknown) => (e as Partial<ApiCallError>)?.status === 409;

/** Mensaje legible para el usuario (403 sin permiso, 409 conflicto, 422 advertencias, red caída). */
export function mensajeErrorDocumento(e: unknown, descarga = false): string {
  const err = e as Partial<ApiCallError>;
  if (typeof err?.status !== 'number') return 'Sin conexión con el servidor: el archivo no se subió. Verifica tu red e inténtalo de nuevo.';
  if (err.status === 403) return 'No tienes permiso para realizar esta acción con documentos.';
  if (err.status === 401) return 'Tu sesión expiró. Inicia sesión nuevamente.';
  if (err.status === 409) return 'El registro cambió, recargando…';
  if (descarga && (err.status === 404 || err.status >= 500)) {
    return 'El archivo no está disponible para descarga (puede ser un documento de demostración sin archivo real).';
  }
  if (err.status === 422) {
    const w = err.warnings?.length ? ` ${err.warnings.join(' · ')}` : '';
    return `${err.message ?? 'Datos no válidos.'}${w}`;
  }
  return err.message || 'Error inesperado.';
}

/** Versión más reciente (el API entrega versions[] en orden descendente; el mock en ascendente). */
export function ultimaVersion(d: Pick<Document, 'versions'>): DocumentVersion | undefined {
  return (d.versions ?? []).reduce<DocumentVersion | undefined>((m, x) => (!m || x.v > m.v ? x : m), undefined);
}
