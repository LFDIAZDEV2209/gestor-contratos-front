import type { Risk } from '@/lib/types';
/** Adaptador de lectura: no modifica los datos ni los motores de negocio. */
export function riskPresentation(risk: Risk): Risk {
  return { ...risk, prob: risk.prob ?? risk.probabilidad, probabilidad: risk.probabilidad ?? risk.prob, riesgo: risk.riesgo || risk.descripcion || 'Sin descripción', descripcion: risk.descripcion || risk.riesgo || 'Sin descripción' };
}
export function riskScore(risk: Risk): number | null {
  const p = risk.prob ?? risk.probabilidad;
  const i = risk.impacto;
  return p != null && i != null && p >= 1 && p <= 5 && i >= 1 && i <= 5 ? p * i : null;
}
