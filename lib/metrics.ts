import type { UID } from './types';

export interface CMetrics {
  valAct: number;
  valBase: number;
  pExecFin: number;
  pExecFis: number;
  saldo: number;
  daysLeft: number;
  sem: string;
  level: number;
}

export const MCACHE: Record<UID, CMetrics> = {};

export const M = (cid: UID): CMetrics => ({
  valAct: 150000000,
  valBase: 100000000,
  pExecFin: 0.33,
  pExecFis: 0.4,
  saldo: 100000000,
  daysLeft: 120,
  sem: 'ok',
  level: 0
});

export const Semaforo = () => ({});
export const ControlScore = () => 0;
export const effOblig = () => 0;
export const effDeliv = () => 0;
export const riskLevel = () => 0;
export const riskClass = () => '';
export const cupoStats = () => ({});
export const activeContracts = () => 0;
export const semSummary = () => ({ ok: 0, warn: 0, risk: 0, crit: 0 });
