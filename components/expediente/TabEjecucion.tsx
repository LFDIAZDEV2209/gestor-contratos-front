'use client';
import { useState } from 'react';
import type { Exec } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { M } from '../../lib/metrics';
import { money, moneyM, pct, fdate, monthLabel, monthKey, sum, uid, todayIso, parseD, iso } from '../../lib/format';
import { Kpi } from '../ui/Kpi';
import { Chart } from '../ui/Chart';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const TabEjecucion = ({ cid }: { cid: string }) => {
  const [showNewModal, setShowNewModal] = useState(false);
  const [newExec, setNewExec] = useState({ periodo: '', valor: 0, avanceFisico: 0, obs: '' });

  const c = Store.get('contracts', cid);
  if (!c) return <div className="empty">Contrato no encontrado</div>;

  const m = M(c);
  const execs = (Store.byContract('execs', cid) as Exec[]).sort((a, b) =>
    a.periodo < b.periodo ? 1 : -1
  );

  // Series cronológicas para gráficas
  const chronoExecs = [...execs].sort((a, b) => (a.periodo < b.periodo ? -1 : 1));
  const keys = chronoExecs.map((e) => e.periodo);
  let acc = 0;
  const acum = chronoExecs.map((e) => {
    acc += +e.valor || 0;
    return acc;
  });
  const mes = chronoExecs.map((e) => +e.valor || 0);

  // 1. Chart exA: Contratado vs Ejecutado
  const chartAData = {
    labels: ['Inicial', 'Adiciones', 'Reducciones', 'Actualizado', 'Ejecutado', 'Pagado', 'Saldo'],
    datasets: [
      {
        data: [
          m.valorInicial,
          +c.adiciones || 0,
          +c.reducciones || 0,
          m.valorActual,
          m.ejecutado,
          m.pagado,
          m.saldo
        ],
        backgroundColor: [
          '#A3B8BC',
          '#4E9A8F',
          '#D0691A',
          '#2F6FA3',
          '#0B6E68',
          '#1E8E4E',
          m.saldo < 0 ? '#BE3A2E' : '#C99A06'
        ],
        borderRadius: 4
      }
    ]
  };

  // 2. Chart exB: Ejecución mensual
  const chartBData = {
    labels: keys.map(monthLabel),
    datasets: [
      {
        label: 'Ejecutado del mes',
        data: mes,
        backgroundColor: '#0B6E68',
        borderRadius: 3
      }
    ]
  };

  // 3. Chart exC: Pagos mensuales
  const pays = Store.byContract('payments', c.id);
  const payKeys = pays
    .map((p) => monthKey(p.fechaPago || p.fecha))
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .sort();

  const chartCData = {
    labels: payKeys.map(monthLabel),
    datasets: [
      {
        label: 'Pagado',
        data: payKeys.map((k) =>
          sum(
            pays.filter((p) => p.estado === 'Pagado' && monthKey(p.fechaPago || p.fecha) === k),
            (p) => +p.neto || 0
          )
        ),
        backgroundColor: '#1E8E4E',
        borderRadius: 3
      },
      {
        label: 'Pendiente / revisión',
        data: payKeys.map((k) =>
          sum(
            pays.filter(
              (p) =>
                (p.estado === 'Pendiente' || p.estado === 'En revisión' || p.estado === 'Aprobado') &&
                monthKey(p.fechaPago || p.fecha) === k
            ),
            (p) => +p.neto || 0
          )
        ),
        backgroundColor: '#C99A06',
        borderRadius: 3
      }
    ]
  };

  // 4. Chart exD: Saldo y proyección
  const projLabels = keys.map(monthLabel);
  const saldoData: Array<number | null> = acum.map((a) => m.valorActual - a);
  const projData: Array<number | null> = keys.map(() => null);

  if (m.promMensual > 0 && m.saldo > 0 && keys.length) {
    projData[projData.length - 1] = m.saldo;
    let sv = m.saldo;
    const lastKey = keys[keys.length - 1];
    const d = parseD(`${lastKey}-01`) || new Date();
    let g = 0;
    while (sv > 0 && g < 12) {
      d.setMonth(d.getMonth() + 1);
      sv = Math.max(0, sv - m.promMensual);
      projLabels.push(monthLabel(iso(d).slice(0, 7)));
      saldoData.push(null);
      projData.push(sv);
      g++;
    }
  }

  const chartDData = {
    labels: projLabels,
    datasets: [
      {
        label: 'Saldo real',
        data: saldoData,
        borderColor: '#0B6E68',
        backgroundColor: 'rgba(11,110,104,0.1)',
        fill: true,
        tension: 0.2
      },
      {
        label: 'Proyección agotamiento',
        data: projData,
        borderColor: '#BE3A2E',
        borderDash: [6, 4],
        tension: 0.2,
        spanGaps: true
      }
    ]
  };

  const moneyOptions = {
    scales: {
      y: {
        ticks: {
          callback: (v: number) => moneyM(v)
        }
      }
    }
  };

  const handleCreate = () => {
    if (!AuthService.guard('crear')) return;
    if (!newExec.periodo) return alert('Seleccione o ingrese el periodo (AAAA-MM)');
    if (!newExec.valor) return alert('Ingrese el valor ejecutado');

    const execObj: Exec = {
      id: uid('EX'),
      contractId: cid,
      periodo: newExec.periodo,
      valor: Number(newExec.valor),
      avanceFisico: Number(newExec.avanceFisico),
      obs: newExec.obs || `Informe de ejecución ${monthLabel(newExec.periodo)}`
    };

    Store.insert('execs', execObj);
    Audit.log({
      contractId: cid,
      modulo: 'Ejecución',
      accion: 'Creación',
      campo: 'Periodo ' + newExec.periodo,
      nuevo: money(newExec.valor)
    });
    setShowNewModal(false);
  };

  return (
    <div>
      <div className="panel-h mb-3">
        <div>
          <h3>Ejecución contractual</h3>
          <span className="sub">Valor ejecutado consolidado desde informes mensuales</span>
        </div>
        <div className="row-flex">
          <button className="btn sm pri" onClick={() => setShowNewModal(true)}>
            <Icon name="plus" /> Registrar ejecución
          </button>
        </div>
      </div>

      {/* Banner de alerta de agotamiento */}
      {m.pctFin > 100 && (
        <div className="result-banner bad mb-4">
          <Icon name="triangle-exclamation" />
          <div>
            <b>Sobreejecución presupuestal:</b> El valor ejecutado supera el valor contractual actualizado en{' '}
            {money(-m.saldo)}.
          </div>
        </div>
      )}
      {m.pctFin <= 100 && (m.agotaAntes || (m.activo && m.pctSaldo < 15)) && (
        <div className="result-banner bad mb-4" style={{ background: 'var(--risk-s)', color: '#A94F0C' }}>
          <Icon name="triangle-exclamation" />
          <div>
            <b>Agotamiento presupuestal próximo:</b> El contrato está próximo a agotar sus recursos.{' '}
            {m.fechaAgotar
              ? `Al ritmo actual (${moneyM(m.promMensual)}/mes) el saldo se agota el ${fdate(m.fechaAgotar)}${
                  c.fechaFin && m.fechaAgotar < c.fechaFin
                    ? `, antes de la terminación pactada (${fdate(c.fechaFin)}).`
                    : '.'
                }`
              : ''}
          </div>
        </div>
      )}

      {/* KPIs de ejecución */}
      <div className="kpis mb">
        <Kpi label="Valor inicial" value={moneyM(m.valorInicial)} sub={money(m.valorInicial)} />
        <Kpi label="Adiciones" value={moneyM(c.adiciones)} sub={money(c.adiciones)} />
        <Kpi label="Reducciones" value={moneyM(c.reducciones)} sub={money(c.reducciones)} />
        <Kpi label="Valor actualizado" value={moneyM(m.valorActual)} sub={money(m.valorActual)} />
        <Kpi label="Ejecutado" value={moneyM(m.ejecutado)} sub={money(m.ejecutado)} />
        <Kpi label="Pagado" value={moneyM(m.pagado)} sub={money(m.pagado)} />
        <Kpi
          label="Saldo"
          value={moneyM(m.saldo)}
          sub={money(m.saldo)}
          sem={m.saldo < 0 ? 'crit' : m.pctSaldo < 15 ? 'risk' : null}
        />
        <Kpi
          label="% ejecución fin."
          value={pct(m.pctFin)}
          sub={`Física: ${pct(m.pctFis)}`}
          sem={m.pctFin > 100 ? 'crit' : null}
        />
        <Kpi label="Promedio mensual" value={moneyM(m.promMensual)} sub="Últimos 3 periodos" />
        <Kpi
          label="Agotamiento proyectado"
          value={m.fechaAgotar ? fdate(m.fechaAgotar) : '—'}
          sub={m.mesesAgotar != null ? `${Math.round(m.mesesAgotar * 10) / 10} meses saldo` : 'Sin ritmo'}
          sem={m.agotaAntes ? 'warn' : null}
        />
      </div>

      {/* 4 Gráficas */}
      <div className="grid g2 mb">
        <div className="panel">
          <div className="panel-h">
            <h3>Valor contratado vs. ejecutado</h3>
          </div>
          <div className="panel-b" style={{ height: 260 }}>
            <Chart type="bar" data={chartAData} options={moneyOptions} height={240} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>Ejecución mensual</h3>
          </div>
          <div className="panel-b" style={{ height: 260 }}>
            <Chart type="bar" data={chartBData} options={moneyOptions} height={240} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>Pagos mensuales</h3>
          </div>
          <div className="panel-b" style={{ height: 260 }}>
            <Chart
              type="bar"
              data={chartCData}
              options={{
                ...moneyOptions,
                scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: (v: number) => moneyM(v) } } }
              }}
              height={240}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>Saldo y proyección de agotamiento</h3>
          </div>
          <div className="panel-b" style={{ height: 260 }}>
            <Chart type="line" data={chartDData} options={moneyOptions} height={240} />
          </div>
        </div>
      </div>

      {/* Tabla de registros mensuales */}
      <div className="panel">
        <div className="panel-h">
          <h3>Historial de ejecución mensual</h3>
          <span className="sub">{execs.length} registros</span>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Periodo</th>
                <th className="num">Valor ejecutado</th>
                <th className="num">% Avance físico acumulado</th>
                <th>Observación</th>
              </tr>
            </thead>
            <tbody>
              {execs.map((e) => (
                <tr key={e.id}>
                  <td>
                    <b>{monthLabel(e.periodo)}</b> <span className="text-muted small">({e.periodo})</span>
                  </td>
                  <td className="num font-semibold">{money(e.valor)}</td>
                  <td className="num">{pct(e.avanceFisico, 0)}</td>
                  <td>{e.obs || '—'}</td>
                </tr>
              ))}
              {execs.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty">
                    Sin registros de ejecución mensual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Registrar Ejecución */}
      {showNewModal && (
        <Modal
          title="Registrar avance de ejecución mensual"
          onClose={() => setShowNewModal(false)}
          footer={
            <div className="flex gap-2 justify-end w-full">
              <button className="btn ghost" onClick={() => setShowNewModal(false)}>
                Cancelar
              </button>
              <button className="btn pri" onClick={handleCreate}>
                Guardar Registro
              </button>
            </div>
          }
        >
          <div className="form-grid">
            <div className="f">
              <label className="req">Periodo (AAAA-MM)</label>
              <input
                type="month"
                value={newExec.periodo}
                onChange={(e) => setNewExec({ ...newExec, periodo: e.target.value })}
              />
            </div>
            <div className="f">
              <label className="req">Valor ejecutado del periodo</label>
              <input
                type="number"
                value={newExec.valor || ''}
                onChange={(e) => setNewExec({ ...newExec, valor: Number(e.target.value) })}
                placeholder="Valor en pesos COP"
              />
            </div>
            <div className="f">
              <label className="req">% Avance físico acumulado (0–100)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={newExec.avanceFisico || ''}
                onChange={(e) => setNewExec({ ...newExec, avanceFisico: Number(e.target.value) })}
                placeholder="Porcentaje de avance"
              />
            </div>
            <div className="f span2">
              <label>Observaciones</label>
              <input
                value={newExec.obs}
                onChange={(e) => setNewExec({ ...newExec, obs: e.target.value })}
                placeholder="Informe o acta de soporte"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
