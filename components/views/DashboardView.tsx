'use client';

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

  // Semáforo levels
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
          position: 'right' as const,
          labels: { boxWidth: 12, font: { size: 11 } }
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
    Activo: '#0B6E68',
    Vencido: '#BE3A2E',
    Suspendido: '#C99A06',
    'En liquidación': '#2F6FA3',
    Liquidado: '#98A4A8',
    Terminado: '#6B7F86',
    Borrador: '#CBD4D6'
  };
  const chEstadoConfig = {
    type: 'doughnut' as const,
    data: {
      labels: estKeys,
      datasets: [
        {
          data: estKeys.map((k) => estGroups[k].length),
          backgroundColor: estKeys.map((k) => stateColorMap[k] || '#0B6E68')
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
          backgroundColor: '#0B6E68',
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
    ['16-30 d', 16, 30, '#C99A06'],
    ['31-60 d', 31, 60, '#0B6E68'],
    ['Vencidos', -99999, -1, '#6B7F86']
  ];
  const chVencConfig = {
    type: 'bar' as const,
    data: {
      labels: buckets.map((b) => b[0]),
      datasets: [
        {
          label: 'Contratos',
          data: buckets.map(
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
          ),
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
          backgroundColor: '#C9DCDA',
          borderRadius: 3
        },
        {
          label: 'Ejecutado',
          data: topContracts.map((c) => M(c).ejecutado),
          backgroundColor: '#0B6E68',
          borderRadius: 3
        }
      ]
    },
    options: {
      scales: {
        y: { type: 'logarithmic' as const }
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

  const chMesConfig = {
    type: 'line' as const,
    data: {
      labels: mk.map(monthLabel),
      datasets: [
        {
          label: 'Ejecutado',
          data: mk.map((k) => sum(exByMonth[k] || [], (e) => +e.valor || 0)),
          borderColor: '#0B6E68',
          backgroundColor: 'rgba(11,110,104,0.10)',
          fill: true,
          tension: 0.3,
          pointRadius: 3
        },
        {
          label: 'Pagado',
          data: mk.map((k) => sum(pyByMonth[k] || [], (p) => +p.bruto + (p.iva || 0))),
          borderColor: '#2F6FA3',
          borderDash: [5, 4],
          tension: 0.3,
          pointRadius: 2
        }
      ]
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
          backgroundColor: ['#7FBF93', '#D9C255', '#E49A52', '#D0543F'],
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
          backgroundColor: ['#1E8E4E', '#4E9A8F', '#2F6FA3', '#C99A06', '#D0691A', '#BE3A2E']
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
    <div className="view-content">
      {/* Header */}
      <div className="page-h">
        <div>
          <h2>Dashboard</h2>
          <p className="sub">Estado del portafolio contractual al {fdate(todayIso())}.</p>
        </div>
        <div
          className="legend"
          style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '12px' }}
        >
          {lvKeys.map((l) => (
            <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  backgroundColor: (LEVEL_COLOR as any)[l] || '#98A4A8'
                }}
              />
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
      </div>

      {/* Grid: Qué debo hacer hoy (66%) + Semáforo contractual (33%) */}
      <div className="grid g-21 mb">
        {/* Qué debo hacer hoy */}
        <div className="panel">
          <div className="panel-h">
            <h3>Qué debo hacer hoy</h3>
            <span className="sub">
              {T.length} frente{T.length === 1 ? '' : 's'} de trabajo
            </span>
          </div>
          <div style={{ padding: '8px 12px' }}>
            {T.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 12px', textAlign: 'center' }}>
                <p className="muted">No hay pendientes críticos para hoy.</p>
              </div>
            ) : (
              T.map((t, idx) => {
                const dotColor = (LEVEL_COLOR as any)[t.l] || '#98A4A8';
                return (
                  <div
                    key={idx}
                    className="todo"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      marginBottom: 6,
                      cursor: 'pointer',
                      fontSize: '12.5px'
                    }}
                    onClick={() => {
                      if (t.view) onNavigate?.(t.view, t.filterKey);
                      else if (t.a === 'agenda') onNavigate?.('agenda');
                      else if (t.a === 'contratos') onNavigate?.('contratos', t.filterKey);
                      else onNavigate?.(t.a);
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        backgroundColor: dotColor,
                        flexShrink: 0
                      }}
                    />
                    <span className="n" style={{ fontWeight: 700, minWidth: 20 }}>
                      {t.n}
                    </span>
                    <span className="x" style={{ flex: 1 }}>
                      {t.t}
                    </span>
                    <Icon name="chevron-right" />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Semáforo contractual */}
        <div className="panel">
          <div className="panel-h">
            <h3>Semáforo contractual</h3>
            <span className="sub">{P.n} contratos</span>
          </div>
          <div className="panel-b">
            <div className="chart-box sm" style={{ height: 210 }}>
              <Chart config={semDoughnut} />
            </div>
          </div>
        </div>
      </div>

      {/* Franja de 14 KPIs */}
      <div className="kpis mb">
        <div
          className="kpi-card"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigate?.('contratos')}
        >
          <div className="kpi-t">Total contratos</div>
          <div className="kpi-v">{P.n}</div>
          <div className="kpi-s">{P.act} activos</div>
        </div>

        <div
          className="kpi-card"
          style={{ cursor: 'pointer', borderLeft: '3px solid var(--ok)' }}
          onClick={() => onNavigate?.('contratos', 'activos')}
        >
          <div className="kpi-t">Contratos activos</div>
          <div className="kpi-v" style={{ color: 'var(--ok)' }}>
            {P.act}
          </div>
          <div className="kpi-s">{pct(P.n ? (P.act / P.n) * 100 : 0)} del total</div>
        </div>

        <div
          className="kpi-card"
          style={{ cursor: 'pointer', borderLeft: P.prox ? '3px solid var(--warn)' : 'none' }}
          onClick={() => onNavigate?.('agenda')}
        >
          <div className="kpi-t">Próximos a vencer</div>
          <div className="kpi-v" style={{ color: P.prox ? 'var(--warn)' : 'var(--ok)' }}>
            {P.prox}
          </div>
          <div className="kpi-s">En ≤ 30 días</div>
        </div>

        <div
          className="kpi-card"
          style={{ cursor: 'pointer', borderLeft: P.venc ? '3px solid var(--crit)' : 'none' }}
          onClick={() => onNavigate?.('contratos', 'vencidos')}
        >
          <div className="kpi-t">Contratos vencidos</div>
          <div className="kpi-v" style={{ color: P.venc ? 'var(--crit)' : 'var(--ok)' }}>
            {P.venc}
          </div>
          <div className="kpi-s">Sin liquidar / prorrogar</div>
        </div>

        <div
          className="kpi-card"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigate?.('contratos', 'Suspendido')}
        >
          <div className="kpi-t">Suspendidos</div>
          <div className="kpi-v">{P.susp}</div>
          <div className="kpi-s">Con acta de suspensión</div>
        </div>

        <div
          className="kpi-card"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigate?.('contratos', 'En liquidación')}
        >
          <div className="kpi-t">En liquidación</div>
          <div className="kpi-v">{P.liq}</div>
          <div className="kpi-s">Pendientes de cierre</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-t">Valor total contratado</div>
          <div className="kpi-v">{moneyM(P.valor)}</div>
          <div className="kpi-s">{money(P.valor)}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-t">Valor ejecutado</div>
          <div className="kpi-v">{moneyM(P.ejec)}</div>
          <div className="kpi-s">{money(P.ejec)}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-t">Saldo contractual</div>
          <div className="kpi-v" style={{ color: P.saldo < 0 ? 'var(--crit)' : 'inherit' }}>
            {moneyM(P.saldo)}
          </div>
          <div className="kpi-s">{money(P.saldo)}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-t">% ejecución financiera</div>
          <div className="kpi-v" style={{ color: P.pctFin > 100 ? 'var(--crit)' : 'inherit' }}>
            {pct(P.pctFin)}
          </div>
          <div className="kpi-s">Ejecutado ÷ valor</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-t">% ejecución contractual</div>
          <div className="kpi-v">{pct(P.pctCont)}</div>
          <div className="kpi-s">Avance físico ponderado</div>
        </div>

        <div
          className="kpi-card"
          style={{ cursor: 'pointer', borderLeft: P.conAlerta ? '3px solid var(--risk)' : 'none' }}
          onClick={() => onNavigate?.('alertas')}
        >
          <div className="kpi-t">Contratos con alertas</div>
          <div className="kpi-v" style={{ color: P.conAlerta ? 'var(--risk)' : 'var(--ok)' }}>
            {P.conAlerta}
          </div>
          <div className="kpi-s">Alertas activas</div>
        </div>

        <div
          className="kpi-card"
          style={{ cursor: 'pointer', borderLeft: P.conInc ? '3px solid var(--risk)' : 'none' }}
          onClick={() => onNavigate?.('incumplimientos')}
        >
          <div className="kpi-t">Con incumplimientos</div>
          <div className="kpi-v" style={{ color: P.conInc ? 'var(--risk)' : 'var(--ok)' }}>
            {P.conInc}
          </div>
          <div className="kpi-s">Incumplimientos abiertos</div>
        </div>

        <div
          className="kpi-card"
          style={{ cursor: 'pointer', borderLeft: P.garProx ? '3px solid var(--warn)' : 'none' }}
          onClick={() => onNavigate?.('garantias', 'proximas')}
        >
          <div className="kpi-t">Garantías por vencer</div>
          <div className="kpi-v" style={{ color: P.garProx ? 'var(--warn)' : 'var(--ok)' }}>
            {P.garProx}
          </div>
          <div className="kpi-s">En los próximos 30 días</div>
        </div>
      </div>

      {/* Mapa de Colombia coroplético */}
      <MapaColombia
        onSelectContract={onSelectContract}
        onNavigateToContractsFilter={(k, v) => onNavigate?.('contratos', `${k}:${v}`)}
      />

      {/* Tarjetas: Contratos próximos a vencer */}
      {soon.length > 0 && (
        <div className="panel mb">
          <div className="panel-h">
            <h3>Contratos próximos a vencer</h3>
            <span className="sub">Alerta crítica a los {S.criticalDays} días</span>
          </div>
          <div className="panel-b grid g3">
            {soon.map((c) => {
              const m = M(c);
              const r = m.restantes ?? 0;
              const cl = r <= S.criticalDays ? 'crit' : r <= 15 ? 'risk' : 'warn';
              const dotColor = (LEVEL_COLOR as any)[cl] || '#BE3A2E';
              const pendOblig = Store.byContract('obligations', c.id).filter(
                (o) => effOblig(o) !== 'Cumplida'
              ).length;

              return (
                <div
                  key={c.id}
                  className="expcard"
                  style={{
                    border: '1px solid var(--border)',
                    borderLeft: `4px solid ${dotColor}`,
                    borderRadius: 6,
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    backgroundColor: 'var(--panel-bg, #fff)'
                  }}
                >
                  <div
                    className="row-flex"
                    style={{ justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span className="num" style={{ fontWeight: 700, fontSize: '13px' }}>
                      Contrato {c.numero}
                    </span>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: (LEVEL_COLOR as any)[m.nivel] || '#98A4A8',
                        color: '#fff',
                        fontWeight: 600
                      }}
                    >
                      {LEVEL_TXT[m.nivel]}
                    </span>
                  </div>

                  <div className="when" style={{ fontSize: '12px' }}>
                    {r === 0 ? (
                      <b style={{ color: 'var(--crit)' }}>Vence hoy.</b>
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
                    <button
                      className="btn xs"
                      onClick={() => onSelectContract?.(c.id, 'resumen')}
                    >
                      <Icon name="eye" /> Ver contrato
                    </button>
                    <button
                      className="btn xs"
                      onClick={() => onSelectContract?.(c.id, 'prorrogas')}
                    >
                      <Icon name="calendar" /> Crear prórroga
                    </button>
                    <button
                      className="btn xs"
                      onClick={() => onSelectContract?.(c.id, 'modificaciones')}
                    >
                      <Icon name="edit" /> Terminación
                    </button>
                    <button
                      className="btn xs"
                      onClick={() => onSelectContract?.(c.id, 'obligaciones')}
                    >
                      <Icon name="list-check" /> Obligaciones
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fila de 3 gráficas */}
      <div className="grid g3 mb">
        {/* Contratos por estado */}
        <div className="panel">
          <div className="panel-h">
            <h3>Contratos por estado</h3>
          </div>
          <div className="panel-b">
            <div className="chart-box" style={{ height: 210 }}>
              <Chart config={chEstadoConfig} />
            </div>
          </div>
        </div>

        {/* Contratos por empresa */}
        <div className="panel">
          <div className="panel-h">
            <h3>Contratos por empresa</h3>
          </div>
          <div className="panel-b">
            <div className="chart-box" style={{ height: 210 }}>
              <Chart config={chEmpConfig} />
            </div>
          </div>
        </div>

        {/* Vencimientos próximos */}
        <div className="panel">
          <div className="panel-h">
            <h3>Vencimientos próximos</h3>
          </div>
          <div className="panel-b">
            <div className="chart-box" style={{ height: 210 }}>
              <Chart config={chVencConfig} />
            </div>
          </div>
        </div>
      </div>

      {/* Fila de 2 gráficas grandes */}
      <div className="grid g2 mb">
        {/* Valor contratado vs ejecutado */}
        <div className="panel">
          <div className="panel-h">
            <h3>Valor contratado vs. ejecutado</h3>
            <span className="sub">Top contratos (escala logarítmica)</span>
          </div>
          <div className="panel-b">
            <div className="chart-box lg" style={{ height: 250 }}>
              <Chart config={chCvEConfig} />
            </div>
          </div>
        </div>

        {/* Ejecución mensual */}
        <div className="panel">
          <div className="panel-h">
            <h3>Ejecución mensual</h3>
            <span className="sub">Últimos 12 meses</span>
          </div>
          <div className="panel-b">
            <div className="chart-box lg" style={{ height: 250 }}>
              <Chart config={chMesConfig} />
            </div>
          </div>
        </div>
      </div>

      {/* Fila de 2 gráficas finales */}
      <div className="grid g2">
        {/* Riesgos por nivel */}
        <div className="panel">
          <div className="panel-h">
            <h3>Riesgos por nivel</h3>
          </div>
          <div className="panel-b">
            <div className="chart-box" style={{ height: 210 }}>
              <Chart config={chRiesgoConfig} />
            </div>
          </div>
        </div>

        {/* Cumplimiento de obligaciones */}
        <div className="panel">
          <div className="panel-h">
            <h3>Cumplimiento de obligaciones</h3>
          </div>
          <div className="panel-b">
            <div className="chart-box" style={{ height: 210 }}>
              <Chart config={chOblConfig} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
