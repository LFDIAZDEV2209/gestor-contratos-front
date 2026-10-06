/** Semántica compartida de los campos de creación y edición. */
export function fieldIcon(name = '', label = '', type = ''): string {
  const key = `${name} ${label}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (type === 'search' || /buscar|busqueda/.test(key)) return 'search';
  if (/catalog/.test(key)) return 'layers';
  if (/comentario|observacion/.test(key)) return 'comment';
  if (/^(nit|numero|num$|poliza|referencia|version)/i.test(name)) return 'hash';
  if (/^(tipo|categoria|modalidad|naturaleza)/i.test(name)) return 'layers';
  if (type === 'email' || /email|correo/.test(key)) return 'envelope';
  if (type === 'tel' || /telefono|\btel\b|phone/.test(key)) return 'phone';
  if (['date', 'month', 'datetime-local'].includes(type) || /fecha|periodo|vence|vigencia/.test(key)) return 'calendar';
  if (/duracion|dias|plazo/.test(key)) return 'clock';
  if (/valor|monto|bruto|neto|\biva\b|retencion|reduccion|adicion|cupo|saldo|moneda|\bcur\b|multa/.test(key)) return 'wallet';
  if (/company|empresa|aseguradora|tomador|razon|sector/.test(key)) return 'building';
  if (/direccion|ciudad|ubicacion/.test(key)) return 'map-pin';
  if (/responsable|supervisor|representante|\brep\b|contratista|asignado|firmante|usuario|nombre completo/.test(key)) return 'user';
  if (/rol|permiso/.test(key)) return 'shield-check';
  if (/estado|status|verificado|cumplimiento/.test(key)) return 'clipboard-check';
  if (/brecha|gapPct|avance|porcentaje|probabilidad|impacto|nivel|riesgo/.test(key)) return 'gauge';
  if (/soporte|archivo|documento|factura/.test(key)) return 'file-text';
  if (/numero|\bnum\b|\bnit\b|identificacion|consecutivo|referencia|poliza|version/.test(key)) return 'hash';
  if (/contract|contrato/.test(key) && !/objeto|descripcion/.test(key)) return 'file-contract';
  if (/tipo|categoria|modalidad|naturaleza/.test(key)) return 'layers';
  return type === 'number' ? 'hash' : 'pen';
}
