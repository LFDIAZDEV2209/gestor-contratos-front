'use client';
import { Button } from '../ui/button';
import { PageHeader, Surface } from '../ui/Workspace';
import { useState } from 'react';
import type { Contract, Guarantee, Breach, Obligation, Exec, Payment } from '../../lib/types';
import { Store } from '../../lib/store';
import { M, portfolio, companyName } from '../../lib/metrics';
import { LEVEL, LEVEL_TXT } from '../../lib/catalog';
import { money, moneyM, pct, sum, diffDays, todayIso, monthKey, monthLabel, lastMonths, groupBy } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Chart } from '../ui/Chart';
import { Icon } from '../icons';

export const GerenciaView = ({
  onSelectContract
}: {
  onSelectContract: (cid: string) => void;
}) => {
  const P = portfolio();
  const allObligations = Store.all('obligations') as Obligation[];
  const allGuarantees = (Store.all('guarantees') as Guarantee[]).filter((g) => g.estado === 'Aprobada');
  const allBreaches = (Store.all('breaches') as Breach[]).filter(
    (b) => b.estado !== 'Cerrado' && b.estado !== 'Subsanado'
  );

  const riesgo = P.n ? (P.byLevel.crit * 100 + P.byLevel.risk * 60 + P.byLevel.warn * 25) / P.n : 0;
  const avgObl = allObligations.length
    ? sum(allObligations, (o) => Number(o.cumplimiento || 0)) / allObligations.length
    : 0;

  // Contracts requiring executive decision
  const criticalContracts = P.cs
    .filter((c) => {
      const m = M(c);
      return LEVEL[m.nivel] >= 3; // crit or risk
    })
    .sort((a, b) => {
      const ma = M(a);
      const mb = M(b);
      return LEVEL[mb.nivel] - LEVEL[ma.nivel] || mb.valorActual - ma.valorActual;
    });

  // Chart 1: Monthly Evolution (12 months accumulated)
  const mk = lastMonths(12);
  const execsByPeriod = groupBy(Store.all('execs') as Exec[], (e) => e.periodo);
  const paymentsByPeriod = groupBy(
    (Store.all('payments') as Payment[]).filter((p) => p.estado === 'Pagado'),
    (p) => monthKey(p.fechaPago || p.fecha)
  );

  let accExec = 0;
  let accPay = 0;
  const dataExecAcc = mk.map((k) => {
    accExec += sum(execsByPeriod[k] || [], (e) => Number(e.valor) || 0);
    return accExec;
  });
  const dataPayAcc = mk.map((k) => {
    accPay += sum(paymentsByPeriod[k] || [], (p) => (Number(p.bruto) || 0) + (Number(p.iva) || 0));
    return accPay;
  });

  const evoChartData = {
    labels: mk.map(monthLabel),
    datasets: [
      {
        label: 'Ejecutado acumulado',
        data: dataExecAcc,
        borderColor: '#0B6E68',
        backgroundColor: 'rgba(11,110,104,0.12)',
        fill: true,
        tension: 0.25
      },
      {
        label: 'Pagado acumulado',
        data: dataPayAcc,
        borderColor: '#2F6FA3',
        tension: 0.25
      }
    ]
  };

  // Chart 2: Guarantees status
  const now = todayIso();
  const gVigentes = allGuarantees.filter((g) => diffDays(now, g.fechaVenc) > 30).length;
  const gPorVencer = allGuarantees.filter((g) => {
    const d = diffDays(now, g.fechaVenc);
    return d >= 0 && d <= 30;
  }).length;
  const gVencidas = allGuarantees.filter((g) => diffDays(now, g.fechaVenc) < 0).length;

  const garChartData = {
    labels: ['Vigentes > 30 d', '≤ 30 días', 'Vencidas'],
    datasets: [
      {
        data: [gVigentes, gPorVencer, gVencidas],
        backgroundColor: ['#0B6E68', '#C99A06', '#BE3A2E']
      }
    ]
  };

  // Chart 3: Value by Company
  const byCompany = groupBy(P.cs, (c) => c.companyId);
  const companyKeys = Object.keys(byCompany);
  const companyLabels = companyKeys.map((k) => {
    const n = companyName(k);
    return n.length > 24 ? n.slice(0, 24) + '…' : n;
  });
  const companyValAct = companyKeys.map((k) => sum(byCompany[k], (c) => M(c).valorActual));
  const companyEjec = companyKeys.map((k) => sum(byCompany[k], (c) => M(c).ejecutado));

  const empChartData = {
    labels: companyLabels,
    datasets: [
      {
        label: 'Valor actualizado',
        data: companyValAct,
        backgroundColor: '#C9DCDA',
        borderRadius: 3
      },
      {
        label: 'Ejecutado',
        data: companyEjec,
        backgroundColor: '#0B6E68',
        borderRadius: 3
      }
    ]
  };

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      { l: 'Contrato', k: 'numero' },
      { l: 'Empresa', k: 'companyId', r: (c: any) => companyName(c.companyId) },
      { l: 'Contratista', k: 'contratista' },
      { l: 'Valor Actual', k: 'val', r: (c: any) => money(M(c).valorActual) },
      { l: 'Semáforo', k: 'sem', r: (c: any) => LEVEL_TXT[M(c).nivel] },
      {
        l: 'Razón principal',
        k: 'razon',
        r: (c: any) => M(c).razones.map((r) => r.t).join('; ')
      }
    ];
    exportRows('Control Gerencial - Contratos Críticos', cols, criticalContracts, format);
  };

  return (
    <div>
      {/* Page Header */}
      <PageHeader className="ph">
        <div>
          <h1>Control gerencial de contratos</h1>
          <p>Vista estratégica del portafolio contractual para la alta dirección</p>
        </div>
        <div className="ph-actions">
          <div className="exp-actions">
            <Button className="btn sm" onClick={() => handleExport('xlsx')} title="Exportar a Excel">
              <Icon name="file-excel" /> Excel
            </Button>
            <Button className="btn sm" onClick={() => handleExport('pdf')} title="Exportar a PDF">
              <Icon name="file-pdf" /> PDF
            </Button>
            <Button className="btn sm" onClick={() => handleExport('csv')} title="Exportar a CSV">
              <Icon name="file-csv" /> CSV
            </Button>
          </div>
        </div>
      </PageHeader>

      {/* Big Strip of 8 Executive Metrics */}
      <div className="bigstrip mb">
        <div>
          <div className="l">Total contratos</div>
          <div className="v">{P.n}</div>
          <div className="s">{P.act} activos</div>
        </div>
        <div>
          <div className="l">Valor administrado</div>
          <div className="v">{moneyM(P.valor)}</div>
          <div className="s">Valor actualizado</div>
        </div>
        <div>
          <div className="l">Valor ejecutado</div>
          <div className="v">{moneyM(P.ejec)}</div>
          <div className="s">{pct(P.pctFin)} del total</div>
        </div>
        <div>
          <div className="l">Saldo disponible</div>
          <div className="v">{moneyM(P.saldo)}</div>
          <div className="s">Por ejecutar</div>
        </div>
        <div>
          <div className="l">Riesgo contractual</div>
          <div className="v">
            {Math.round(riesgo)}
            <span style={{ fontSize: '13px', fontWeight: 400 }}>/100</span>
          </div>
          <div className="s">
            {P.byLevel.crit} críticos · {P.byLevel.risk} en riesgo
          </div>
        </div>
        <div>
          <div className="l">Vencimientos ≤ 30 d</div>
          <div className="v">{P.prox}</div>
          <div className="s">{P.venc} vencidos</div>
        </div>
        <div>
          <div className="l">Incumplimientos</div>
          <div className="v">{allBreaches.length}</div>
          <div className="s">Abiertos</div>
        </div>
        <div>
          <div className="l">Obligaciones</div>
          <div className="v">{pct(avgObl, 0)}</div>
          <div className="s">Cumplimiento promedio</div>
        </div>
      </div>

      {/* Row 1: Evolution Line & Guarantees Doughnut */}
      <div className="grid g-21 mb">
        <Surface className="panel">
          <div className="panel-h">
            <h3>Evolución mensual</h3>
            <span className="sub">Ejecución y pagos acumulados (últimos 12 meses)</span>
          </div>
          <div className="panel-b">
            <div className="chart-box lg" style={{ height: '260px' }}>
              <Chart type="line" data={evoChartData} />
            </div>
          </div>
        </Surface>

        <Surface className="panel">
          <div className="panel-h">
            <h3>Garantías</h3>
            <span className="sub">{allGuarantees.length} pólizas aprobadas</span>
          </div>
          <div className="panel-b">
            <div className="chart-box lg" style={{ height: '260px' }}>
              <Chart
                type="doughnut"
                data={garChartData}
                options={{ cutout: '65%' }}
              />
            </div>
          </div>
        </Surface>
      </div>

      {/* Row 2: Value by Company & Decision Needed List */}
      <div className="grid g2 mb">
        <Surface className="panel">
          <div className="panel-h">
            <h3>Valor por empresa</h3>
            <span className="sub">Distribución del portafolio contratado</span>
          </div>
          <div className="panel-b">
            <div className="chart-box lg" style={{ height: '280px' }}>
              <Chart
                type="bar"
                data={empChartData}
                options={{
                  indexAxis: 'y' as const,
                  scales: {
                    x: { ticks: { callback: (val: any) => moneyM(val) } }
                  }
                }}
              />
            </div>
          </div>
        </Surface>

        <Surface className="panel">
          <div className="panel-h">
            <div>
              <h3>Contratos que requieren decisión</h3>
              <span className="sub">Nivel crítico o de riesgo ({criticalContracts.length})</span>
            </div>
          </div>
          <div className="panel-b np" style={{ maxHeight: '310px', overflowY: 'auto' }}>
            {criticalContracts.map((c) => {
              const m = M(c);
              const reason = m.razones.filter((r) => r.l === m.nivel).map((r) => r.t).join(' ') || 'Requiere atención inmediata';
              return (
                <div
                  key={c.id}
                  className="todo"
                  onClick={() => onSelectContract(c.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className={`sem ${m.sem}`} style={{ marginTop: '2px' }}></span>
                  <div className="x">
                    <b>{c.numero}</b> · {companyName(c.companyId)}
                    <div className="small muted" style={{ marginTop: '2px' }}>
                      {reason}
                    </div>
                  </div>
                  <span className="small strong">{moneyM(m.valorActual)}</span>
                  <Icon name="chevron-right" />
                </div>
              );
            })}
            {criticalContracts.length === 0 && (
              <div className="empty p-4">Ningún contrato en nivel crítico o de riesgo.</div>
            )}
          </div>
        </Surface>
      </div>
    </div>
  );
};
