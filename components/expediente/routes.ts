/** Rutas hijas del expediente. Convención de `mapa-modal-a-vista.md`: `/contrato/[id]/<recurso>…`. */
export const expHref = (cid: string, path: string) =>
  `/contrato/${encodeURIComponent(cid)}/${path}`;

/** Alta de un recurso hijo: `/contrato/[id]/<recurso>/nueva`. */
export const nuevoHref = (cid: string, recurso: string) => expHref(cid, `${recurso}/nueva`);

/** Edición de un recurso hijo: `/contrato/[id]/<recurso>/<childId>/editar`. */
export const editarHref = (cid: string, recurso: string, childId: string) =>
  expHref(cid, `${recurso}/${encodeURIComponent(childId)}/editar`);

/** Ruta propia de una actuación con segmento final fijo (ej. `entrega/editar`). */
export const editarEnHref = (cid: string, recurso: string, childId: string, tramo: string) =>
  expHref(cid, `${recurso}/${encodeURIComponent(childId)}/${tramo}`);
