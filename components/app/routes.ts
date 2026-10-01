/** Destinos de navegación. No mantiene estado ni interpreta hashes. */
export const contractHref = (id: string, tab?: string) =>
  `/contrato/${encodeURIComponent(id)}${tab ? '?tab=' + encodeURIComponent(tab) : ''}`;
export const companyHref = (id: string) => `/empresas/${encodeURIComponent(id)}`;
export const obligationHref = (id: string) => `/obligaciones/${encodeURIComponent(id)}`;

export function viewHref(view: string, filter?: string): string {
  const path = '/' + ({ dash: 'dashboard', contracts: 'contratos', settings: 'configuracion' }[view] || view);
  if (!filter) return path;
  const query = new URLSearchParams();
  if (path === '/contratos') {
    if (filter.startsWith('depto:')) query.set('depto', filter.slice(6));
    else if (filter.startsWith('reg:')) query.set('region', filter.slice(4));
    else if (filter === 'activos') query.set('estado', 'Activo');
    else if (['Activo', 'Vencido', 'Suspendido', 'En liquidación', 'Liquidado'].includes(filter)) query.set('estado', filter);
    else query.set('vista', filter);
  } else query.set('vista', filter);
  return `${path}?${query}`;
}
