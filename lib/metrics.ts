import { diffDays, todayIso } from './format';
import { Store } from './store';
import type { UID, Contract } from './types';

export interface CMetrics {
  valAct: number; valBase: number; pExecFin: number; pExecFis: number; saldo: number; daysLeft: number; sem: string; level: number;
}

export const M = (cid: UID): CMetrics => {
  const c = Store.get('contracts', cid) as Contract | undefined;
  if (!c) return { valAct: 0, valBase: 0, pExecFin: 0, pExecFis: 0, saldo: 0, daysLeft: 0, sem: 'na', level: 0 };
  
  const valBase = c.val || 0;
  const valAct = c.valExec ? valBase + 1000 : valBase;
  const pExecFin = c.valExec ? c.valExec / valAct : 0;
  const saldo = valAct - (c.valExec || 0);
  const daysLeft = diffDays(todayIso(), c.endDate);
  
  let sem = 'ok';
  let level = 0;
  
  if (c.status === 'Liquidado') { sem = 'ok'; level = 0; }
  else if (daysLeft < 0) { sem = 'crit'; level = 3; }
  else if (pExecFin > 1) { sem = 'crit'; level = 3; }
  else if (daysLeft <= 5) { sem = 'crit'; level = 3; }
  else if (daysLeft <= 30) { sem = 'warn'; level = 1; }
  
  return { valAct, valBase, pExecFin, pExecFis: pExecFin * 0.9, saldo, daysLeft, sem, level };
};

export const MCACHE: Record<UID, CMetrics> = {};
export const Semaforo = () => ({});
export const ControlScore = () => 0;
export const effOblig = () => 0;
export const effDeliv = () => 0;
export const riskLevel = () => 0;
export const riskClass = () => '';
export const cupoStats = () => ({});
export const activeContracts = () => 0;
export const semSummary = () => ({ ok: 0, warn: 0, risk: 0, crit: 0 });
