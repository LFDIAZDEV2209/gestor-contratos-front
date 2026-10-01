'use client';
import { contractHref } from '../app/routes';
import Link from 'next/link';
import { Input, Select } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, Field, TableViewport, DataTable, FormGrid, EmptyState, WorkspaceSkeleton } from '../ui/Workspace';
import { useState, useEffect } from 'react';
import type { Payment, Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { M } from '../../lib/metrics';
import { money, moneyM, fdate, monthLabel, sum, todayIso, uid } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

// Hover lift de filas (mismo patrón que ContratosView)
const HOVER_LIFT = {
  onMouseEnter: (e: React.MouseEvent<HTMLTableRowElement>) => {
    e.currentTarget.style.transform = 'translateY(-2px)';
    e.currentTarget.style.boxShadow = 'var(--shadow-2)';
    e.currentTarget.style.position = 'relative';
    e.currentTarget.style.zIndex = '2';
  },
  onMouseLeave: (e: React.MouseEvent<HTMLTableRowElement>) => {
    e.currentTarget.style.transform = 'none';
    e.currentTarget.style.boxShadow = 'none';
    e.currentTarget.style.zIndex = 'auto';
  }
};

export const PagosView = ({
  onSelectContract
}: {
  onSelectContract: (cid: string, tab?: string) => void;
}) => {
  const [activeTab, setActiveTab] = useState<string>('todos');
  const [filterContract, setFilterContract] = useState('');
  const [q, setQ] = useState('');
  const [showModal, setShowModal] = useState(false);
  // Paginación real + guardia de hidratación + refresco tras mutaciones
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Lectura tolerante a fallos del almacenamiento local (manejo de error)
  let loadError: string | null = null;
  const readAll = (kind: 'payments' | 'contracts'): any[] => {
    try {
      return Store.all(kind) as any[];
    } catch {
      loadError = 'No fue posible leer los registros de pago del almacenamiento local.';
      return [];
    }
  };

  const allPayments = (readAll('payments') as Payment[]).slice().sort((a, b) =>
    (a.fecha || '') < (b.fecha || '') ? 1 : -1
  );
  const allContracts = (readAll('contracts') as Contract[]).filter((c) => !c.anulado);

  const pagados = allPayments.filter((p) => p.estado === 'Pagado');
  const pendientes = allPayments.filter((p) => p.estado === 'Pendiente' || p.estado === 'En revisión');
  const totalNetoPagado = sum(pagados, (p) => Number(p.neto) || 0);
  const totalRetenciones = sum(pagados, (p) => Number(p.retenciones) || 0);
  const totalPendiente = sum(pendientes, (p) => Number(p.neto) || 0);
  // Conteos de las pestañas calculados una sola vez
  const countByEstado: Record<string, number> = allPayments.reduce(
    (acc, p) => {
      acc[(p.estado || '').toLowerCase()] = (acc[(p.estado || '').toLowerCase()] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasActiveFilters = Boolean(q || filterContract || activeTab !== 'todos');

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
    refresh();
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
    refresh();
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
    <div className="anim-fade-rise">
      {!mounted ? (
        <WorkspaceSkeleton />
      ) : loadError ? (
        <div className="feedback-notice" role="alert">
          <Icon name="triangle-exclamation" />
          <div>
            <b>Error al cargar los pagos.</b> {loadError}
          </div>
        </div>
      ) : (
        <>
      {/* Page Header (variante hero con gradiente de marca) */}
      <PageHeader variant="hero" className="ph">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--r)',
                background: 'rgba(255, 255, 255, 0.16)',
                color: 'var(--surface)',
                display: 'grid',
                placeItems: 'center',
                backdropFilter: 'blur(8px)',
                flexShrink: 0
              }}
            >
              <Icon name="money-check-dollar" size={24} />
            </span>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                Pagos contractuales
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: 'var(--r-pill)',
                    background: 'rgba(255, 255, 255, 0.18)',
                    color: 'var(--surface)'
                  }}
                >
                  {filtered.length} {filtered.length === 1 ? 'pago' : 'pagos'}
                </span>
              </h1>
              <p style={{ margin: '4px 0 0' }}>
                Gestión de cuentas, facturas, retenciones tributarias y desembolsos
              </p>
            </div>
          </div>
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

      {/* KPI Cards: Kpi v2 con icono y tono semántico */}
      <div className="kpis mb">
        <Kpi
          label="Total Pagado (Neto)"
          value={moneyM(totalNetoPagado)}
          sub={money(totalNetoPagado)}
          icon="check-circle"
          color="ok"
          className="anim-fade-rise stagger-1"
        />
        <Kpi
          label="Pendiente de Pago"
          value={moneyM(totalPendiente)}
          sub={`${pendientes.length} pagos en trámite`}
          icon="hourglass-half"
          color="warn"
          className="anim-fade-rise stagger-2"
        />
        <Kpi
          label="Retenciones Acumuladas"
          value={moneyM(totalRetenciones)}
          sub={money(totalRetenciones)}
          icon="scale-balanced"
          color="info"
          className="anim-fade-rise stagger-3"
        />
        <Kpi
          label="Pagos en Trámite"
          value={pendientes.length}
          icon="clock"
          color={pendientes.length > 0 ? 'warn' : 'ok'}
          className="anim-fade-rise stagger-4"
        />
      </div>

      <Surface className="panel">
        {/* Quick Views con icono */}
        <div className="tabs" style={{ padding: '0 12px' }}>
          <Button
            className={`tab ${activeTab === 'todos' ? 'on' : ''}`}
            aria-pressed={activeTab === 'todos'}
            onClick={() => {
              setActiveTab('todos');
              setPage(1);
            }}
          >
            <Icon name="list-check" size={12} /> Todos ({allPayments.length})
          </Button>
          <Button
            className={`tab ${activeTab === 'pendiente' ? 'on' : ''}`}
            aria-pressed={activeTab === 'pendiente'}
            onClick={() => {
              setActiveTab('pendiente');
              setPage(1);
            }}
          >
            <Icon name="hourglass-half" size={12} /> Pendientes ({countByEstado['pendiente'] || 0})
          </Button>
          <Button
            className={`tab ${activeTab === 'en revisión' ? 'on' : ''}`}
            aria-pressed={activeTab === 'en revisión'}
            onClick={() => {
              setActiveTab('en revisión');
              setPage(1);
            }}
          >
            <Icon name="eye" size={12} /> En revisión ({countByEstado['en revisión'] || 0})
          </Button>
          <Button
            className={`tab ${activeTab === 'aprobado' ? 'on' : ''}`}
            aria-pressed={activeTab === 'aprobado'}
            onClick={() => {
              setActiveTab('aprobado');
              setPage(1);
            }}
          >
            <Icon name="check" size={12} /> Aprobados ({countByEstado['aprobado'] || 0})
          </Button>
          <Button
            className={`tab ${activeTab === 'pagado' ? 'on' : ''}`}
            aria-pressed={activeTab === 'pagado'}
            onClick={() => {
              setActiveTab('pagado');
              setPage(1);
            }}
          >
            <Icon name="money-check-dollar" size={12} /> Pagados ({countByEstado['pagado'] || 0})
          </Button>
        </div>

        {/* Filters */}
        <div className="filters mb" style={{ padding: '12px 16px' }}>
          <div className="gsearch">
            <Icon name="search" />
            <Input
              value={q}
              aria-label="Buscar pagos"
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por número, factura o contrato..."
            />
          </div>
          <Field className="f">
            <Select
              className="inp sm"
              value={filterContract}
              aria-label="Filtrar por contrato"
              onChange={(e) => {
                setFilterContract(e.target.value);
                setPage(1);
              }}
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
              {paged.map((pay, idx) => {
                const c = Store.get('contracts', pay.contractId);
                return (
                  <tr
                    key={pay.id}
                    className="anim-fade-rise"
                    style={{ animationDelay: `${idx * 25}ms`, transition: 'transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)' }}
                    {...HOVER_LIFT}
                  >
                    <td className="nw">
                      {c ? (
                        <Link
                          className="link font-bold"
                          href={contractHref(c.id, 'pagos')}
                          style={{ cursor: 'pointer' }}
                          title="Abrir expediente del contrato"
                        >
                          {c.numero}
                        </Link>
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
                    <td className="nw num" style={{ color: 'var(--crit-text)' }}>
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
                        <span
                          className="small"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}
                          title={`Soporte registrado: ${pay.soporte}`}
                        >
                          <Icon name="file-pdf" size={12} /> {pay.soporte}
                        </span>
                      ) : (
                        <span className="badge b-warn" title="Pago sin documento soporte registrado">
                          Sin soporte
                        </span>
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
                            style={{ background: 'var(--ok)', color: 'var(--surface)' }}
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
                  <td colSpan={12}>
                    <EmptyState
                      title="No se encontraron pagos"
                      description={
                        hasActiveFilters
                          ? 'Ajusta la búsqueda, la pestaña activa o el contrato filtrado para ver más resultados.'
                          : 'Cuando se registren pagos o cuentas de cobro aparecerán aquí.'
                      }
                      action={
                        hasActiveFilters ? (
                          <Button
                            className="btn sm"
                            style={{ marginTop: 8 }}
                            onClick={() => {
                              setQ('');
                              setFilterContract('');
                              setActiveTab('todos');
                              setPage(1);
                            }}
                          >
                            <Icon name="trash" /> Restablecer filtros
                          </Button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>

            {filtered.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={12}>
                    <div className="tbl-foot">
                      <span>
                        Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} de{' '}
                        <b>{filtered.length}</b> pagos
                      </span>
                      <div className="pager">
                        <Button
                          disabled={currentPage <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          aria-label="Página anterior"
                        >
                          &lt;
                        </Button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                          <Button key={p} className={p === currentPage ? 'on' : ''} onClick={() => setPage(p)}>
                            {p}
                          </Button>
                        ))}
                        <Button
                          disabled={currentPage >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          aria-label="Página siguiente"
                        >
                          &gt;
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
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
        </>
      )}
    </div>
  );
};
