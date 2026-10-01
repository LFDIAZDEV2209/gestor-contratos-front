// Catálogos, permisos, roles y estados según files/02, files/08 y prototipo HTML

export const ROLES = [
  'ADMINISTRADOR',
  'CONTRATACIÓN',
  'JURÍDICA',
  'FINANCIERA',
  'SUPERVISOR',
  'INTERVENTOR',
  'AUDITOR',
  'CONSULTA'
];

export const PERMS = ['ver', 'crear', 'editar', 'aprobar', 'anular', 'exportar', 'auditar'] as const;
export type Perm = typeof PERMS[number];

export const PERM_LABEL: Record<string, string> = {
  ver: 'Ver',
  crear: 'Crear',
  editar: 'Editar',
  aprobar: 'Aprobar',
  anular: 'Eliminar (anular)',
  exportar: 'Exportar',
  auditar: 'Auditar'
};

export const defaultPerms = (): Record<string, Record<string, number>> => ({
  'ADMINISTRADOR': { ver: 1, crear: 1, editar: 1, aprobar: 1, anular: 1, exportar: 1, auditar: 1 },
  'CONTRATACIÓN':  { ver: 1, crear: 1, editar: 1, aprobar: 0, anular: 0, exportar: 1, auditar: 0 },
  'JURÍDICA':      { ver: 1, crear: 1, editar: 1, aprobar: 1, anular: 1, exportar: 1, auditar: 0 },
  'FINANCIERA':    { ver: 1, crear: 1, editar: 1, aprobar: 1, anular: 0, exportar: 1, auditar: 0 },
  'SUPERVISOR':    { ver: 1, crear: 1, editar: 1, aprobar: 1, anular: 0, exportar: 1, auditar: 0 },
  'INTERVENTOR':   { ver: 1, crear: 1, editar: 1, aprobar: 0, anular: 0, exportar: 1, auditar: 0 },
  'AUDITOR':       { ver: 1, crear: 0, editar: 0, aprobar: 0, anular: 0, exportar: 1, auditar: 1 },
  'CONSULTA':      { ver: 1, crear: 0, editar: 0, aprobar: 0, anular: 0, exportar: 0, auditar: 0 }
});

export const defaultCatalogs = (): Record<string, string[]> => ({
  tiposContrato: [
    'Prestación de servicios',
    'Prestación de servicios de salud',
    'Obra civil',
    'Suministro',
    'Consultoría',
    'Interventoría',
    'Mantenimiento',
    'Arrendamiento',
    'Transporte',
    'Tecnología y licenciamiento',
    'Compraventa',
    'Otro'
  ],
  modalidades: [
    'Contratación directa',
    'Invitación privada',
    'Invitación pública',
    'Convocatoria abierta',
    'Orden de compra',
    'Otra'
  ],
  estados: [
    'Borrador',
    'Activo',
    'Suspendido',
    'Terminado',
    'En liquidación',
    'Liquidado',
    'Anulado'
  ],
  tiposGarantia: [
    'Cumplimiento',
    'Calidad',
    'Responsabilidad civil',
    'Salarios y prestaciones',
    'Manejo de anticipo',
    'Estabilidad',
    'Seriedad de la oferta',
    'Todo riesgo',
    'Responsabilidad civil profesional',
    'Otros'
  ],
  aseguradoras: [
    'Seguros del Estado S.A.',
    'Seguros Generales Suramericana (SURA)',
    'Seguros Bolívar S.A.',
    'Mundial de Seguros S.A.',
    'Liberty Seguros S.A.',
    'Mapfre Seguros Generales',
    'Allianz Seguros S.A.',
    'AXA Colpatria Seguros',
    'La Previsora S.A.',
    'Chubb Seguros Colombia',
    'Aseguradora Solidaria de Colombia',
    'SBS Seguros Colombia',
    'HDI Seguros',
    'Zurich Colombia Seguros',
    'Confianza (Compañía Aseguradora de Fianzas)'
  ],
  tiposActa: [
    'Acta de inicio',
    'Acta parcial',
    'Acta de suspensión',
    'Acta de reinicio',
    'Acta de modificación',
    'Acta de recibo',
    'Acta de terminación',
    'Acta de liquidación'
  ],
  tiposObligacion: [
    'General',
    'Específica',
    'Financiera',
    'Técnica',
    'Legal',
    'Reporte / informe',
    'Seguridad social',
    'Calidad'
  ],
  categoriasRiesgo: [
    'Financiero',
    'Operativo',
    'Legal / regulatorio',
    'Técnico',
    'Cumplimiento',
    'Reputacional',
    'Seguridad de la información',
    'Proveedor'
  ],
  categoriasDoc: [
    'Contrato',
    'Estudios previos',
    'Propuesta',
    'Garantías',
    'Actas',
    'Facturas',
    'Informes',
    'Evidencias',
    'Modificaciones',
    'Prórrogas',
    'Suspensiones',
    'Liquidación',
    'Otros'
  ],
  docsRequeridos: [
    'Contrato',
    'Propuesta',
    'Garantías',
    'Actas'
  ],
  areas: [
    'Jurídica',
    'Financiera',
    'Compras',
    'Operaciones',
    'Tecnología',
    'Salud',
    'Gerencia',
    'Talento humano'
  ]
});

export const CLOSED_STATES = ['Terminado', 'En liquidación', 'Liquidado', 'Anulado'];

export const LEVEL = { na: 0, ok: 1, warn: 2, risk: 3, crit: 4 } as const;

export const LEVEL_TXT: Record<string, string> = {
  ok: 'NORMAL',
  warn: 'ATENCIÓN',
  risk: 'RIESGO',
  crit: 'CRÍTICO',
  na: 'SIN INFORMACIÓN'
};

export const LEVEL_COLOR: Record<string, string> = {
  ok: '#1E8E4E',
  warn: '#C99A06',
  risk: '#D0691A',
  crit: '#BE3A2E',
  na: '#98A4A8'
};

export const ALV: Record<string, { o: number; l: string; c: string; ic: string }> = {
  critica: { o: 4, l: 'Crítica', c: 'crit', ic: 'alert-circle' },
  riesgo:  { o: 3, l: 'Riesgo', c: 'risk', ic: 'alert-triangle' },
  proxima: { o: 2, l: 'Próxima', c: 'warn', ic: 'clock' },
  info:    { o: 1, l: 'Informativa', c: 'info', ic: 'info' }
};

export const STATE_BADGE: Record<string, string> = {
  'Activo': 'ok',
  'Activa': 'ok',
  'Borrador': 'na',
  'Firmada': 'ok',
  'Firmado': 'ok',
  'Suspendido': 'warn',
  'En liquidación': 'warn',
  'Terminado': 'na',
  'Liquidado': 'ok',
  'Anulado': 'crit',
  'Anulada': 'crit',
  'Inactiva': 'crit',
  'Vencido': 'crit',
  'Vencida': 'crit',
  'Pendiente': 'warn',
  'En proceso': 'info',
  'Cumplida': 'ok',
  'Cumplida parcialmente': 'warn',
  'Incumplida': 'crit',
  'Aprobada': 'ok',
  'Aprobado': 'ok',
  'Rechazada': 'crit',
  'Rechazado': 'crit',
  'Vigente': 'ok'
};export const CAT = (key: string): string[] => {
  const dc = defaultCatalogs();
  return (dc as any)[key] || [];
};
