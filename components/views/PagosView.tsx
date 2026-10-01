'use client';
import { Input, Select } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, Field, TableViewport, DataTable, FormGrid } from '../ui/Workspace';
import { useState } from 'react';
import type { Payment, Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { M } from '../../lib/metrics';
import { money, moneyM, fdate, monthLabel, sum, todayIso, uid } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const PagosView = ({
  onSelectContract
}: {
  onSelectContract: (cid: string, tab?: string) => void;
}) => {
  const [activeTab, setActiveTab] = useState<string>('todos');
  const [filterContract, setFilterContract] = useState('');
  const [q, setQ] = useState('');
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    contractId: '',
    numero: '',
    factura: '',
    fecha: todayIso(),
    periodo: todayIso().slice(0, 7),
    bruto: 0,
    iva: 0,
    retenciones: 0,
    soporte: ''
  });

  const allPayments = (Store.all('payments') as Payment[]).slice().sort((a, b) =>
    (a.fecha || '') < (b.fecha || '') ? 1 : -1
  );
  const allContracts = (Store.all('contracts') as Contract[]).filter((c) => !c.anulado);

  const pagados = allPayments.filter((p) => p.estado === 'Pagado');
  const pendientes = allPayments.filter((p) => p.estado === 'Pendiente' || p.estado === 'En revisión');
  const totalNetoPagado = sum(pagados, (p) => Number(p.neto) || 0);
  const totalRetenciones = sum(pagados, (p) => Number(p.retenciones) || 0);
  const totalPendiente = sum(pendientes, (p) => Number(p.neto) || 0);

  const filtered = allPayments.filter((p) => {
    if (activeTab !== 'todos' && p.estado.toLowerCase() !== activeTab.toLowerCase()) return false;
    if (filterContract && p.contractId !== filterContract) return false;
    if (q) {
      const matchNum = p.numero.toLowerCase().includes(q.toLowerCase());
      const matchFac = (p.factura || '').toLowerCase().includes(q.toLowerCase());
      const c = Store.get('contracts', p.contractId);
      const matchContr = c?.numero.toLowerCase().includes(q.toLowerCase()) || false;
      if (!matchNum && !matchFac && !matchContr) return false;
    }
    return true;
  });

  const handleUpdateStatus = (pay: Payment, newStatus: string) => {
    if (!AuthService.guard('aprobar')) return;
    const patch: any = { estado: newStatus };
    if (newStatus === 'Aprobado') patch.fechaAprob = todayIso();
    if (newStatus === 'Pagado') patch.fechaPago = todayIso();

    Store.update('payments', pay.id, patch);
    Audit.log({
      contractId: pay.contractId,
      modulo: 'Pagos',
      accion: 'Aprobación',
      campo: 'Estado del pago ' + pay.numero,
      anterior: pay.estado,
      nuevo: newStatus
    });
  };

  const handleCreate = () => {
    if (!AuthService.guard('crear')) return;
    if (!form.contractId) return notify('Seleccione un contrato');
    if (!form.numero.trim()) return notify('Ingrese el número del pago o cuenta');
    if (!form.bruto) return notify('Ingrese el valor bruto');

    const neto = Number(form.bruto) + Number(form.iva) - Number(form.retenciones);
    const payObj: Payment = {
      id: uid('PG'),
      contractId: form.contractId,
      numero: form.numero.trim(),
      factura: form.factura.trim(),
      fecha: form.fecha,
      periodo: form.periodo,
      bruto: Number(form.bruto),
      iva: Number(form.iva),
      retenciones: Number(form.retenciones),
      neto,
      estado: 'Pendiente',
      soporte: form.soporte || `${form.numero.trim()}.pdf`
    };

    Store.insert('payments', payObj);
    Audit.log({
      contractId: form.contractId,
      modulo: 'Pagos',
      accion: 'Creación',
      campo: 'Nuevo pago ' + payObj.numero,
      nuevo: `${money(payObj.neto)} (Factura ${payObj.factura})`
    });

    setShowModal(false);
    setForm({
      contractId: '',
      numero: '',
      factura: '',
      fecha: todayIso(),
      periodo: todayIso().slice(0, 7),
      bruto: 0,
      iva: 0,
      retenciones: 0,
      soporte: ''
    });
  };

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      {
        l: 'Contrato',
        k: 'contractId',
        r: (p: any) => {
          const c = Store.get('contracts', p.contractId);
          return c ? c.numero : p.contractId;
        }
      },
      { l: 'Número de pago', k: 'numero' },
      { l: 'Factura', k: 'factura' },
      { l: 'Fecha', k: 'fecha', r: (p: any) => fdate(p.fecha) },
      { l: 'Periodo', k: 'periodo', r: (p: any) => (p.periodo ? monthLabel(p.periodo) : '—') },
      { l: 'Valor Bruto', k: 'bruto', r: (p: any) => money(p.bruto) },
      { l: 'IVA', k: 'iva', r: (p: any) => money(p.iva || 0) },
      { l: 'Retenciones', k: 'retenciones', r: (p: any) => money(p.retenciones || 0) },
      { l: 'Valor Neto', k: 'neto', r: (p: any) => money(p.neto) },
      { l: 'Estado', k: 'estado' },
      { l: 'Fecha de pago', k: 'fechaPago', r: (p: any) => (p.fechaPago ? fdate(p.fechaPago) : '—') }
    ];
    exportRows('Relación Global de Pagos', cols, filtered, format);
  };

  const calcNeto = Number(form.bruto) + Number(form.iva) - Number(form.retenciones);

  return (
    <div>
      {/* Page Header */}
      <PageHeader className="ph">
        <div>
          <h1>Pagos contractuales</h1>
          <p>Gestión de cuentas, facturas, retenciones tributarias y desembolsos</p>
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
          <Button className="btn sm pri" onClick={() => setShowModal(true)}>
            <Icon name="plus" /> Registrar pago
          </Button>
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <div className="kpis mb">
        <Kpi label="Total Pagado (Neto)" value={moneyM(totalNetoPagado)} sub={money(totalNetoPagado)} color="ok" />
        <Kpi label="Pendiente de Pago" value={moneyM(totalPendiente)} sub={`${pendientes.length} pagos en trámite`} color="warn" />
        <Kpi label="Retenciones Acumuladas" value={moneyM(totalRetenciones)} sub={money(totalRetenciones)} />
        <Kpi label="Pagos en Trámite" value={pendientes.length} color={pendientes.length > 0 ? 'warn' : 'ok'} />
      </div>

      <Surface className="panel">
        {/* Quick Views */}
        <div className="tabs" style={{ padding: '0 12px' }}>
          <Button
            className={`tab ${activeTab === 'todos' ? 'on' : ''}`}
            onClick={() => setActiveTab('todos')}
          >
            Todos ({allPayments.length})
          </Button>
          <Button
            className={`tab ${activeTab === 'pendiente' ? 'on' : ''}`}
            onClick={() => setActiveTab('pendiente')}
          >
            Pendientes ({allPayments.filter((p) => p.estado === 'Pendiente').length})
          </Button>
          <Button
            className={`tab ${activeTab === 'en revisión' ? 'on' : ''}`}
            onClick={() => setActiveTab('en revisión')}
          >
            En revisión ({allPayments.filter((p) => p.estado === 'En revisión').length})
          </Button>
          <Button
            className={`tab ${activeTab === 'aprobado' ? 'on' : ''}`}
            onClick={() => setActiveTab('aprobado')}
          >
            Aprobados ({allPayments.filter((p) => p.estado === 'Aprobado').length})
          </Button>
          <Button
            className={`tab ${activeTab === 'pagado' ? 'on' : ''}`}
            onClick={() => setActiveTab('pagado')}
          >
            Pagados ({allPayments.filter((p) => p.estado === 'Pagado').length})
          </Button>
        </div>

        {/* Filters */}
        <div className="filters mb" style={{ padding: '12px 16px' }}>
          <div className="gsearch">
            <Icon name="search" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por número, factura o contrato..."
            />
          </div>
          <Field className="f">
            <Select
              className="inp sm"
              value={filterContract}
              onChange={(e) => setFilterContract(e.target.value)}
            >
              <option value="">— Todos los contratos —</option>
              {allContracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} · {c.contratista}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Table */}
        <TableViewport className="tbl-wrap">
          <DataTable className="tbl">
            <thead>
              <tr>
                <th className="nw">Contrato</th>
                <th className="nw">Pago #</th>
                <th className="nw">Fecha</th>
                <th className="nw">Factura</th>
                <th className="nw">Periodo</th>
                <th className="nw num">Bruto</th>
                <th className="nw num">IVA</th>
                <th className="nw num">Retenciones</th>
                <th className="nw num">Neto</th>
                <th className="nw">Estado</th>
                <th className="nw">Soporte</th>
                <th className="nw">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pay) => {
                const c = Store.get('contracts', pay.contractId);
                return (
                  <tr key={pay.id}>
                    <td className="nw">
                      {c ? (
                        <a
                          className="link font-bold"
                          onClick={() => onSelectContract(c.id, 'pagos')}
                          style={{ cursor: 'pointer' }}
                        >
                          {c.numero}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="nw">
                      <b>{pay.numero}</b>
                    </td>
                    <td className="nw">{fdate(pay.fecha)}</td>
                    <td className="nw">{pay.factura || '—'}</td>
                    <td className="nw">{pay.periodo ? monthLabel(pay.periodo) : '—'}</td>
                    <td className="nw num">{money(pay.bruto)}</td>
                    <td className="nw num">{money(pay.iva || 0)}</td>
                    <td className="nw num" style={{ color: 'var(--crit)' }}>
                      -{money(pay.retenciones || 0)}
                    </td>
                    <td className="nw num font-semibold">{money(pay.neto)}</td>
                    <td className="nw">
                      <Badge
                        text={pay.estado}
                        color={
                          pay.estado === 'Pagado'
                            ? 'ok'
                            : pay.estado === 'Aprobado'
                            ? 'brand'
                            : pay.estado === 'En revisión'
                            ? 'warn'
                            : pay.estado === 'Rechazado'
                            ? 'crit'
                            : 'default'
                        }
                      />
                    </td>
                    <td className="nw">
                      {pay.soporte ? (
                        <span className="link" title="Ver soporte de pago">
                          <Icon name="paperclip" /> {pay.soporte}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="nw">
                      <div className="row-flex" style={{ gap: '4px' }}>
                        {pay.estado === 'Pendiente' && (
                          <Button
                            className="btn sm"
                            onClick={() => handleUpdateStatus(pay, 'En revisión')}
                            title="Poner en revisión"
                          >
                            Revisar
                          </Button>
                        )}
                        {pay.estado === 'En revisión' && (
                          <Button
                            className="btn sm pri"
                            onClick={() => handleUpdateStatus(pay, 'Aprobado')}
                            title="Aprobar pago"
                          >
                            Aprobar
                          </Button>
                        )}
                        {pay.estado === 'Aprobado' && (
                          <Button
                            className="btn sm"
                            style={{ background: '#2E7D32', color: '#fff' }}
                            onClick={() => handleUpdateStatus(pay, 'Pagado')}
                            title="Confirmar desembolso"
                          >
                            Pagar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={12} className="empty">
                    No se encontraron pagos con los criterios seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </TableViewport>
      </Surface>

      {/* Modal for New Payment */}
      {showModal && (
        <Modal
          title="Registrar nuevo pago o cuenta de cobro"
          onClose={() => setShowModal(false)}
          size="lg"
          footer={
            <>
              <Button className="btn" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleCreate}>
                <Icon name="save" /> Registrar pago
              </Button>
            </>
          }
        >
          <FormGrid className="grid g-2" style={{ gap: '14px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl required">Contrato</label>
              <Select
                className="inp"
                value={form.contractId}
                onChange={(e) => setForm({ ...form, contractId: e.target.value })}
              >
                <option value="">— Seleccione contrato —</option>
                {allContracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero} · {c.contratista} · Saldo: {moneyM(M(c).saldo)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="lbl required">Número de pago o cuenta</label>
              <Input
                className="inp"
                value={form.numero}
                placeholder="Ej. Pago 03"
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl">Número de factura</label>
              <Input
                className="inp"
                value={form.factura}
                placeholder="Ej. FE-10492"
                onChange={(e) => setForm({ ...form, factura: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl required">Fecha</label>
              <Input
                type="date"
                className="inp"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl required">Periodo de facturación</label>
              <Input
                type="month"
                className="inp"
                value={form.periodo}
                onChange={(e) => setForm({ ...form, periodo: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl required">Valor bruto (antes de IVA)</label>
              <Input
                type="number"
                className="inp"
                value={form.bruto}
                onChange={(e) => setForm({ ...form, bruto: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="lbl">IVA (19% o aplicable)</label>
              <Input
                type="number"
                className="inp"
                value={form.iva}
                onChange={(e) => setForm({ ...form, iva: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="lbl">Retenciones tributarias</label>
              <Input
                type="number"
                className="inp"
                value={form.retenciones}
                onChange={(e) => setForm({ ...form, retenciones: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="lbl">Valor neto a pagar</label>
              <Input
                className="inp font-bold"
                value={money(calcNeto)}
                disabled
                readOnly
                style={{ background: 'var(--bg-sub)' }}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl">Documento soporte (factura / cuenta)</label>
              <Input
                className="inp"
                value={form.soporte}
                placeholder="Nombre del archivo (ej. factura_pago_03.pdf)"
                onChange={(e) => setForm({ ...form, soporte: e.target.value })}
              />
            </div>
          </FormGrid>
        </Modal>
      )}
    </div>
  );
};
