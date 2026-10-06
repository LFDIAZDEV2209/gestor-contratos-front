// Motor de cálculo contractual 1:1 con el prototipo HTML y files/05
import type { Contract, CMetrics, UID, Obligation, Deliverable, Risk, Cupo, Guarantee } from './types';
import { Store } from './store';
import { diffDays, todayIso, addDays, clamp, sum, groupBy, fdate, pct, moneyM, money } from './format';
import { LEVEL, LEVEL_TXT, CLOSED_STATES } from './catalog';
import { DEPTOS } from './geo';

export let MCACHE: Record<UID, CMetrics> = {};

export function clearMetricsCache() {
  MCACHE = {};
}

export function effOblig(o: Obligation): string {
  if ((o.estado === 'Pendiente' || o.estado === 'En proceso') && o.fechaLimite && o.fechaLimite < todayIso()) {
    return 'Vencida';
  }
  return o.estado;
}

export function effDeliv(d: Deliverable): string {
  if (d.estado !== 'Aprobado' && d.estado !== 'Entregado' && d.estado !== 'Suspendido' && !d.fechaReal && d.fechaProg < todayIso()) {
    return 'Vencido';
  }
  return d.estado;
}

export function riskLevel(r: Risk | number): 'Extremo' | 'Alto' | 'Moderado' | 'Bajo' {
  const s = typeof r === 'number' ? r : (Number(r.prob ?? r.probabilidad ?? 0)) * (Number(r.impacto ?? 0));
  return s >= 15 ? 'Extremo' : s >= 10 ? 'Alto' : s >= 5 ? 'Moderado' : 'Bajo';
}

export function riskClass(s: number): string {
  return s >= 15 ? 'h4' : s >= 10 ? 'h3' : s >= 5 ? 'h2' : 'h1';
}

export function companyName(id?: UID): string {
  if (!id) return '—';
  const c = Store.get('companies', id);
  return c ? (c.razon || c.name || '—') : '—';
}

export function activeContracts(): Contract[] {
  return Store.all('contracts').filter((c) => !c.anulado);
}

export const LIVE_POL = ['Aprobada', 'Pendiente'];

export function cupoStats(cp: Cupo, excludeId?: UID) {
  const pol = Store.all('guarantees').filter((g) => {
    const c = Store.get('contracts', g.contractId);
    return g.cupoId === cp.id && LIVE_POL.indexOf(g.estado) >= 0 && g.id !== excludeId && c && !c.anulado;
  });
  const u = sum(pol, (g) => +g.valor || 0);
  const totalVal = +cp.valor || 0;
  return {
    polizas: pol,
    utilizado: u,
    disponible: totalVal - u,
    pct: totalVal ? (u / totalVal) * 100 : 0
  };
}

export function contractPolicies(c: Contract): Guarantee[] {
  return Store.byContract('guarantees', c.id).filter((g) => g.estado !== 'Anulada' && g.estado !== 'Rechazada');
}

export function contractInsurers(c: Contract): string[] {
  return contractPolicies(c)
    .map((g) => g.aseguradora)
    .filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);
}

export function shortAseg(n?: string): string {
  return String(n || '')
    .replace(/ S\.A\.?$| Seguros Generales$| Colombia Seguros$| Seguros Colombia$/, '')
    .replace('Seguros Generales Suramericana (SURA)', 'SURA')
    .replace('Confianza (Compañía Aseguradora de Fianzas)', 'Confianza');
}

export function M(cOrId: Contract | UID): CMetrics {
  let c: Contract | null = null;
  if (typeof cOrId === 'string') {
    c = Store.get('contracts', cOrId);
  } else {
    c = cOrId;
  }

  if (!c) {
    return {
      valorInicial: 0,
      valorActual: 0,
      ejecutado: 0,
      pagado: 0,
      pendientePago: 0,
      saldo: 0,
      pctFin: 0,
      pctFis: 0,
      duracion: 0,
      meses: 0,
      transcurridos: 0,
      restantes: 0,
      pctTiempo: 0,
      estado: 'na',
      activo: false,
      estadoTemporal: 'Sin fechas',
      oblTotal: 0,
      oblCumplidas: 0,
      oblVencidas: 0,
      pctCumpl: 0,
      entVencidos: 0,
      incAbiertos: 0,
      garTotal: 0,
      garVencidas: 0,
      garMinDias: null,
      riesgosAltos: 0,
      riesgosTotal: 0,
      docsFaltantes: [],
      docs: 0,
      subs: 0,
      promMensual: 0,
      mesesAgotar: null,
      fechaAgotar: null,
      agotaAntes: false,
      pctSaldo: 0,
      nivel: 'na',
      razones: [],
      score: { total: 0, comps: {} },
      sem: 'na',
      level: 0,
      valAct: 0,
      valBase: 0,
      pExecFin: 0,
      pExecFis: 0,
      daysLeft: 0
    };
  }

  if (MCACHE[c.id]) return MCACHE[c.id];

  const db = Store.getDB();
  const settings = db.settings || { criticalDays: 5, budgetPct: 15, gapPct: 20, catalogs: { docsRequeridos: ['Contrato', 'Propuesta', 'Garantías', 'Actas'] } };

  const valorBase = Number(c.valorBase ?? c.val ?? 0);
  const iva = Number(c.iva ?? 0);
  const otrosImp = Number(c.otrosImp ?? 0);
  const valorInicial = valorBase + iva + otrosImp;
  const adiciones = Number(c.adiciones ?? 0);
  const reducciones = Number(c.reducciones ?? 0);
  const valorActual = valorInicial + adiciones - reducciones;

  const ex = Store.byContract('execs', c.id);
  const ejecutado = sum(ex, (e) => Number(e.valor || 0));

  const pays = Store.byContract('payments', c.id);
  const pagado = sum(
    pays.filter((p) => p.estado === 'Pagado'),
    (p) => Number(p.bruto || 0) + Number(p.iva || 0)
  );
  const pendientePago = pays.filter((p) => p.estado === 'Pendiente' || p.estado === 'En revisión').length;

  const saldo = valorActual - ejecutado;
  const pctFin = valorActual > 0 ? (ejecutado / valorActual) * 100 : 0;
  const pctFis = Number(c.avanceFisico ?? 0);

  const fechaInicio = c.fechaInicio || c.startDate || '';
  const fechaFin = c.fechaFin || c.endDate || '';

  const duracion = fechaInicio && fechaFin ? diffDays(fechaInicio, fechaFin) + 1 : 0;
  const meses = duracion ? Math.round((duracion / 30.4) * 10) / 10 : 0;
  const transcurridos = fechaInicio ? clamp(diffDays(fechaInicio, todayIso()) + 1, 0, duracion || 0) : 0;
  const restantes = fechaFin ? diffDays(todayIso(), fechaFin) : null;
  const pctTiempo = duracion > 0 ? (transcurridos / duracion) * 100 : 0;

  const baseEstado = c.estado || c.status || 'Activo';
  const estado = c.anulado ? 'Anulado' : (baseEstado === 'Activo' && restantes != null && restantes < 0 ? 'Vencido' : baseEstado);
  const activo = estado === 'Activo';

  const estadoTemporal = !fechaInicio
    ? 'Sin fechas'
    : todayIso() < fechaInicio
    ? 'Por iniciar'
    : (restantes != null && restantes < 0)
    ? 'Plazo cumplido'
    : (restantes != null && restantes <= 30)
    ? 'Próximo a vencer'
    : 'En plazo';

  const obs = Store.byContract('obligations', c.id);
  const oblTotal = obs.length;
  const oblCumplidas = obs.filter((o) => o.estado === 'Cumplida').length;
  const oblVencidas = obs.filter((o) => {
    const e = effOblig(o);
    return e === 'Vencida' || e === 'Incumplida';
  }).length;
  const pctCumpl = obs.length ? sum(obs, (o) => +o.cumplimiento || 0) / obs.length : 0;

  const dels = Store.byContract('deliverables', c.id);
  const entVencidos = dels.filter((d) => effDeliv(d) === 'Vencido').length;

  const breaches = Store.byContract('breaches', c.id);
  const incAbiertos = breaches.filter((b) => b.estado !== 'Cerrado' && b.estado !== 'Subsanado').length;

  const gs = Store.byContract('guarantees', c.id).filter((g) => g.estado !== 'Anulada');
  const garTotal = gs.length;
  const garVencidas = CLOSED_STATES.indexOf(estado) >= 0
    ? 0
    : gs.filter((g) => g.estado === 'Aprobada' && g.fechaVenc < todayIso()).length;

  const gnext = gs
    .filter((g) => g.estado === 'Aprobada' && g.fechaVenc >= todayIso())
    .map((g) => diffDays(todayIso(), g.fechaVenc));
  const garMinDias = gnext.length ? Math.min(...gnext) : null;

  const rs = Store.byContract('risks', c.id).filter((r) => r.estado !== 'Cerrado');
  const riesgosAltos = rs.filter((r) => (+r.prob || 0) * (+r.impacto || 0) >= 10 && r.estado === 'Abierto').length;
  const riesgosTotal = rs.length;

  const docs = Store.byContract('documents', c.id).filter((d) => d.estado !== 'Anulado');
  const cats = docs.map((d) => d.categoria);
  const reqDocs = settings.catalogs?.docsRequeridos || ['Contrato', 'Propuesta', 'Garantías', 'Actas'];
  const docsFaltantes = reqDocs.filter((r: string) => cats.indexOf(r) < 0);

  const subs = Store.byContract('subcontracts', c.id).length;

  // Proyección de agotamiento
  const byP = groupBy(ex, (e) => e.periodo);
  const pKeys = Object.keys(byP).sort().slice(-3);
  const avg = pKeys.length
    ? sum(pKeys, (k) => sum(byP[k], (e) => +e.valor || 0)) / pKeys.length
    : 0;
  const promMensual = avg;
  const mesesAgotar = avg > 0 ? saldo / avg : null;
  const fechaAgotar = (avg > 0 && saldo > 0 && mesesAgotar != null)
    ? addDays(todayIso(), Math.round(mesesAgotar * 30.4))
    : (saldo <= 0 ? todayIso() : null);
  const agotaAntes = Boolean(activo && fechaAgotar && fechaFin && fechaAgotar < fechaFin);
  const pctSaldo = valorActual > 0 ? (saldo / valorActual) * 100 : 0;

  const semRes = SemaforoRaw(c, {
    valorInicial,
    valorActual,
    ejecutado,
    saldo,
    pctFin,
    pctFis,
    pctSaldo,
    agotaAntes,
    fechaAgotar,
    estado,
    activo,
    restantes,
    oblVencidas,
    incAbiertos,
    garVencidas,
    garMinDias,
    riesgosAltos,
    entVencidos,
    docsFaltantes
  }, settings);

  const score = ControlScoreRaw(c, {
    docsFaltantes,
    oblTotal,
    oblVencidas,
    pctFin,
    pctFis,
    garTotal,
    garVencidas
  }, settings);

  const m: CMetrics = {
    valorInicial,
    valorActual,
    ejecutado,
    pagado,
    pendientePago,
    saldo,
    pctFin,
    pctFis,
    duracion,
    meses,
    transcurridos,
    restantes,
    pctTiempo,
    estado,
    activo,
    estadoTemporal,
    oblTotal,
    oblCumplidas,
    oblVencidas,
    pctCumpl,
    entVencidos,
    incAbiertos,
    garTotal,
    garVencidas,
    garMinDias,
    riesgosAltos,
    riesgosTotal,
    docsFaltantes,
    docs: docs.length,
    subs,
    promMensual,
    mesesAgotar,
    fechaAgotar,
    agotaAntes,
    pctSaldo,
    nivel: semRes.nivel,
    razones: semRes.razones,
    score,
    // Aliases
    sem: semRes.nivel,
    level: LEVEL[semRes.nivel] || 0,
    valAct: valorActual,
    valBase: valorInicial,
    saldoRest: saldo,
    pExecFin: pctFin / 100,
    pExecFis: pctFis / 100,
    daysLeft: restantes ?? 0
  };

  MCACHE[c.id] = m;
  return m;
}

function SemaforoRaw(c: Contract, m: any, settings: any): { nivel: 'ok' | 'warn' | 'risk' | 'crit' | 'na'; razones: Array<{ l: string; t: string }> } {
  const r: Array<{ l: string; t: string }> = [];
  let lv: 'ok' | 'warn' | 'risk' | 'crit' | 'na' = 'ok';
  const S = settings || { criticalDays: 5, budgetPct: 15, gapPct: 20 };

  function up(l: 'ok' | 'warn' | 'risk' | 'crit' | 'na', txt: string) {
    r.push({ l, t: txt });
    if (LEVEL[l] > LEVEL[lv]) lv = l;
  }

  if (c.anulado) return { nivel: 'na', razones: [{ l: 'na', t: 'Contrato anulado.' }] };
  if (!c.fechaInicio || !c.fechaFin || !m.valorInicial) {
    return { nivel: 'na', razones: [{ l: 'na', t: 'Faltan fechas o valores para evaluar el contrato.' }] };
  }
  if (c.estado === 'Liquidado') return { nivel: 'ok', razones: [{ l: 'ok', t: 'Contrato liquidado y cerrado.' }] };

  if (m.estado === 'Vencido') {
    up('crit', `El plazo venció hace ${Math.abs(m.restantes)} días y el contrato sigue activo sin terminación ni prórroga.`);
  } else if (m.activo && m.restantes != null && m.restantes <= S.criticalDays) {
    up('crit', m.restantes === 0 ? 'El contrato vence hoy.' : `El contrato vence en ${m.restantes} ${m.restantes === 1 ? 'día.' : 'días.'}`);
  } else if (m.activo && m.restantes != null && m.restantes <= 15) {
    up('risk', `Vence en ${m.restantes} días.`);
  } else if (m.activo && m.restantes != null && m.restantes <= 30) {
    up('warn', `Vence en ${m.restantes} días.`);
  }

  if (m.pctFin > 100) {
    up('crit', `Ejecución financiera de ${pct(m.pctFin)}, superior al valor contractual.`);
  } else if (m.activo && m.pctSaldo < S.budgetPct) {
    up('risk', `Saldo disponible de ${pct(m.pctSaldo)} del valor actualizado.`);
  }

  if (m.agotaAntes && m.pctFin <= 100) {
    up('warn', `Al ritmo actual los recursos se agotan el ${fdate(m.fechaAgotar)}, antes del plazo.`);
  }

  if (m.pctFis > 100) {
    up('crit', 'Ejecución física registrada superior al 100%.');
  }

  const gap = m.pctFin - m.pctFis;
  if (m.activo && Math.abs(gap) > S.gapPct) {
    up('warn', `Diferencia de ${pct(Math.abs(gap))} entre ejecución financiera y física.`);
  }

  if (m.oblVencidas >= 3) {
    up('crit', `${m.oblVencidas} obligaciones vencidas o incumplidas.`);
  } else if (m.oblVencidas > 0) {
    up('risk', `${m.oblVencidas} ${m.oblVencidas === 1 ? 'obligación vencida.' : 'obligaciones vencidas.'}`);
  }

  if (m.incAbiertos > 0) {
    up('risk', `${m.incAbiertos} ${m.incAbiertos === 1 ? 'incumplimiento abierto.' : 'incumplimientos abiertos.'}`);
  }

  if (m.garVencidas > 0) {
    up('crit', `${m.garVencidas} ${m.garVencidas === 1 ? 'garantía vencida' : 'garantías vencidas'} con el contrato en curso.`);
  } else if (m.garMinDias != null && m.garMinDias <= 15 && m.activo) {
    up('warn', `Una garantía vence en ${m.garMinDias} días.`);
  }

  if (m.riesgosAltos > 0) {
    up('risk', `${m.riesgosAltos} ${m.riesgosAltos === 1 ? 'riesgo alto o extremo abierto.' : 'riesgos altos o extremos abiertos.'}`);
  }

  if (m.entVencidos > 0) {
    up('warn', `${m.entVencidos} ${m.entVencidos === 1 ? 'entregable vencido.' : 'entregables vencidos.'}`);
  }

  if (m.docsFaltantes.length) {
    up('warn', `Documentos faltantes: ${m.docsFaltantes.join(', ')}.`);
  }

  if (c.estado === 'Suspendido') {
    up('warn', 'Contrato suspendido.');
  }

  if (!r.length) {
    r.push({ l: 'ok', t: 'Sin novedades: plazo, recursos, obligaciones y garantías en orden.' });
  }

  r.sort((a, b) => LEVEL[b.l as keyof typeof LEVEL] - LEVEL[a.l as keyof typeof LEVEL]);
  return { nivel: lv, razones: r };
}

export function Semaforo(c: Contract, m?: CMetrics) {
  const metr = m || M(c);
  return { nivel: metr.nivel, razones: metr.razones };
}

export function semSummary(m: CMetrics): string {
  const top = (m.razones || [])
    .filter((x) => x.l === m.nivel)
    .map((x) => x.t.replace(/\.$/, ''));
  return (top.slice(0, 2).join(' y ') || 'Sin novedades') + '.';
}

function ControlScoreRaw(c: Contract, m: any, settings: any): { total: number; comps: Record<string, number> } {
  const req = (settings.catalogs?.docsRequeridos?.length) || 4;
  const pays = Store.byContract('payments', c.id);
  const risks = Store.byContract('risks', c.id);
  const audits = (Store.all('audit') || []).filter((a) => a.contractId === c.id);

  const comps: Record<string, number> = {
    'Documentación': Math.round(((req - (m.docsFaltantes?.length || 0)) / req) * 100),
    'Obligaciones': m.oblTotal ? Math.round(((m.oblTotal - m.oblVencidas) / m.oblTotal) * 100) : 50,
    'Ejecución': Store.byContract('execs', c.id).length
      ? (m.pctFin > 100 ? 40 : Math.round(100 - Math.min(60, Math.abs(m.pctFin - m.pctFis))))
      : 30,
    'Pagos': pays.length ? Math.round((pays.filter((p) => p.soporte).length / pays.length) * 100) : 60,
    'Garantías': m.garTotal ? Math.round(((m.garTotal - m.garVencidas) / m.garTotal) * 100) : 0,
    'Riesgos': risks.length ? Math.round((risks.filter((r) => r.mitigacion).length / risks.length) * 100) : 40,
    'Auditoría': audits.length >= 2 ? 100 : 60
  };

  const w: Record<string, number> = {
    'Documentación': 20,
    'Obligaciones': 20,
    'Ejecución': 15,
    'Pagos': 10,
    'Garantías': 15,
    'Riesgos': 10,
    'Auditoría': 10
  };

  let t = 0;
  for (const k in comps) {
    t += (clamp(comps[k], 0, 100) * w[k]) / 100;
  }
  return { total: Math.round(t), comps };
}

export function ControlScore(c: Contract, m?: CMetrics): { total: number; comps: Record<string, number> } {
  const metr = m || M(c);
  return metr.score;
}

export function portfolio() {
  const cs = activeContracts();
  const P = {
    cs,
    n: cs.length,
    act: 0,
    prox: 0,
    venc: 0,
    susp: 0,
    liq: 0,
    valor: 0,
    ejec: 0,
    saldo: 0,
    pagado: 0,
    conAlerta: 0,
    conInc: 0,
    garProx: 0,
    fis: 0,
    pctFin: 0,
    pctCont: 0,
    byLevel: { ok: 0, warn: 0, risk: 0, crit: 0, na: 0 } as Record<string, number>
  };

  const db = Store.getDB();
  // Claves de alertState con formato tipo|contractId|... (server y cliente):
  // contar contratos con al menos una alerta no resuelta (fix conAlerta=0)
  const contratosConAlerta = new Set<string>();
  const alertState = db.alertState || {};
  for (const [key, st] of Object.entries(alertState)) {
    const estado = (st as { estado?: string } | null)?.estado ?? 'Nueva';
    if (estado === 'Resuelta') continue;
    const cid = key.split('|')[1] ?? '';
    if (cid) contratosConAlerta.add(cid);
  }

  cs.forEach((c) => {
    const m = M(c);
    if (m.activo) P.act++;
    if (m.activo && m.restantes != null && m.restantes <= 30) P.prox++;
    if (m.estado === 'Vencido') P.venc++;
    if (m.estado === 'Suspendido') P.susp++;
    if (m.estado === 'En liquidación') P.liq++;

    P.valor += m.valorActual;
    P.ejec += m.ejecutado;
    P.pagado += m.pagado;
    P.saldo += m.saldo;
    P.fis += m.pctFis * m.valorActual;

    if (contratosConAlerta.has(c.id)) P.conAlerta++;
    if (m.incAbiertos) P.conInc++;
    P.byLevel[m.nivel] = (P.byLevel[m.nivel] || 0) + 1;
  });

  P.garProx = Store.all('guarantees').filter((g) => {
    const c = Store.get('contracts', g.contractId);
    if (!c || c.anulado) return false;
    const d = diffDays(todayIso(), g.fechaVenc);
    return g.estado === 'Aprobada' && d >= 0 && d <= 30 && CLOSED_STATES.indexOf(M(c).estado) < 0;
  }).length;

  P.pctFin = P.valor ? (P.ejec / P.valor) * 100 : 0;
  P.pctCont = P.valor ? P.fis / P.valor : 0;
  return P;
}

export function todayTasks() {
  const cs = activeContracts();
  const T: Array<{ n: number; t: string; l: 'crit' | 'risk' | 'warn' | 'ok'; a: string; filterKey?: string; view?: string }> = [];
  const db = Store.getDB();
  const S = db.settings || { criticalDays: 5, gapPct: 20 };

  const v5 = cs.filter((c) => {
    const m = M(c);
    return m.activo && m.restantes != null && m.restantes >= 0 && m.restantes <= S.criticalDays;
  }).length;

  const vv = cs.filter((c) => M(c).estado === 'Vencido').length;

  const ob = Store.all('obligations').filter((o) => {
    const c = Store.get('contracts', o.contractId);
    return c && !c.anulado && (effOblig(o) === 'Vencida' || effOblig(o) === 'Incumplida');
  }).length;

  const ga = Store.all('guarantees').filter((g) => {
    const d = diffDays(todayIso(), g.fechaVenc);
    const c = Store.get('contracts', g.contractId);
    return c && g.estado === 'Aprobada' && d >= 0 && d <= 15 && CLOSED_STATES.indexOf(M(c).estado) < 0;
  }).length;

  const pg = Store.all('payments').filter((p) => p.estado === 'Pendiente' || p.estado === 'En revisión').length;

  const gap = cs.filter((c) => {
    const m = M(c);
    return m.activo && m.pctFin - m.pctFis > S.gapPct;
  }).length;

  const fin = cs.filter((c) => M(c).pctFin > 100).length;

  const doc = cs.filter((c) => {
    const m = M(c);
    return m.docsFaltantes.length && m.estado !== 'Liquidado';
  }).length;

  const inc = Store.all('breaches').filter((b) => b.estado !== 'Cerrado' && b.estado !== 'Subsanado').length;

  if (v5) T.push({ n: v5, t: v5 === 1 ? `contrato vence en los próximos ${S.criticalDays} días.` : `contratos vencen en los próximos ${S.criticalDays} días.`, l: 'crit', a: 'agenda', view: 'agenda' });
  if (vv) T.push({ n: vv, t: vv === 1 ? 'contrato tiene el plazo vencido sin terminación ni prórroga.' : 'contratos tienen el plazo vencido sin terminación ni prórroga.', l: 'crit', a: 'contratos', filterKey: 'vencidos' });
  if (fin) T.push({ n: fin, t: fin === 1 ? 'contrato tiene ejecución superior al valor contratado.' : 'contratos tienen ejecución superior al valor contratado.', l: 'crit', a: 'contratos', filterKey: 'sobreejec' });
  if (ob) T.push({ n: ob, t: ob === 1 ? 'obligación está vencida o incumplida.' : 'obligaciones están vencidas o incumplidas.', l: 'risk', a: 'obligaciones', filterKey: 'vencidas', view: 'obligaciones' });
  if (ga) T.push({ n: ga, t: ga === 1 ? 'garantía vence en los próximos 15 días.' : 'garantías vencen en los próximos 15 días.', l: 'warn', a: 'garantias', filterKey: 'proximas', view: 'garantias' });
  if (pg) T.push({ n: pg, t: pg === 1 ? 'pago está pendiente o en revisión.' : 'pagos están pendientes o en revisión.', l: 'warn', a: 'pagos', filterKey: 'pendientes', view: 'pagos' });
  if (gap) T.push({ n: gap, t: gap === 1 ? 'contrato tiene ejecución financiera superior a la física.' : 'contratos tienen ejecución financiera superior a la física.', l: 'warn', a: 'contratos', filterKey: 'gap' });
  if (inc) T.push({ n: inc, t: inc === 1 ? 'incumplimiento sigue abierto.' : 'incumplimientos siguen abiertos.', l: 'risk', a: 'incumplimientos', view: 'incumplimientos' });
  if (doc) T.push({ n: doc, t: doc === 1 ? 'contrato requiere actualización documental.' : 'contratos requieren actualización documental.', l: 'warn', a: 'contratos', filterKey: 'docs' });

  return T;
}

export function mapData(filters?: { estado?: string; empresa?: string; aseg?: string; metric?: string; medida?: string }) {
  const D: Record<string, { contratos: Contract[]; polizas: Guarantee[]; clientes: Record<string, string>; valorC: number; valorP: number }> = {};
  Object.keys(DEPTOS).forEach((k) => {
    D[k] = { contratos: [], polizas: [], clientes: {}, valorC: 0, valorP: 0 };
  });

  const flt = filters || {};
  const cs = activeContracts().filter((c) => {
    const m = M(c);
    const passEstado = !flt.estado || (flt.estado === 'activos' ? (m.activo || m.estado === 'Vencido') : m.estado === flt.estado);
    const passEmpresa = !flt.empresa || c.companyId === flt.empresa;
    const passAseg = !flt.aseg || contractInsurers(c).indexOf(flt.aseg) >= 0;
    return passEstado && passEmpresa && passAseg;
  });

  cs.forEach((c) => {
    const m = M(c);
    const pols = contractPolicies(c).filter((g) => !flt.aseg || g.aseguradora === flt.aseg);
    (c.deptos || ['08']).forEach((d) => {
      const x = D[d];
      if (!x) return;
      x.contratos.push(c);
      x.valorC += m.valorActual;
      if (c.nitContratista) x.clientes[c.nitContratista] = c.contratista;
      pols.forEach((g) => {
        x.polizas.push(g);
        x.valorP += +g.valor || 0;
      });
    });
  });

  const allFilteredPols = cs.flatMap((c) => contractPolicies(c).filter((g) => !flt.aseg || g.aseguradora === flt.aseg));
  const tot = {
    contratos: cs.length,
    polizas: allFilteredPols.length,
    clientes: Object.keys(groupBy(cs, (c) => c.nitContratista)).length
  };

  return { D, cs, tot };
}
