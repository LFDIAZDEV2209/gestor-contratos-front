'use client';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, FormGrid, Field } from '../ui/Workspace';
import { useState } from 'react';
import type { Payment } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { M } from '../../lib/metrics';
import { money, moneyM, pct, fdate, monthLabel, sum, todayIso, uid } from '../../lib/format';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const TabPagos = ({ cid }: { cid: string }) => {
  const [showNewModal, setShowNewModal] = useState(false);
  const [newPay, setNewPay] = useState({
    numero: '',
    factura: '',
    fecha: todayIso(),
    periodo: '',
    bruto: 0,
    iva: 0,
    retenciones: 0,
    soporte: ''
  });

  const c = Store.get('contracts', cid);
  if (!c) return <div className="empty">Contrato no encontrado</div>;

  const m = M(c);
  const payments = (Store.byContract('payments', cid) as Payment[]).sort((a, b) =>
    a.fecha < b.fecha ? 1 : -1
  );

  const pagados = payments.filter((p) => p.estado === 'Pagado');
  const pendientes = payments.filter((p) => p.estado === 'Pendiente' || p.estado === 'En revisión');
  const totalNetoPagado = sum(pagados, (p) => +p.neto || 0);
  const totalRetenciones = sum(pagados, (p) => Number(p.retenciones || 0));
  const totalPendiente = sum(pendientes, (p) => +p.neto || 0);
  const pctPagVsEjec = m.ejecutado ? (m.pagado / m.ejecutado) * 100 : 0;

  const handleUpdateStatus = (pay: Payment, newStatus: string) => {
    if (!AuthService.guard('aprobar')) return;
    const patch: any = { estado: newStatus };
    if (newStatus === 'Aprobado') patch.fechaAprob = todayIso();
    if (newStatus === 'Pagado') patch.fechaPago = todayIso();

    Store.update('payments', pay.id, patch);
    Audit.log({
      contractId: cid,
      modulo: 'Pagos',
      accion: 'Aprobación',
      campo: 'Estado del pago ' + pay.numero,
      anterior: pay.estado,
      nuevo: newStatus
    });
  };

  const handleCreate = () => {
    if (!AuthService.guard('crear')) return;
    if (!newPay.numero) return notify('Ingrese el número del pago o cuenta');
    if (!newPay.bruto) return notify('Ingrese el valor bruto');

    const neto = Number(newPay.bruto) + Number(newPay.iva) - Number(newPay.retenciones);
    const payObj: Payment = {
      id: uid('PG'),
      contractId: cid,
      numero: newPay.numero,
      factura: newPay.factura,
      fecha: newPay.fecha,
      periodo: newPay.periodo,
      bruto: Number(newPay.bruto),
      iva: Number(newPay.iva),
      retenciones: Number(newPay.retenciones),
      neto,
      estado: 'Pendiente',
      soporte: newPay.soporte || `${newPay.numero}.pdf`
    };

    Store.insert('payments', payObj);
    Audit.log({
      contractId: cid,
      modulo: 'Pagos',
      accion: 'Creación',
      campo: 'Pago ' + newPay.numero,
      nuevo: money(neto)
    });
    setShowNewModal(false);
  };

  const calcNeto = Number(newPay.bruto) + Number(newPay.iva) - Number(newPay.retenciones);

  return (
    <div>
      <div className="panel-h mb-3">
        <div>
          <h3>Pagos y Cuentas de Cobro</h3>
          <span className="sub">{payments.length} pagos registrados</span>
        </div>
        <div className="row-flex">
          <Button className="btn sm pri" onClick={() => setShowNewModal(true)}>
            <Icon name="plus" /> Registrar pago
          </Button>
        </div>
      </div>

      <div className="kpis mb">
        <Kpi label="Total Pagado (Neto)" value={moneyM(totalNetoPagado)} sub={money(totalNetoPagado)} sem="ok" />
        <Kpi
          label="Pendiente / en revisión"
          value={pendientes.length}
          sub={moneyM(totalPendiente)}
          sem={pendientes.length ? 'warn' : null}
        />
        <Kpi label="Retenciones practicadas" value={moneyM(totalRetenciones)} sub={money(totalRetenciones)} />
        <Kpi label="% Pagado vs. ejecutado" value={pct(pctPagVsEjec)} />
      </div>

      <Surface className="panel">
        <TableViewport className="tbl-wrap">
          <DataTable className="tbl">
            <thead>
              <tr>
                <th>Pago / Factura</th>
                <th>Fecha</th>
                <th>Periodo</th>
                <th className="num">Bruto</th>
                <th className="num">IVA</th>
                <th className="num">Retenciones</th>
                <th className="num">Neto a pagar</th>
                <th>Estado</th>
                <th>Soporte</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.numero}</b>
                    {p.factura && <div className="small muted">Factura: {p.factura}</div>}
                  </td>
                  <td>{fdate(p.fecha)}</td>
                  <td>{p.periodo ? monthLabel(p.periodo) : '—'}</td>
                  <td className="num">{money(p.bruto)}</td>
                  <td className="num">{money(p.iva)}</td>
                  <td className="num">{money(p.retenciones)}</td>
                  <td className="num font-semibold">{money(p.neto)}</td>
                  <td>
                    <Badge text={p.estado} />
                  </td>
                  <td>
                    {p.soporte ? (
                      <span className="small text-green-700 dark:text-green-400 flex items-center gap-1">
                        <Icon name="file-pdf" /> {p.soporte}
                      </span>
                    ) : (
                      <span className="small text-red-600 dark:text-red-400">Sin soporte</span>
                    )}
                  </td>
                  <td>
                    <div className="acts">
                      {p.estado === 'Pendiente' && (
                        <Button
                          className="btn xs"
                          onClick={() => handleUpdateStatus(p, 'En revisión')}
                          title="Pasar a revisión"
                        >
                          Revisar
                        </Button>
                      )}
                      {(p.estado === 'Pendiente' || p.estado === 'En revisión') && (
                        <Button
                          className="btn xs pri"
                          onClick={() => handleUpdateStatus(p, 'Aprobado')}
                          title="Aprobar pago"
                        >
                          Aprobar
                        </Button>
                      )}
                      {p.estado === 'Aprobado' && (
                        <Button
                          className="btn xs ok"
                          style={{ background: 'var(--ok)', color: '#fff' }}
                          onClick={() => handleUpdateStatus(p, 'Pagado')}
                          title="Marcar como pagado"
                        >
                          Pagar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={10} className="empty">
                    No se registran pagos en este contrato.
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </TableViewport>
      </Surface>

      {showNewModal && (
        <Modal
          title="Registrar pago o cuenta de cobro"
          onClose={() => setShowNewModal(false)}
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button className="btn ghost" onClick={() => setShowNewModal(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleCreate}>
                Guardar Pago
              </Button>
            </div>
          }
        >
          <FormGrid className="form-grid">
            <Field className="f">
              <label className="req">Número de pago</label>
              <input
                value={newPay.numero}
                onChange={(e) => setNewPay({ ...newPay, numero: e.target.value })}
                placeholder="Ej. OP-044-01"
              />
            </Field>
            <Field className="f">
              <label>Factura de venta</label>
              <input
                value={newPay.factura}
                onChange={(e) => setNewPay({ ...newPay, factura: e.target.value })}
                placeholder="Ej. FE-8891"
              />
            </Field>
            <Field className="f">
              <label className="req">Fecha de radicación</label>
              <input
                type="date"
                value={newPay.fecha}
                onChange={(e) => setNewPay({ ...newPay, fecha: e.target.value })}
              />
            </Field>
            <Field className="f">
              <label>Periodo de ejecución (AAAA-MM)</label>
              <input
                type="month"
                value={newPay.periodo}
                onChange={(e) => setNewPay({ ...newPay, periodo: e.target.value })}
              />
            </Field>
            <Field className="f">
              <label className="req">Valor bruto</label>
              <input
                type="number"
                value={newPay.bruto || ''}
                onChange={(e) => {
                  const b = Number(e.target.value);
                  setNewPay({ ...newPay, bruto: b, iva: Math.round(b * 0.19) });
                }}
              />
            </Field>
            <Field className="f">
              <label>IVA</label>
              <input
                type="number"
                value={newPay.iva || ''}
                onChange={(e) => setNewPay({ ...newPay, iva: Number(e.target.value) })}
              />
            </Field>
            <Field className="f">
              <label>Retenciones (ReteFuente / ReteICA)</label>
              <input
                type="number"
                value={newPay.retenciones || ''}
                onChange={(e) => setNewPay({ ...newPay, retenciones: Number(e.target.value) })}
              />
            </Field>
            <Field className="f">
              <label>Archivo soporte</label>
              <input
                value={newPay.soporte}
                onChange={(e) => setNewPay({ ...newPay, soporte: e.target.value })}
                placeholder="Factura_01.pdf"
              />
            </Field>
            <Field className="f span2">
              <div className="calc p-3 bg-neutral-50 dark:bg-neutral-900 border rounded flex justify-between items-center text-sm">
                <span>
                  Neto a pagar: <b>{money(calcNeto)}</b>
                </span>
                <span className="small muted">Fórmula: Bruto + IVA − Retenciones</span>
              </div>
            </Field>
          </FormGrid>
        </Modal>
      )}
    </div>
  );
};
