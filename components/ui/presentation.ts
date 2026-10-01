import type { Risk, Obligation } from '@/lib/types';
/** Compatibilidad visual del checklist demo (t/done) con el formulario existente. */
export function obligationPresentation(obligation: Obligation): Obligation {
  return { ...obligation, checklist: obligation.checklist?.map((entry, index) => {
    const legacy = entry as typeof entry & { t?: string; done?: boolean };
    return { ...entry, id: entry.id || `${obligation.id}-check-${index}`, texto: entry.texto ?? legacy.t ?? '', listo: entry.listo ?? legacy.done ?? false };
  }) };
}
/** Adaptador de lectura: no modifica los datos ni los motores de negocio. */
export function riskPresentation(risk: Risk): Risk {
  return { ...risk, prob: risk.prob ?? risk.probabilidad, probabilidad: risk.probabilidad ?? risk.prob, riesgo: risk.riesgo || risk.descripcion || 'Sin descripción', descripcion: risk.descripcion || risk.riesgo || 'Sin descripción' };
}
export function riskScore(risk: Risk): number | null {
  const p = risk.prob ?? risk.probabilidad;
  const i = risk.impacto;
  return p != null && i != null && p >= 1 && p <= 5 && i >= 1 && i <= 5 ? p * i : null;
}
