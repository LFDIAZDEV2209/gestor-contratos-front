'use client';
import { Button } from '../ui/button';
import { PageHeader, Surface, EmptyState } from '../ui/Workspace';

import React from 'react';
import { Store } from '@/lib/store';
import {
  M,
  portfolio,
  todayTasks,
  companyName,
  riskLevel,
  effOblig
} from '@/lib/metrics';
import {
  fdate,
  money,
  moneyM,
  pct,
  todayIso,
  groupBy,
  sum,
  monthKey,
  monthLabel,
  lastMonths
} from '@/lib/format';
import { LEVEL_COLOR, LEVEL_TXT, CLOSED_STATES } from '@/lib/catalog';
import { Icon } from '../icons';
import { Chart } from '../ui/Chart';
import { Kpi } from '../ui/Kpi';
import { SectionHeader } from '../ui/SectionHeader';
import { Badge } from '../ui/Badge';
import { MapaColombia } from '../mapa/MapaColombia';
import type { Contract, Obligation, Risk, Payment, Exec } from '@/lib/types';

interface DashboardViewProps {
  onSelectContract?: (cid: string, tab?: string) => void;
  onNavigate?: (v: string, filter?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onSelectContract,
  onNavigate
}) => {
  const P = portfolio();
  const T = todayTasks();
  const db = Store.getDB();
  const S = db.settings || { criticalDays: 5, alertDays: [30, 15, 10, 5, 3, 1] };

  // Abreviatura monetaria para ejes de gráficas (coherente con moneyM de lib/format)
  const moneyShort = (v: unknown): string => {
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''));
    if (!isFinite(n) || n === 0) return '0';
    const abs = Math.abs(n);
    const f = (x: number, d: number) => x.toLocaleString('es-CO', { maximumFractionDigits: d });
    if (abs >= 1e12) return `${f(n / 1e12, 1)} B`;
    if (abs >= 1e9) return `${f(n / 1e9, 1)} mil M`;
    if (abs >= 1e6) return `${f(n / 1e6, 0)} M`;
    if (abs >= 1e3) return `${f(n / 1e3, 0)} k`;
    return f(n, 0);
  };

  // Niveles del semáforo
  const lvKeys = ['ok', 'warn', 'risk', 'crit', 'na'] as const;
  const semDoughnut = {
    type: 'doughnut' as const,
    data: {
      labels: ['Normal', 'Atención', 'Riesgo', 'Crítico', 'Sin información'],
      datasets: [
        {
          data: lvKeys.map((l) => P.byLevel[l] || 0),
          backgroundColor: lvKeys.map((l) => (LEVEL_COLOR as any)[l] || '#98A4A8'),
          borderWidth: 2
        }
      ]
    },
    options: {
      cutout: '64%',
      plugins: {
        legend: {
          display: false
        }
      }
    }
  };

  // Contratos próximos a vencer (≤ 15 días)
  const soon = P.cs
    .filter((c) => {
      const m = M(c);
      return m.activo && m.restantes != null && m.restantes >= 0 && m.restantes <= 15;
    })
    .sort((a, b) => (M(a).restantes || 0) - (M(b).restantes || 0));

  // 1. Gráfica Contratos por Estado
  const estGroups = groupBy(P.cs, (c) => M(c).estado);
  const estKeys = Object.keys(estGroups);
  const stateColorMap: Record<string, string> = {
    Activo: '#062F58',
    Vencido: '#BE3A2E',
    Suspendido: '#B98B00',
    'En liquidación': '#2F6FA3',
    Liquidado: '#98A4A8',
    Terminado: '#5E6E73',
    Borrador: '#CBD4D6'
  };
  const chEstadoConfig = {
    type: 'doughnut' as const,
    data: {
      labels: estKeys,
      datasets: [
        {
          data: estKeys.map((k) => estGroups[k].length),
          backgroundColor: estKeys.map((k) => stateColorMap[k] || '#062F58')
        }
      ]
    },
    options: {
      cutout: '58%',
      plugins: {
        legend: { position: 'bottom' as const, labels: { boxWidth: 10, font: { size: 10.5 } } }
      }
    }
  };

  // 2. Gráfica Contratos por Empresa
  const byEmp = groupBy(P.cs, (c) => c.companyId);
  const empKeys = Object.keys(byEmp);
  const chEmpConfig = {
    type: 'bar' as const,
    data: {
      labels: empKeys.map((k) => {
        const n = companyName(k);
        return n.length > 22 ? n.slice(0, 22) + '...' : n;
      }),
      datasets: [
        {
          label: 'Contratos',
          data: empKeys.map((k) => byEmp[k].length),
          backgroundColor: '#062F58',
          borderRadius: 4
        }
      ]
    },
    options: {
      indexAxis: 'y' as const,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { precision: 0 } } }
    }
  };

  // 3. Gráfica Vencimientos próximos (Buckets)
  const buckets: [string, number, number, string][] = [
    ['Hoy', 0, 0, '#BE3A2E'],
    ['1-5 d', 1, 5, '#BE3A2E'],
    ['6-15 d', 6, 15, '#D0691A'],
    ['16-30 d', 16, 30, '#B98B00'],
    ['31-60 d', 31, 60, '#062F58'],
    ['Vencidos', -99999, -1, '#5E6E73']
  ];
  const bucketCounts = buckets.map(
    (b) =>
      P.cs.filter((c) => {
        const m = M(c);
        return (
          (m.activo || m.estado === 'Vencido') &&
          m.restantes != null &&
          m.restantes >= b[1] &&
          m.restantes <= b[2]
        );
      }).length
  );
  const chVencConfig = {
    type: 'bar' as const,
    data: {
      labels: buckets.map((b) => b[0]),
      datasets: [
        {
          label: 'Contratos',
          data: bucketCounts,
          backgroundColor: buckets.map((b) => b[3]),
          borderRadius: 4
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { ticks: { precision: 0 } } }
    }
  };

  // 4. Gráfica Valor Contratado vs. Ejecutado
  const topContracts = P.cs.slice().sort((a, b) => M(b).valorActual - M(a).valorActual).slice(0, 7);
  const chCvEConfig = {
    type: 'bar' as const,
    data: {
      labels: topContracts.map((c) => c.numero),
      datasets: [
        {
          label: 'Valor actualizado',
          data: topContracts.map((c) => M(c).valorActual),
          backgroundColor: 'rgba(6, 47, 88, 0.30)',
          borderRadius: 3
        },
        {
          label: 'Ejecutado',
          data: topContracts.map((c) => M(c).ejecutado),
          backgroundColor: '#062F58',
          borderRadius: 3
        }
      ]
    },
    options: {
      scales: {
        y: { type: 'logarithmic' as const, ticks: { callback: (v: string | number) => moneyShort(v) } }
      }
    }
  };

  // 5. Gráfica Ejecución Mensual (Últimos 12 meses)
  const mk = lastMonths(12);
  const execsList: Exec[] = Store.all('execs').filter((e) => {
    const c = Store.get('contracts', e.contractId);
    return c && !c.anulado;
  });
  const paysList: Payment[] = Store.all('payments').filter((p) => p.estado === 'Pagado');
  const exByMonth = groupBy(execsList, (e) => e.periodo);
  const pyByMonth = groupBy(paysList, (p) => monthKey(p.fechaPago || p.fecha));

  // Los meses al final de la serie sin movimientos se anulan (null) para que la
  // línea no "caiga" a cero en el mes en curso y confunda la lectura.
  const mesEjec = mk.map((k) => sum(exByMonth[k] || [], (e) => +e.valor || 0));
  const mesPaga = mk.map((k) => sum(pyByMonth[k] || [], (p) => +p.bruto + (p.iva || 0)));
  const nullTrailingZeros = (arr: number[]): (number | null)[] => {
    const out: (number | null)[] = arr.slice();
    for (let i = out.length - 1; i >= 0 && out[i] === 0; i--) out[i] = null;
    return out;
  };
  const mesHayDatos = mesEjec.some((v) => v > 0) || mesPaga.some((v) => v > 0);

  const chMesConfig = {
    type: 'line' as const,
    data: {
      labels: mk.map(monthLabel),
      datasets: [
        {
          label: 'Ejecutado',
          data: nullTrailingZeros(mesEjec),
          borderColor: '#062F58',
          backgroundColor: 'rgba(6, 47, 88,0.10)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          spanGaps: true
        },
        {
          label: 'Pagado',
          data: nullTrailingZeros(mesPaga),
          borderColor: '#2F6FA3',
          borderDash: [5, 4],
          tension: 0.3,
          pointRadius: 2,
          spanGaps: true
        }
      ]
    },
    options: {
      plugins: { legend: { position: 'bottom' as const } },
      scales: { y: { ticks: { callback: (v: string | number) => moneyShort(v) } } }
    }
  };

  // 6. Gráfica Riesgos por Nivel
  const rl = ['Bajo', 'Moderado', 'Alto', 'Extremo'];
  const risksList: Risk[] = Store.all('risks').filter((r) => r.estado !== 'Cerrado');
  const chRiesgoConfig = {
    type: 'bar' as const,
    data: {
      labels: rl,
      datasets: [
        {
          label: 'Abiertos',
          data: rl.map(
            (l) => risksList.filter((r) => riskLevel(r) === l && r.estado === 'Abierto').length
          ),
          backgroundColor: ['#1E8E4E', '#B98B00', '#D0691A', '#BE3A2E'],
          borderRadius: 4
        },
        {
          label: 'Controlados',
          data: rl.map(
            (l) => risksList.filter((r) => riskLevel(r) === l && r.estado === 'Controlado').length
          ),
          backgroundColor: '#C9D3D5',
          borderRadius: 4
        }
      ]
    },
    options: {
      scales: {
        x: { stacked: true },
        y: { stacked: true, ticks: { precision: 0 } }
      }
    }
  };

  // 7. Gráfica Cumplimiento de Obligaciones
  const ol = ['Cumplida', 'Cumplida parcialmente', 'En proceso', 'Pendiente', 'Vencida', 'Incumplida'];
  const obligationsList: Obligation[] = Store.all('obligations').filter((o) => {
    const c = Store.get('contracts', o.contractId);
    return c && !c.anulado;
  });
  const chOblConfig = {
    type: 'doughnut' as const,
    data: {
      labels: ol,
      datasets: [
        {
          data: ol.map((l) => obligationsList.filter((o) => effOblig(o) === l).length),
          backgroundColor: ['#1E8E4E', '#5CA6B2', '#2F6FA3', '#B98B00', '#D0691A', '#BE3A2E']
        }
      ]
    },
    options: {
      cutout: '58%',
      plugins: {
        legend: { position: 'right' as const, labels: { boxWidth: 10, font: { size: 10.5 } } }
      }
    }
  };

  return (
    <div className="view-content [&_.kpi-v]:text-balance [&_.kpi-l]:pr-3 motion-safe:[&_.btn]:hover:-translate-y-0.5 [&_.btn]:hover:shadow-[var(--shadow-2)]! [&_.btn]:focus-visible:shadow-[var(--shadow-2)]! motion-safe:[&_.btn]:[transition:translate_var(--t-fast)_var(--ease),box-shadow_var(--t-fast)_var(--ease),background-color_var(--t-fast)_var(--ease)]! motion-safe:[&_a]:hover:-translate-y-0.5 [&_a]:hover:shadow-[var(--shadow-1)]">
      {/* Cabecera con acciones elevadas; se conserva la navegación existente. */}
      <PageHeader variant="hero" className="page-h anim-fade-rise">
        <div>
          <nav className="crumb" aria-label="Ruta de navegación" style={{ marginBottom: 8 }}>
            <span>Seven Save</span>
            <Icon name="chevron-right" size={12} />
            <span aria-current="page">Dashboard</span>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                display: 'inline-grid',
                placeItems: 'center',
                background: 'rgba(255, 255, 255, 0.16)',
                backdropFilter: 'blur(6px)',
                flexShrink: 0
              }}
            >
              <Icon name="chart-pie" size={22} style={{ color: 'var(--color-primary-foreground, white)' }} />
            </span>
            <div>
              <h1 style={{ margin: 0 }}>Dashboard</h1>
              <p style={{ margin: '4px 0 0' }}>Estado del portafolio contractual al {fdate(todayIso())}.</p>
            </div>
          </div>
        </div>

        <div className="ph-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Button className="btn sm" onClick={() => onNavigate?.('agenda')} title="Ver agenda de vencimientos">
            <Icon name="calendar-days" /> Agenda
          </Button>
          <Button className="btn sm" onClick={() => onNavigate?.('gerencia')} title="Ir a control gerencial">
            <Icon name="chart-line" /> Gerencia
          </Button>
          <Button className="btn sm pri" onClick={() => onNavigate?.('contratos')} title="Explorar portafolio de contratos">
            <Icon name="folder" /> Contratos
          </Button>
        </div>

        <div
          className="legend"
          style={{ width: '100%', marginTop: 8, display: 'flex', alignItems: 'center', gap: 16, fontSize: '12px' }}
        >
          {lvKeys.map((l) => (
            <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className={`sem ${l}`} />
              {
                {
                  ok: 'Normal',
                  warn: 'Requiere atención',
                  risk: 'Riesgo',
                  crit: 'Crítico',
                  na: 'Sin información'
                }[l]
              }
            </span>
          ))}
        </div>
      </PageHeader>

      {/* Secciones semánticas: whitespace + divisores sutiles; los datos y la navegación no cambian. */}
      <div className="ws-stack">
        {/* 1. Panorama general (KPIs) */}
        <section className="ws-section ws-kpis anim-fade-rise" aria-labelledby="dash-sec-panorama">
          <SectionHeader
            id="dash-sec-panorama"
            icon="layers"
            title="Panorama general"
            description="Estado contractual, finanzas y control del portafolio."
            action={<span className="ws-section-meta">{P.n} contratos · {P.act} activos</span>}
          />
          <div className="kpi-group-title">
            <Icon name="folder" /> Estado contractual
          </div>
          <div className="kpis">
            <Kpi
              icon="folder"
              color="brand"
              label="Total contratos"
              value={P.n}
              sub={`${P.act} activos en portafolio`}
              className="anim-fade-rise motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5"
              style={{ animationDelay: '0ms' }}
              onClick={() => onNavigate?.('contratos')}
            />
            <Kpi
              icon="check-circle"
              label="Contratos activos"
              value={P.act}
              sub={`${pct(P.n ? (P.act / P.n) * 100 : 0)} del total`}
              sem="ok"
              className="anim-fade-rise motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5"
              style={{ animationDelay: '40ms' }}
              onClick={() => onNavigate?.('contratos', 'activos')}
            />
            <Kpi
              icon="clock"
              label="Próximos a vencer"
              value={P.prox}
              sub="En ≤ 30 días"
              sem={P.prox > 0 ? 'warn' : 'ok'}
              className="anim-fade-rise motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5"
              style={{ animationDelay: '80ms' }}
              onClick={() => onNavigate?.('agenda')}
            />
            <Kpi
              icon="alert-circle"
              label="Contratos vencidos"
              value={P.venc}
              sub="Sin liquidar / prorrogar"
              sem={P.venc > 0 ? 'crit' : 'ok'}
              className="anim-fade-rise motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5"
              style={{ animationDelay: '120ms' }}
              onClick={() => onNavigate?.('contratos', 'vencidos')}
            />
            <Kpi
              icon="pause"
              label="Suspendidos"
              value={P.susp}
              sub="Con acta de suspensión"
              sem={P.susp > 0 ? 'warn' : 'na'}
              className="anim-fade-rise motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5"
              style={{ animationDelay: '160ms' }}
              onClick={() => onNavigate?.('contratos', 'Suspendido')}
            />
            <Kpi
              icon="file-signature"
              color="na"
              label="En liquidación"
              value={P.liq}
              sub="Pendientes de cierre"
              className="anim-fade-rise motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5"
              style={{ animationDelay: '200ms' }}
              onClick={() => onNavigate?.('contratos', 'En liquidación')}
            />
          </div>

          {/* Grupo 2: Finanzas y Avance (5) */}
          <div className="kpi-group-title">
            <Icon name="dollar-sign" /> Finanzas y avance
          </div>
          <div className="kpis">
            <Kpi
              icon="dollar-sign"
              color="info"
              label="Valor contratado"
              value={moneyM(P.valor)}
              sub={money(P.valor)}
              className="anim-fade-rise motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5"
              style={{ animationDelay: '240ms' }}
              onClick={() => onNavigate?.('ejecucion')}
            />
            <Kpi
              icon="wallet"
              color="info"
              label="Valor ejecutado"
              value={moneyM(P.ejec)}
              sub={money(P.ejec)}
              className="anim-fade-rise motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5"
              style={{ animationDelay: '280ms' }}
              onClick={() => onNavigate?.('ejecucion')}
            />
            <Kpi
              icon="chart-pie"
              label="Saldo contractual"
              value={moneyM(P.saldo)}
              sub={money(P.saldo)}
              sem={P.saldo < 0 ? 'crit' : 'ok'}
              className="anim-fade-rise motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5"
              style={{ animationDelay: '320ms' }}
              onClick={() => onNavigate?.('ejecucion')}
            />
            <Kpi
              icon="trending-up"
              label="% Ejecución financiera"
              value={pct(P.pctFin)}
              sub="Ejecutado ÷ valor"
              sem={P.pctFin > 100 ? 'crit' : 'ok'}
              className="anim-fade-rise motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5"
              style={{ animationDelay: '360ms' }}
              onClick={() => onNavigate?.('ejecucion')}
            />
            <Kpi
              icon="list-check"
              label="% Ejecución contractual"
              value={pct(P.pctCont)}
              sub="Avance físico ponderado"
              color="info"
              className="anim-fade-rise motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5"
              style={{ animationDelay: '400ms' }}
              onClick={() => onNavigate?.('ejecucion')}
            />
          </div>

          {/* Grupo 3: Control y Riesgos (3) */}
          <div className="kpi-group-title">
            <Icon name="shield-alert" /> Control y riesgos
          </div>
          <div className="kpis">
            <Kpi
              icon="alert-triangle"
              label="Con alertas activas"
              value={P.conAlerta}
              sub="Requieren gestión"
              sem={P.conAlerta > 0 ? 'risk' : 'ok'}
              className="anim-fade-rise motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5"
              style={{ animationDelay: '440ms' }}
              onClick={() => onNavigate?.('alertas')}
            />
            <Kpi
              icon="circle-exclamation"
              label="Con incumplimientos"
              value={P.conInc}
              sub="Casos abiertos"
              sem={P.conInc > 0 ? 'risk' : 'ok'}
              className="anim-fade-rise motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5"
              style={{ animationDelay: '480ms' }}
              onClick={() => onNavigate?.('incumplimientos')}
            />
            <Kpi
              icon="shield"
              label="Garantías por vencer"
              value={P.garProx}
              sub="En los próximos 30 días"
              sem={P.garProx > 0 ? 'warn' : 'ok'}
              className="anim-fade-rise motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5"
              style={{ animationDelay: '520ms' }}
              onClick={() => onNavigate?.('garantias', 'proximas')}
            />
          </div>
        </section>

        {/* 2. Qué debo hacer hoy */}
        <section className="ws-section anim-fade-rise" aria-labelledby="dash-sec-hoy" style={{ animationDelay: '40ms' }}>
          <SectionHeader
            id="dash-sec-hoy"
            icon="clipboard-check"
            title="Qué debo hacer hoy"
            description={`${T.length} frente${T.length === 1 ? '' : 's'} de trabajo priorizados para hoy.`}
            action={
              <Button className="btn sm" onClick={() => onNavigate?.('agenda')} title="Ver agenda de vencimientos">
                <Icon name="calendar-days" /> Ver agenda
              </Button>
            }
          />
          <Surface className="panel">
            {T.length === 0 ? (
              <div className="ws-todo-empty">
                <EmptyState
                  title="Sin frentes de trabajo para hoy"
                  description="Cuando existan vencimientos, alertas o pendientes críticos aparecerán aquí para actuar con un clic."
                  action={
                    <Button className="btn sm pri" onClick={() => onNavigate?.('agenda')}>
                      <Icon name="calendar-days" /> Revisar agenda
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="ws-todo-list">
                {T.map((t, idx) => (
                  <button
                    type="button"
                    key={idx}
                    className="ws-todo-item anim-fade-rise"
                    style={{ animationDelay: `${idx * 40}ms` }}
                    onClick={() => {
                      if (t.view) onNavigate?.(t.view, t.filterKey);
                      else if (t.a === 'agenda') onNavigate?.('agenda');
                      else if (t.a === 'contratos') onNavigate?.('contratos', t.filterKey);
                      else onNavigate?.(t.a);
                    }}
                  >
                    <span className={`sem ${t.l}`} style={{ flexShrink: 0 }} />
                    <span className="n">{t.n}</span>
                    <span className="x">{t.t}</span>
                    <Icon name="chevron-right" />
                  </button>
                ))}
              </div>
            )}
          </Surface>
        </section>

        {/* 3. Semáforo contractual + mapa */}
        <section className="ws-section anim-fade-rise" aria-labelledby="dash-sec-semaforo" style={{ animationDelay: '80ms' }}>
          <SectionHeader
            id="dash-sec-semaforo"
            icon="chart-pie"
            title="Semáforo contractual"
            description="Distribución por nivel de alerta y presencia geográfica del portafolio."
            action={<span className="ws-section-meta">{P.n} contratos</span>}
          />
          <div className="ws-sem-map">
            <Surface className="panel">
              <SectionHeader
                as="h3"
                icon="shield-alert"
                title="Nivel de criticidad"
                description="Distribución del portafolio por nivel de riesgo"
              />
              <div className="ws-sem-card-body">
                <div className="chart-box sm" style={{ height: 230 }}>
                  {P.n > 0 ? (
                    <Chart config={semDoughnut} />
                  ) : (
                    <EmptyState
                      title="Sin contratos en el portafolio"
                      description="El semáforo contractual se dibujará en cuanto se registre el primer contrato."
                      action={
                        <Button className="btn sm pri" onClick={() => onNavigate?.('contratos')}>
                          <Icon name="folder" /> Ir a contratos
                        </Button>
                      }
                    />
                  )}
                </div>
                {P.n > 0 && (
                  <ul className="ws-sem-list" aria-label="Contratos por nivel del semáforo">
                    {lvKeys.map((l, i) => {
                      const n = P.byLevel[l] || 0;
                      const p = P.n ? (n / P.n) * 100 : 0;
                      return (
                        <li key={l}>
                          <span className={`sem ${l}`} />
                          <span className="ws-sem-lbl">{semDoughnut.data.labels[i]}</span>
                          <div className="ws-sem-bar-wrap" aria-hidden="true">
                            <div className={`ws-sem-bar sem-${l}`} style={{ width: `${Math.min(100, Math.max(p > 0 ? 4 : 0, p))}%` }} />
                          </div>
                          <span className="ws-sem-n">{n}</span>
                          <span className="ws-sem-p">{pct(p)}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {P.n > 0 && (
                  <div className="ws-sem-callouts">
                    <div
                      className="ws-sem-callout crit"
                      onClick={() => onNavigate?.('alertas')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') onNavigate?.('alertas'); }}
                      title="Ver contratos con alertas críticas"
                    >
                      <div className="ws-sem-callout-icon">
                        <Icon name="alert-triangle" size={18} />
                      </div>
                      <div className="ws-sem-callout-info">
                        <b>{P.byLevel.crit || 0} contratos en nivel crítico</b>
                        <span>Exigen atención inmediata o tienen alertas graves</span>
                      </div>
                      <Icon name="chevron-right" size={14} className="ws-sem-callout-arrow" />
                    </div>

                    <div
                      className="ws-sem-callout warn"
                      onClick={() => onNavigate?.('contratos', 'proximos')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') onNavigate?.('contratos', 'proximos'); }}
                      title="Ver contratos que requieren atención"
                    >
                      <div className="ws-sem-callout-icon">
                        <Icon name="clock" size={18} />
                      </div>
                      <div className="ws-sem-callout-info">
                        <b>{P.byLevel.warn || 0} contratos que requieren atención</b>
                        <span>Vencimiento próximo o trámites contractuales en curso</span>
                      </div>
                      <Icon name="chevron-right" size={14} className="ws-sem-callout-arrow" />
                    </div>

                    <div
                      className="ws-sem-callout ok"
                      onClick={() => onNavigate?.('contratos', 'activos')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') onNavigate?.('contratos', 'activos'); }}
                      title="Ver contratos en ejecución normal"
                    >
                      <div className="ws-sem-callout-icon">
                        <Icon name="check-circle" size={18} />
                      </div>
                      <div className="ws-sem-callout-info">
                        <b>{P.byLevel.ok || 0} contratos en ejecución normal</b>
                        <span>Cronograma y obligaciones al día sin novedades</span>
                      </div>
                      <Icon name="chevron-right" size={14} className="ws-sem-callout-arrow" />
                    </div>

                    <div className="ws-sem-action">
                      <Button className="btn sm block" onClick={() => onNavigate?.('alertas')}>
                        <Icon name="shield-alert" /> Gestionar alertas de riesgo
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Surface>

            <MapaColombia
              onSelectContract={onSelectContract}
              onNavigateToContractsFilter={(k, v) => onNavigate?.('contratos', `${k}:${v}`)}
            />
          </div>
        </section>

        {/* 4. Tendencias y evolución */}
        <section className="ws-section anim-fade-rise" aria-labelledby="dash-sec-tendencias" style={{ animationDelay: '120ms' }}>
          <SectionHeader
            id="dash-sec-tendencias"
            icon="trending-up"
            title="Tendencias y evolución"
            description="Evolución financiera y distribución del portafolio por estado, empresa y vencimiento."
          />
          {/* Primario: evolución financiera (2-up) */}
          <Surface className="panel">
            <div className="ws-split cols-2">
              <div className="ws-cell">
                <div className="ws-cell-h">
                  <h3 className="ws-cell-t">
                    <Icon name="dollar-sign" /> Valor contratado vs. ejecutado
                  </h3>
                  <p className="ws-cell-s">Top contratos (escala logarítmica)</p>
                </div>
                <div className="chart-box lg" style={{ height: 260 }}>
                  {topContracts.length > 0 ? (
                    <Chart config={chCvEConfig} />
                  ) : (
                    <EmptyState title="Sin contratos valorados" description="Aparecerá una comparación de valores cuando existan contratos registrados." />
                  )}
                </div>
              </div>
              <div className="ws-cell">
                <div className="ws-cell-h">
                  <h3 className="ws-cell-t">
                    <Icon name="trending-up" /> Ejecución mensual
                  </h3>
                  <p className="ws-cell-s">Últimos 12 meses</p>
                </div>
                <div className="chart-box lg" style={{ height: 260 }}>
                  {mesHayDatos ? (
                    <Chart config={chMesConfig} />
                  ) : (
                    <EmptyState title="Sin movimientos registrados" description="La serie mensual de ejecutado y pagado aparecerá al registrar ejecuciones o pagos." />
                  )}
                </div>
              </div>
            </div>
          </Surface>

          {/* Secundario: distribución del portafolio */}
          <Surface className="panel" style={{ marginTop: 24 }}>
            <div className="ws-split cols-3 secondary">
              <div className="ws-cell">
                <div className="ws-cell-h">
                  <h3 className="ws-cell-t">
                    <Icon name="chart-pie" /> Contratos por estado
                  </h3>
                </div>
                <div className="chart-box" style={{ height: 210 }}>
                  {estKeys.length > 0 ? (
                    <Chart config={chEstadoConfig} />
                  ) : (
                    <EmptyState title="Sin contratos" description="Aún no hay contratos clasificados por estado." />
                  )}
                </div>
              </div>
              <div className="ws-cell">
                <div className="ws-cell-h">
                  <h3 className="ws-cell-t">
                    <Icon name="building" /> Contratos por empresa
                  </h3>
                </div>
                <div className="chart-box" style={{ height: 210 }}>
                  {empKeys.length > 0 ? (
                    <Chart config={chEmpConfig} />
                  ) : (
                    <EmptyState title="Sin empresas asociadas" description="Asocia contratos a una empresa para ver su distribución." />
                  )}
                </div>
              </div>
              <div className="ws-cell">
                <div className="ws-cell-h">
                  <h3 className="ws-cell-t">
                    <Icon name="clock" /> Vencimientos próximos
                  </h3>
                </div>
                <div className="chart-box" style={{ height: 210 }}>
                  {bucketCounts.some((n) => n > 0) ? (
                    <Chart config={chVencConfig} />
                  ) : (
                    <EmptyState title="Sin vencimientos próximos" description="No hay contratos próximos a vencer ni vencidos sin liquidar." />
                  )}
                </div>
              </div>
            </div>
          </Surface>
        </section>

        {/* 5. Riesgos y cumplimiento */}
        <section className="ws-section anim-fade-rise" aria-labelledby="dash-sec-riesgos" style={{ animationDelay: '160ms' }}>
          <SectionHeader
            id="dash-sec-riesgos"
            icon="shield-alert"
            title="Riesgos y cumplimiento"
            description="Riesgos abiertos por nivel y estado de cumplimiento de las obligaciones."
            action={
              <>
                <Button className="btn sm" onClick={() => onNavigate?.('riesgos')} title="Ir al módulo de riesgos">
                  <Icon name="shield-alert" /> Ver riesgos
                </Button>
                <Button className="btn sm" onClick={() => onNavigate?.('obligaciones')} title="Ir al módulo de obligaciones">
                  <Icon name="list-check" /> Ver obligaciones
                </Button>
              </>
            }
          />
          <Surface className="panel">
            <div className="ws-split cols-2">
              <div className="ws-cell">
                <div className="ws-cell-h">
                  <h3 className="ws-cell-t">
                    <Icon name="alert-triangle" /> Riesgos por nivel
                  </h3>
                </div>
                <div className="chart-box" style={{ height: 220 }}>
                  {risksList.length > 0 ? (
                    <Chart config={chRiesgoConfig} />
                  ) : (
                    <EmptyState title="Sin riesgos abiertos" description="Los riesgos identificados en los contratos se mostrarán aquí por nivel." />
                  )}
                </div>
              </div>
              <div className="ws-cell">
                <div className="ws-cell-h">
                  <h3 className="ws-cell-t">
                    <Icon name="clipboard-check" /> Cumplimiento de obligaciones
                  </h3>
                </div>
                <div className="chart-box" style={{ height: 220 }}>
                  {obligationsList.length > 0 ? (
                    <Chart config={chOblConfig} />
                  ) : (
                    <EmptyState title="Sin obligaciones registradas" description="El cumplimiento de obligaciones contractuales se graficará aquí." />
                  )}
                </div>
              </div>
            </div>
          </Surface>
        </section>

        {/* 6. Contratos próximos a vencer (siempre visible, con estado vacío) */}
        <section className="ws-section anim-fade-rise" aria-labelledby="dash-sec-vencer" style={{ animationDelay: '200ms' }}>
          <SectionHeader
            id="dash-sec-vencer"
            icon="clock"
            title="Contratos próximos a vencer"
            description={`Vencen en 15 días o menos. Alerta crítica a los ${S.criticalDays} días.`}
            action={
              <Button className="btn sm" onClick={() => onNavigate?.('agenda')} title="Ver agenda de vencimientos">
                <Icon name="calendar-days" /> Ver agenda completa
              </Button>
            }
          />
          {soon.length === 0 ? (
            <Surface className="panel">
              <div className="panel-b">
                <EmptyState
                  title="Nada crítico en los próximos 15 días"
                  description="Ningún contrato activo vence dentro de los próximos 15 días. Revisa la agenda completa para ver vencimientos más lejanos."
                  action={
                    <Button className="btn sm pri" onClick={() => onNavigate?.('agenda')}>
                      <Icon name="calendar-days" /> Ver agenda completa
                    </Button>
                  }
                />
              </div>
            </Surface>
          ) : (
            <div className="ws-soon-grid">
            {soon.map((c, idx) => {
              const m = M(c);
              const r = m.restantes ?? 0;
              const cl = r <= S.criticalDays ? 'crit' : r <= 15 ? 'risk' : 'warn';
              const pendOblig = Store.byContract('obligations', c.id).filter(
                (o) => effOblig(o) !== 'Cumplida'
              ).length;

              return (
                <div
                  key={c.id}
                  className={`expcard ${cl} anim-fade-rise hover:shadow-[var(--shadow-3)]! focus-within:shadow-[var(--shadow-3)]! motion-safe:hover:-translate-y-1 motion-safe:focus-within:-translate-y-1`}
                  style={{
                    borderRadius: 'var(--r)',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    animationDelay: `${idx * 40}ms`,
                    transition: 'translate var(--t-med) var(--ease), box-shadow var(--t-med) var(--ease)'
                  }}
                >
                  <div
                    className="row-flex"
                    style={{ justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span className="num" style={{ fontWeight: 700, fontSize: '13px' }}>
                      Contrato {c.numero}
                    </span>
                    <Badge text={LEVEL_TXT[m.nivel]} color={m.nivel} />
                  </div>

                  <div className="when" style={{ fontSize: '12px' }}>
                    {r === 0 ? (
                      <b style={{ color: 'var(--crit-text)' }}>Vence hoy.</b>
                    ) : (
                      <span>
                        Faltan <b>{r} {r === 1 ? 'día' : 'días'}</b> para la terminación ({fdate(c.fechaFin)}).
                      </span>
                    )}
                    <div className="muted small" style={{ marginTop: 2 }}>
                      {c.contratista} · {pendOblig} obligaciones pendientes
                    </div>
                  </div>

                  <div
                    className="row-flex"
                    style={{ marginTop: 'auto', paddingTop: 6, gap: 4, flexWrap: 'wrap' }}
                  >
                    <Button
                      className="btn xs"
                      onClick={() => onSelectContract?.(c.id, 'resumen')}
                    >
                      <Icon name="eye" /> Ver contrato
                    </Button>
                    <Button
                      className="btn xs"
                      onClick={() => onSelectContract?.(c.id, 'prorrogas')}
                    >
                      <Icon name="calendar" /> Crear prórroga
                    </Button>
                    <Button
                      className="btn xs"
                      onClick={() => onSelectContract?.(c.id, 'modificaciones')}
                    >
                      <Icon name="edit" /> Terminación
                    </Button>
                    <Button
                      className="btn xs"
                      onClick={() => onSelectContract?.(c.id, 'obligaciones')}
                    >
                      <Icon name="list-check" /> Obligaciones
                    </Button>
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
