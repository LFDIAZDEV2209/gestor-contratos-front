'use client';

import { useState } from 'react';
import { Input } from '../ui/Controls';
import { notify, confirmAction } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, FormGrid, Field, EmptyState } from '../ui/Workspace';
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
  const [editingExec, setEditingExec] = useState<Exec | null>(null);
  const [newExec, setNewExec] = useState({ periodo: '', valor: 0, avanceFisico: 0, obs: '' });

  const c = Store.get('contracts', cid);
  if (!c) {
    return (
      <EmptyState
        title="Contrato no encontrado"
        description="No se encontró el expediente del contrato solicitado en el sistema."
      />
    );
  }

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

  // 1. Chart exA: Contratado vs Ejecutado (paleta Seven Save)
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
          '#64748B', // Inicial (slate)
          '#0F8579', // Adiciones (brand 7S)
          '#EA580C', // Reducciones (orange)
          '#0284C7', // Actualizado (sky)
          '#0D9488', // Ejecutado (teal)
          '#16A34A', // Pagado (green)
          m.saldo < 0 ? '#DC2626' : '#CA8A04' // Saldo (crit/warn)
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
        backgroundColor: '#0F8579',
        borderRadius: 4
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
        backgroundColor: '#16A34A',
        borderRadius: 4
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
        backgroundColor: '#CA8A04',
        borderRadius: 4
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
        borderColor: '#0F8579',
        backgroundColor: 'rgba(15,133,121,0.12)',
        fill: true,
        tension: 0.2
      },
      {
        label: 'Proyección agotamiento',
        data: projData,
        borderColor: '#DC2626',
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
    if (!newExec.periodo) return notify('Seleccione o ingrese el periodo (AAAA-MM)');
    if (!newExec.valor || Number(newExec.valor) <= 0) return notify('Ingrese un valor ejecutado válido mayor a cero');

    const execObj: Exec = {
      id: uid('EX'),
      contractId: cid,
      periodo: newExec.periodo,
      valor: Number(newExec.valor),
      avanceFisico: Number(newExec.avanceFisico) || 0,
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
    notify(`Avance para ${monthLabel(newExec.periodo)} registrado correctamente`);
    setShowNewModal(false);
    setNewExec({ periodo: '', valor: 0, avanceFisico: 0, obs: '' });
  };

  const handleUpdate = () => {
    if (!AuthService.guard('editar')) return;
    if (!editingExec) return;
    if (!editingExec.periodo) return notify('El periodo es obligatorio');
    if (!editingExec.valor || Number(editingExec.valor) <= 0) return notify('Ingrese un valor válido');

    Store.update('execs', editingExec.id, {
      periodo: editingExec.periodo,
      valor: Number(editingExec.valor),
      avanceFisico: Number(editingExec.avanceFisico) || 0,
      obs: editingExec.obs
    });

    Audit.log({
      contractId: cid,
      modulo: 'Ejecución',
      accion: 'Edición',
      campo: 'Periodo ' + editingExec.periodo,
      nuevo: money(editingExec.valor)
    });

    notify(`Registro del periodo ${monthLabel(editingExec.periodo)} actualizado`);
    setEditingExec(null);
  };

  const handleDelete = async (e: Exec) => {
    if (!AuthService.guard('editar')) return;
    const ok = await confirmAction(`¿Está seguro de eliminar el registro de ejecución del periodo ${monthLabel(e.periodo)} (${money(e.valor)})? Esta acción recalculará los saldos.`);
    if (!ok) return;

    const db = Store.getDB();
    db.execs = (db.execs || []).filter((item) => item.id !== e.id);
    Store.persist();
    Audit.log({
      contractId: cid,
      modulo: 'Ejecución',
      accion: 'Eliminación',
      campo: 'Periodo ' + e.periodo,
      anterior: money(e.valor)
    });
    notify(`Registro de ejecución ${monthLabel(e.periodo)} eliminado correctamente`);
  };

  return (
    <div className="tab-ejecucion-container">
      {/* Encabezado de la pestaña */}
      <div className="panel-h mb-3 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-[var(--ink)]">Ejecución presupuestal y física</h3>
          <span className="sub text-xs text-[var(--muted)]">
            Seguimiento mensual consolidado de avance financiero vs. cumplimiento físico
          </span>
        </div>
        <div className="row-flex">
          <Button
            className="btn sm pri"
            onClick={() => setShowNewModal(true)}
            aria-label="Registrar informe de ejecución mensual"
          >
            <Icon name="plus" /> Registrar ejecución
          </Button>
        </div>
      </div>

      {/* Alertas dinámicas de agotamiento o sobreejecución */}
      {m.pctFin > 100 && (
        <div
          className="result-banner bad mb-4 p-3 rounded flex items-center gap-3 text-sm"
          style={{
            background: 'var(--crit-bg)',
            border: '1px solid var(--crit)',
            color: 'var(--crit-text)'
          }}
          role="alert"
        >
          <Icon name="triangle-exclamation" />
          <div>
            <strong>Sobreejecución presupuestal:</strong> El valor ejecutado supera el presupuesto actualizado en{' '}
            <b className="whitespace-nowrap">{money(-m.saldo)}</b> ({pct(m.pctFin)} de ejecución). Requiere trámite urgente de adición o conciliación.
          </div>
        </div>
      )}

      {m.pctFin <= 100 && (m.agotaAntes || (m.activo && m.pctSaldo < 15)) && (
        <div
          className="result-banner bad mb-4 p-3 rounded flex items-center gap-3 text-sm"
          style={{
            background: 'var(--warn-bg)',
            border: '1px solid var(--warn)',
            color: 'var(--warn-text)'
          }}
          role="alert"
        >
          <Icon name="triangle-exclamation" />
          <div>
            <strong>Agotamiento presupuestal próximo:</strong> El contrato cuenta con solo{' '}
            <b>{pct(m.pctSaldo)} de saldo disponible</b> (<span className="whitespace-nowrap">{money(m.saldo)}</span>).{' '}
            {m.fechaAgotar
              ? `Al ritmo promedio mensual de ${moneyM(m.promMensual)}, el saldo se agotará el ${fdate(m.fechaAgotar)}${
                  c.fechaFin && m.fechaAgotar < c.fechaFin
                    ? `, antes del vencimiento contractual (${fdate(c.fechaFin)}).`
                    : '.'
                }`
              : ''}
          </div>
        </div>
      )}

      {/* Tarjetas KPI con jerarquía y tokens semánticos Seven Save */}
      <div className="kpis mb [&_.kpi]:!p-2 sm:[&_.kpi]:!p-[14px_16px] [&_.kpi-ic]:!w-7 [&_.kpi-ic]:!h-7 sm:[&_.kpi-ic]:!w-[34px] sm:[&_.kpi-ic]:!h-[34px] [&_.kpi.kpi-v2]:!gap-2 sm:[&_.kpi.kpi-v2]:!gap-3 [&_.kpi-v]:!whitespace-nowrap [&_.kpi-v]:!text-[13.5px] sm:[&_.kpi-v]:!text-[23px] [&_.kpi-s]:!whitespace-nowrap [&_.kpi-s]:!text-[9.5px] sm:[&_.kpi-s]:!text-[11.5px]">
        <Kpi
          label="Valor inicial"
          value={moneyM(m.valorInicial).replace(/\s/g, '\u00A0')}
          sub={money(m.valorInicial).replace(/\s/g, '\u00A0')}
          color="na"
          icon="coins"
        />
        <Kpi
          label="Adiciones"
          value={moneyM(c.adiciones).replace(/\s/g, '\u00A0')}
          sub={money(c.adiciones).replace(/\s/g, '\u00A0')}
          color={Number(c.adiciones) > 0 ? 'ok' : 'na'}
          icon="plus-circle"
        />
        <Kpi
          label="Reducciones"
          value={moneyM(c.reducciones).replace(/\s/g, '\u00A0')}
          sub={money(c.reducciones).replace(/\s/g, '\u00A0')}
          color={Number(c.reducciones) > 0 ? 'risk' : 'na'}
          icon="minus-circle"
        />
        <Kpi
          label="Valor actualizado"
          value={moneyM(m.valorActual).replace(/\s/g, '\u00A0')}
          sub={money(m.valorActual).replace(/\s/g, '\u00A0')}
          color="brand"
          icon="wallet"
        />
        <Kpi
          label="Ejecutado consolidado"
          value={moneyM(m.ejecutado).replace(/\s/g, '\u00A0')}
          sub={money(m.ejecutado).replace(/\s/g, '\u00A0')}
          color="info"
          icon="bar-chart-2"
        />
        <Kpi
          label="Pagado efectivo"
          value={moneyM(m.pagado).replace(/\s/g, '\u00A0')}
          sub={money(m.pagado).replace(/\s/g, '\u00A0')}
          color="ok"
          icon="check-circle"
        />
        <Kpi
          label="Saldo disponible"
          value={moneyM(m.saldo).replace(/\s/g, '\u00A0')}
          sub={money(m.saldo).replace(/\s/g, '\u00A0')}
          color={m.saldo < 0 ? 'crit' : m.pctSaldo < 15 ? 'risk' : 'ok'}
          icon="pie-chart"
        />
        <Kpi
          label="% ejecución fin."
          value={pct(m.pctFin)}
          sub={`Avance físico: ${pct(m.pctFis)}`}
          color={m.pctFin > 100 ? 'crit' : 'info'}
          icon="percent"
        />
        <Kpi
          label="Promedio mensual"
          value={moneyM(m.promMensual).replace(/\s/g, '\u00A0')}
          sub="Últimos 3 periodos"
          color="na"
          icon="trending-up"
        />
        <Kpi
          label="Agotamiento proyectado"
          value={m.fechaAgotar ? fdate(m.fechaAgotar) : 'Normal'}
          sub={m.mesesAgotar != null ? `${Math.round(m.mesesAgotar * 10) / 10} meses saldo` : 'Sin ritmo crítico'}
          color={m.agotaAntes ? 'warn' : 'na'}
          icon="calendar"
        />
      </div>

      {/* Gráficas analíticas */}
      <div className="grid g2 mb">
        <Surface className="panel">
          <div className="panel-h">
            <h3 className="font-semibold text-sm">Valor contratado vs. ejecutado</h3>
          </div>
          <div className="panel-b" style={{ height: 260 }}>
            <Chart type="bar" data={chartAData} options={moneyOptions} height={240} />
          </div>
        </Surface>

        <Surface className="panel">
          <div className="panel-h">
            <h3 className="font-semibold text-sm">Ejecución mensual facturada</h3>
          </div>
          <div className="panel-b" style={{ height: 260 }}>
            <Chart type="bar" data={chartBData} options={moneyOptions} height={240} />
          </div>
        </Surface>

        <Surface className="panel">
          <div className="panel-h">
            <h3 className="font-semibold text-sm">Pagos mensuales desembolsados</h3>
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
        </Surface>

        <Surface className="panel">
          <div className="panel-h">
            <h3 className="font-semibold text-sm">Saldo y proyección de agotamiento</h3>
          </div>
          <div className="panel-b" style={{ height: 260 }}>
            <Chart type="line" data={chartDData} options={moneyOptions} height={240} />
          </div>
        </Surface>
      </div>

      {/* Tabla de registros mensuales */}
      <Surface className="panel">
        <div className="panel-h flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Historial de informes mensuales de ejecución</h3>
            <span className="sub text-xs text-[var(--muted)]">{execs.length} registro(s) auditado(s)</span>
          </div>
        </div>

        {execs.length === 0 ? (
          <EmptyState
            title="Sin registros de ejecución mensual"
            description="Aún no se han radicado informes mensuales de avance financiero ni físico para este contrato."
            action={
              <Button className="btn pri sm" onClick={() => setShowNewModal(true)}>
                <Icon name="plus" /> Registrar primer avance
              </Button>
            }
          />
        ) : (
          <TableViewport className="tbl-wrap">
            <DataTable className="tbl">
              <thead>
                <tr>
                  <th className="nw">Periodo</th>
                  <th className="num">Valor ejecutado</th>
                  <th className="num">% Avance físico</th>
                  <th>Observación / Soporte</th>
                  <th className="nw text-right" style={{ width: '130px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {execs.map((e) => (
                  <tr key={e.id} className="hover:bg-[var(--surface-2)] transition-colors">
                    <td className="nw">
                      <b className="text-[var(--ink)]">{monthLabel(e.periodo)}</b>{' '}
                      <span className="text-[var(--muted)] small font-mono">({e.periodo})</span>
                    </td>
                    <td className="num font-semibold text-[var(--ink)]">{money(e.valor)}</td>
                    <td className="num">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        {pct(e.avanceFisico, 0)}
                      </span>
                    </td>
                    <td className="clip" title={e.obs || ''}>
                      {e.obs || '—'}
                    </td>
                    <td className="nw text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <Button
                          className="btn ghost xs"
                          onClick={() => setEditingExec(e)}
                          aria-label={`Editar ejecución periodo ${e.periodo}`}
                          title="Editar registro"
                        >
                          <Icon name="pencil" size={13} />
                        </Button>
                        <Button
                          className="btn ghost xs text-[var(--crit)] hover:bg-[var(--crit-bg)]"
                          onClick={() => handleDelete(e)}
                          aria-label={`Eliminar ejecución periodo ${e.periodo}`}
                          title="Eliminar registro"
                        >
                          <Icon name="trash" size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableViewport>
        )}
      </Surface>

      {/* Modal Registrar Ejecución */}
      {showNewModal && (
        <Modal
          title="Registrar avance de ejecución mensual"
          onClose={() => setShowNewModal(false)}
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button className="btn ghost" onClick={() => setShowNewModal(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleCreate}>
                <Icon name="check" /> Guardar Registro
              </Button>
            </div>
          }
        >
          <FormGrid className="form-grid">
            <Field className="f">
              <label className="req font-medium text-xs">Periodo (AAAA-MM)</label>
              <Input
                type="month"
                value={newExec.periodo}
                onChange={(e) => setNewExec({ ...newExec, periodo: e.target.value })}
                required
              />
            </Field>
            <Field className="f">
              <label className="req font-medium text-xs">Valor ejecutado del periodo (COP)</label>
              <Input
                type="number"
                min="0"
                step="1000"
                value={newExec.valor || ''}
                onChange={(e) => setNewExec({ ...newExec, valor: Number(e.target.value) })}
                placeholder="Valor en pesos"
                required
              />
            </Field>
            <Field className="f">
              <label className="req font-medium text-xs">% Avance físico acumulado (0–100)</label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={newExec.avanceFisico || ''}
                onChange={(e) => setNewExec({ ...newExec, avanceFisico: Number(e.target.value) })}
                placeholder="Porcentaje de avance"
                required
              />
            </Field>
            <Field className="f span2">
              <label className="font-medium text-xs">Observaciones / Acta de soporte</label>
              <Input
                value={newExec.obs}
                onChange={(e) => setNewExec({ ...newExec, obs: e.target.value })}
                placeholder="Informe de supervisión o radicado de soporte..."
              />
            </Field>
          </FormGrid>
        </Modal>
      )}

      {/* Modal Editar Ejecución */}
      {editingExec && (
        <Modal
          title={`Editar ejecución · ${monthLabel(editingExec.periodo)}`}
          onClose={() => setEditingExec(null)}
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button className="btn ghost" onClick={() => setEditingExec(null)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleUpdate}>
                <Icon name="check" /> Guardar Cambios
              </Button>
            </div>
          }
        >
          <FormGrid className="form-grid">
            <Field className="f">
              <label className="req font-medium text-xs">Periodo (AAAA-MM)</label>
              <Input
                type="month"
                value={editingExec.periodo}
                onChange={(e) => setEditingExec({ ...editingExec, periodo: e.target.value })}
                required
              />
            </Field>
            <Field className="f">
              <label className="req font-medium text-xs">Valor ejecutado (COP)</label>
              <Input
                type="number"
                min="0"
                step="1000"
                value={editingExec.valor || ''}
                onChange={(e) => setEditingExec({ ...editingExec, valor: Number(e.target.value) })}
                required
              />
            </Field>
            <Field className="f">
              <label className="req font-medium text-xs">% Avance físico acumulado</label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={editingExec.avanceFisico || ''}
                onChange={(e) => setEditingExec({ ...editingExec, avanceFisico: Number(e.target.value) })}
                required
              />
            </Field>
            <Field className="f span2">
              <label className="font-medium text-xs">Observaciones / Soporte</label>
              <Input
                value={editingExec.obs || ''}
                onChange={(e) => setEditingExec({ ...editingExec, obs: e.target.value })}
              />
            </Field>
          </FormGrid>
        </Modal>
      )}
    </div>
  );
};
