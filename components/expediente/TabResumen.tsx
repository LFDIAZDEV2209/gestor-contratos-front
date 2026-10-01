'use client';
import { M } from '../../lib/metrics';
import { Store } from '../../lib/store';
import { money, moneyM, pct, fdate, clamp } from '../../lib/format';
import { Kpi } from '../ui/Kpi';
import { Chart } from '../ui/Chart';
import { Icon } from '../icons';
import { Badge } from '../ui/Badge';
import { LEVEL_TXT } from '../../lib/catalog';

export const TabResumen = ({ cid, onTabChange }: { cid: string; onTabChange?: (tab: string) => void }) => {
  const c = Store.get('contracts', cid);
  if (!c) return <div className="p-4 text-muted">Contrato no encontrado</div>;

  const m = M(c);
  const sc = m.score;
  const col = sc.total >= 85 ? 'var(--ok)' : sc.total >= 65 ? 'var(--warn)' : 'var(--crit)';

  const db = Store.getDB();
  const alertState = db.alertState || {};
  const al = (Store.all('audit') || []).filter((a) => a.contractId === c.id);

  // Ejecución mensual y acumulada para la gráfica
  const execs = Store.byContract('execs', c.id).sort((a, b) => (a.periodo < b.periodo ? -1 : 1));
  const labels = execs.map((e) => e.periodo);
  let acc = 0;
  const acumData = execs.map((e) => {
    acc += +e.valor || 0;
    return acc;
  });
  const mesData = execs.map((e) => +e.valor || 0);

  const chartData = {
    labels: labels.length ? labels : ['Sin datos'],
    datasets: [
      {
        type: 'line' as const,
        label: 'Acumulado',
        data: acumData,
        borderColor: '#2F6FA3',
        backgroundColor: 'rgba(47, 111, 163, 0.1)',
        yAxisID: 'y',
        tension: 0.2
      },
      {
        type: 'bar' as const,
        label: 'Ejecución mensual',
        data: mesData,
        backgroundColor: '#0B6E68',
        yAxisID: 'y',
        borderRadius: 4
      }
    ]
  };

  const chartOptions = {
    scales: {
      y: {
        ticks: {
          callback: (v: number) => moneyM(v)
        }
      }
    }
  };

  const reasons = m.razones || [];

  return (
    <div className="tab-resumen-container">
      {/* 1. KPIs FINANCIEROS */}
      <div className="section-head mb-2 mt-2">
        <h4 style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>FINANCIERO</h4>
      </div>
      <div className="kpis mb">
        <Kpi label="Valor inicial" value={moneyM(m.valorInicial)} sub={money(m.valorInicial)} />
        <Kpi
          label="Adiciones / reducciones"
          value={moneyM(Number(c.adiciones || 0) - Number(c.reducciones || 0))}
          sub={`+${money(c.adiciones)} / −${money(c.reducciones)}`}
        />
        <Kpi label="Valor actualizado" value={moneyM(m.valorActual)} sub={money(m.valorActual)} />
        <Kpi
          label="Valor ejecutado"
          value={moneyM(m.ejecutado)}
          sub={`${pct(m.pctFin)} financiero`}
          sem={m.pctFin > 100 ? 'crit' : null}
        />
        <Kpi label="Valor pagado" value={moneyM(m.pagado)} sub={`${m.pendientePago} pago(s) pendiente(s)`} />
        <Kpi
          label="Saldo"
          value={moneyM(m.saldo)}
          sub={`${pct(m.pctSaldo)} disponible`}
          sem={m.saldo < 0 ? 'crit' : m.pctSaldo < 15 ? 'risk' : null}
        />
      </div>

      {/* 2. KPIs FECHAS */}
      <div className="section-head mb-2">
        <h4 style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>FECHAS</h4>
      </div>
      <div className="kpis mb">
        <Kpi label="Fecha de firma" value={fdate(c.fechaFirma || c.signDate)} />
        <Kpi label="Fecha de inicio" value={fdate(c.fechaInicio || c.startDate)} />
        <Kpi
          label="Fecha de terminación"
          value={fdate(c.fechaFin || c.endDate)}
          sub={c.hastaAgotar ? 'o hasta agotar recursos' : ''}
        />
        <Kpi label="Duración" value={`${m.duracion} días`} sub={`${m.meses} meses`} />
        <Kpi
          label="Días restantes"
          value={m.restantes == null ? '—' : m.restantes < 0 ? 'Vencido' : m.restantes}
          sub={m.estadoTemporal}
          sem={m.restantes != null && m.restantes <= 5 && m.activo ? 'crit' : m.estado === 'Vencido' ? 'crit' : null}
        />
        <Kpi label="% tiempo" value={pct(m.pctTiempo)} sub={`${m.transcurridos} días transcurridos`} />
      </div>

      {/* 3. KPIs CUMPLIMIENTO */}
      <div className="section-head mb-2">
        <h4 style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>CUMPLIMIENTO</h4>
      </div>
      <div className="kpis mb">
        <Kpi
          label="% ejecución física"
          value={pct(m.pctFis)}
          sub={`Brecha vs. fin: ${pct(Math.abs(m.pctFin - m.pctFis))}`}
          sem={m.pctFis > 100 ? 'crit' : null}
        />
        <Kpi
          label="Cumplimiento obligaciones"
          value={pct(m.pctCumpl)}
          sub={`${m.oblCumplidas} de ${m.oblTotal} cumplidas`}
          sem={m.oblVencidas ? 'risk' : 'ok'}
          onClick={() => onTabChange?.('obligaciones')}
        />
        <Kpi
          label="Obligaciones vencidas"
          value={m.oblVencidas}
          sem={m.oblVencidas ? 'crit' : 'ok'}
          onClick={() => onTabChange?.('obligaciones')}
        />
        <Kpi
          label="Garantías"
          value={m.garTotal}
          sub={
            m.garVencidas
              ? `${m.garVencidas} vencida(s)`
              : m.garMinDias != null
              ? `Próx. vencimiento en ${m.garMinDias} d`
              : 'Sin vencimientos'
          }
          sem={m.garVencidas ? 'crit' : null}
          onClick={() => onTabChange?.('garantias')}
        />
        <Kpi
          label="Incumplimientos abiertos"
          value={m.incAbiertos}
          sem={m.incAbiertos ? 'risk' : 'ok'}
          onClick={() => onTabChange?.('incumplimientos')}
        />
        <Kpi
          label="Riesgos altos"
          value={m.riesgosAltos}
          sub={`${m.riesgosTotal} identificados`}
          sem={m.riesgosAltos ? 'risk' : 'ok'}
          onClick={() => onTabChange?.('riesgos')}
        />
      </div>

      {/* 4. GRÁFICAS Y NIVEL DE CONTROL */}
      <div className="grid g-21 mb">
        <div className="panel">
          <div className="panel-h">
            <h3>Ejecución del contrato</h3>
            <span className="sub">Mensual y acumulado vs. valor actualizado</span>
          </div>
          <div className="panel-b" style={{ minHeight: 280 }}>
            <Chart type="bar" data={chartData} options={chartOptions} height={260} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>Nivel de control documental</h3>
            <span className="sub" title="Indicador interno de completitud del expediente. No califica al contratista.">
              <Icon name="info-circle" />
            </span>
          </div>
          <div className="panel-b">
            <div className="score flex items-center gap-4 mb-4">
              <div
                className="score-ring"
                style={{
                  background: `conic-gradient(${col} ${sc.total * 3.6}deg, var(--line-2) 0)`
                }}
              >
                <div>{sc.total}%</div>
              </div>
              <div className="small">
                Índice interno de control: <b>{sc.total}%</b>.
                <br />
                <span className="muted">Mide completitud y control, no el desempeño del contratista.</span>
              </div>
            </div>

            <div className="comps-list mt-3">
              {Object.keys(sc.comps).map((k) => {
                const val = clamp(sc.comps[k], 0, 100);
                const barColor = val >= 85 ? 'var(--ok)' : val >= 60 ? 'var(--warn)' : 'var(--crit)';
                return (
                  <div key={k} className="comp" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '12px' }}>
                    <span style={{ minWidth: 100 }}>{k}</span>
                    <div className="bar" style={{ flex: 1, height: 8, background: 'var(--line-2)', borderRadius: 4, overflow: 'hidden' }}>
                      <i style={{ display: 'block', width: `${val}%`, height: '100%', background: barColor }} />
                    </div>
                    <b style={{ minWidth: 28, textAlign: 'right' }}>{Math.round(val)}</b>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 5. FACTORES DEL SEMÁFORO Y DETALLES */}
      <div className="grid g2 mb">
        <div className="panel">
          <div className="panel-h">
            <h3>Factores del semáforo</h3>
            <span className="sub">{LEVEL_TXT[m.nivel]}</span>
          </div>
          <div className="panel-b">
            {reasons.map((r, i) => (
              <div key={i} className="row-flex" style={{ padding: '6px 0', alignItems: 'flex-start', borderBottom: '1px solid var(--line-2)' }}>
                <span className={`sem ${r.l}`} style={{ marginTop: 4, marginRight: 8 }}></span>
                <span className="small">{r.t}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>Documentos faltantes del expediente</h3>
            <button className="btn xs" onClick={() => onTabChange?.('documentos')}>
              Ver documentos
            </button>
          </div>
          <div className="panel-b">
            {m.docsFaltantes.length > 0 ? (
              <div className="alert-box warn">
                <Icon name="triangle-exclamation" />
                <div>
                  Faltan en el expediente los siguientes documentos requeridos:
                  <ul className="mt-1 list-disc pl-5">
                    {m.docsFaltantes.map((doc, i) => (
                      <li key={i}><b>{doc}</b></li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="empty">El expediente cuenta con todos los documentos requeridos.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
