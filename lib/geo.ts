export const DEPTOS: Record<string, [string, string]> = {
  'CUN': ['Cundinamarca', 'Centro'],
  'ANT': ['Antioquia', 'Occidente']
};
export const REGIONES = ['Centro', 'Occidente'];
export const deptoOpts = () => Object.entries(DEPTOS).map(([k,v]) => ({ val: k, lbl: v[0] }));
export const deptoNames = () => Object.fromEntries(Object.entries(DEPTOS).map(([k,v]) => [k, v[0]]));
