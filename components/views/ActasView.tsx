'use client';
import { contractHref } from '../app/routes';
import Link from 'next/link';
import { Input, Select, Textarea } from '../ui/Controls';
import { notify, confirmAction } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, Field, TableViewport, DataTable, FormGrid, EmptyState } from '../ui/Workspace';
import { useState } from 'react';
import type { Acta, Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { CAT } from '../../lib/catalog';
import { fdate, todayIso, uid } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

const PAGE_SIZE = 10;

// Chip de vista rápida reutilizable: pill seleccionable con estado activo
// (--selection con fallback a --brand-soft) y microinteracción de escala.
const chipStyle = (isActive: boolean): React.CSSProperties => ({
  borderRadius: 'var(--r-pill)',
  background: isActive ? 'var(--selection, var(--brand-soft))' : 'var(--surface-2)',
  color: isActive ? 'var(--selection-text, var(--brand-2))' : 'var(--ink-2)',
  borderColor: isActive ? 'var(--brand)' : 'var(--border-control)',
  fontWeight: isActive ? 600 : 500,
  transform: isActive ? 'scale(1.05)' : 'scale(1)',
  boxShadow: isActive ? '0 2px 8px -2px rgba(11, 110, 104, 0.35)' : 'none',
  transition: 'transform var(--t-fast) cubic-bezier(0.34, 1.56, 0.64, 1), background var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer'
});

// Hover lift de filas (translateY + sombra), igual que la vista de contratos.
const rowHover = {
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

export const ActasView = ({
  onSelectContract
}: {
  onSelectContract: (cid: string, tab?: string) => void;
}) => {
  const [filterTipo, setFilterTipo] = useState('');
  const [filterContract, setFilterContract] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    contractId: '',
    tipo: 'Acta de inicio',
    numero: '',
    fecha: todayIso(),
    descripcion: '',
    firmantes: '',
    estado: 'Firmada',
    archivo: ''
  });

  const allActas = (Store.all('actas') as Acta[]).slice().sort((a, b) =>
    (a.fecha || '') < (b.fecha || '') ? 1 : -1
  );
  const allContracts = (Store.all('contracts') as Contract[]).filter((c) => !c.anulado);

  const tiposCatalogo = CAT('tiposActa');

  const filtered = allActas.filter((a) => {
    if (filterTipo && a.tipo !== filterTipo) return false;
    if (filterContract && a.contractId !== filterContract) return false;
    if (q) {
      const matchNum = a.numero.toLowerCase().includes(q.toLowerCase());
      const matchDesc = a.descripcion.toLowerCase().includes(q.toLowerCase());
      const matchFirm = (a.firmantes || '').toLowerCase().includes(q.toLowerCase());
      const c = Store.get('contracts', a.contractId);
      const matchContr = c?.numero.toLowerCase().includes(q.toLowerCase()) || false;
      if (!matchNum && !matchDesc && !matchFirm && !matchContr) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const hasActiveFilters = Boolean(filterTipo || filterContract || q);
  const clearFilters = () => {
    setFilterTipo('');
    setFilterContract('');
    setQ('');
    setPage(1);
  };

  const handleCreate = () => {
    if (!AuthService.guard('crear')) return;
    if (!form.contractId) return notify('Seleccione un contrato');
    if (!form.numero.trim()) return notify('Ingrese el número del acta');
    if (!form.fecha) return notify('Ingrese la fecha');

    const newActa: Acta = {
      id: uid('AC'),
      contractId: form.contractId,
      tipo: form.tipo,
      numero: form.numero.trim(),
      fecha: form.fecha,
      descripcion: form.descripcion,
      firmantes: form.firmantes,
      estado: form.estado,
      archivo: form.archivo || `${form.numero.replace(/\s+/g, '_')}.pdf`
    };

    Store.insert('actas', newActa);
    Audit.log({
      contractId: form.contractId,
      modulo: 'Actas',
      accion: 'Creación',
      campo: 'Acta ' + newActa.numero,
      nuevo: `${newActa.tipo} - ${newActa.fecha}`
    });

    setShowModal(false);
    setForm({
      contractId: '',
      tipo: 'Acta de inicio',
      numero: '',
      fecha: todayIso(),
      descripcion: '',
      firmantes: '',
      estado: 'Firmada',
      archivo: ''
    });
  };

  const handleAnular = async (acta: Acta) => {
    if (!AuthService.guard('editar')) return;
    if (!await confirmAction(`¿Está seguro de anular el acta ${acta.numero}?`)) return;

    Store.update('actas', acta.id, { estado: 'Anulada' });
    Audit.log({
      contractId: acta.contractId,
      modulo: 'Actas',
      accion: 'Edición',
      campo: 'Estado de acta ' + acta.numero,
      anterior: acta.estado,
      nuevo: 'Anulada'
    });
  };

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      {
        l: 'Contrato',
        k: 'contractId',
        r: (a: any) => {
          const c = Store.get('contracts', a.contractId);
          return c ? c.numero : a.contractId;
        }
      },
      { l: 'Número', k: 'numero' },
      { l: 'Tipo', k: 'tipo' },
      { l: 'Fecha', k: 'fecha', r: (a: any) => fdate(a.fecha) },
      { l: 'Descripción', k: 'descripcion' },
      { l: 'Firmantes', k: 'firmantes' },
      { l: 'Estado', k: 'estado' }
    ];
    exportRows('Relación Global de Actas Contractuales', cols, filtered, format);
  };

  const countEstado = (estado: string) => allActas.filter((a) => a.estado === estado).length;
  const QUICK_CHIPS: { id: string; label: string; icon: string }[] = [
    { id: '', label: `Todas (${allActas.length})`, icon: 'file-signature' },
    ...tiposCatalogo.map((t) => ({
      id: t,
      label: `${t} (${allActas.filter((a) => a.tipo === t).length})`,
      icon: 'gavel'
    }))
  ];

  return (
    <div className="anim-fade-rise">
      {/* Banner de cabecera con gradiente de marca institucional */}
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
              <Icon name="file-signature" size={24} />
            </span>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                Actas contractuales
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
                  {allActas.length} {allActas.length === 1 ? 'acta' : 'actas'}
                </span>
              </h1>
              <p style={{ margin: '4px 0 0' }}>
                Registro formal de hitos, acuerdos, suspensiones, recibos y liquidaciones del portafolio
              </p>
            </div>
          </div>

          {/* Leyenda de estados dentro del hero */}
          <div className="legend" style={{ marginTop: 16 }}>
            <span><span className="sem ok" /> Firmada</span>
            <span><span className="sem warn" /> En firmas</span>
            <span><span className="sem na" /> Borrador</span>
            <span><span className="sem crit" /> Anulada</span>
          </div>
        </div>

        <div className="ph-actions">
          <div className="exp-actions">
            <Button className="btn sm" onClick={() => handleExport('xlsx')} title="Exportar a Excel" aria-label="Exportar actas a Excel">
              <Icon name="file-excel" /> Excel
            </Button>
            <Button className="btn sm" onClick={() => handleExport('pdf')} title="Exportar a PDF" aria-label="Exportar actas a PDF">
              <Icon name="file-pdf" /> PDF
            </Button>
            <Button className="btn sm" onClick={() => handleExport('csv')} title="Exportar a CSV" aria-label="Exportar actas a CSV">
              <Icon name="file-csv" /> CSV
            </Button>
          </div>
          <Button className="btn sm pri" onClick={() => setShowModal(true)}>
            <Icon name="plus" /> Nueva acta
          </Button>
        </div>
      </PageHeader>

      {/* KPI Cards con icono y entrada escalonada */}
      <div className="kpis mb">
        <Kpi label="Total Actas" value={allActas.length} icon="file-signature" color="brand" className="anim-fade-rise stagger-1 click" onClick={() => { setFilterTipo(''); setPage(1); }} />
        <Kpi label="Firmadas" value={countEstado('Firmada')} icon="check-circle" color="ok" className="anim-fade-rise stagger-2" />
        <Kpi label="En firmas" value={countEstado('En firmas')} icon="clock" color={countEstado('En firmas') > 0 ? 'warn' : 'ok'} className="anim-fade-rise stagger-3" />
        <Kpi label="Borradores" value={countEstado('Borrador')} icon="file-text" color="na" className="anim-fade-rise stagger-4" />
        <Kpi label="Anuladas" value={countEstado('Anulada')} icon="alert-triangle" color={countEstado('Anulada') > 0 ? 'crit' : 'ok'} className="anim-fade-rise stagger-5" />
      </div>

      {/* Main Table Panel */}
      <Surface className="panel">
        {/* Filtros */}
        <div className="filters" style={{ padding: '12px 16px' }}>
          <div className="gsearch" style={{ alignSelf: 'flex-end' }}>
            <Icon name="search" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Buscar por número, descripción o contrato..."
              aria-label="Buscar actas por número, descripción o contrato"
            />
          </div>
          <Field className="f">
            <label>Contrato</label>
            <Select
              className="inp sm"
              value={filterContract}
              onChange={(e) => { setFilterContract(e.target.value); setPage(1); }}
            >
              <option value="">— Todos los contratos —</option>
              {allContracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} · {c.contratista}
                </option>
              ))}
            </Select>
          </Field>
          {hasActiveFilters && (
            <Button className="btn sm ghost" onClick={clearFilters} style={{ alignSelf: 'flex-end', height: 38 }}>
              <Icon name="trash" /> Limpiar
            </Button>
          )}
        </div>

        {/* Chips de vistas rápidas seleccionables por tipo de acta */}
        <div className="filter-chips" role="group" aria-label="Vistas rápidas" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 2 }}>
            <Icon name="eye" size={13} />
            <span>Vistas rápidas:</span>
          </span>
          {QUICK_CHIPS.map((chip) => {
            const isActive = filterTipo === chip.id;
            return (
              <button
                type="button"
                key={chip.id || 'todas'}
                onClick={() => { setFilterTipo(chip.id); setPage(1); }}
                aria-pressed={isActive}
                className={`btn xs ${isActive ? 'active-chip' : 'ghost'}`}
                style={chipStyle(isActive)}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.transform = 'scale(1.03)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = isActive ? 'scale(1.05)' : 'scale(1)';
                }}
              >
                <Icon name={chip.icon} size={12} style={{ color: isActive ? 'var(--brand)' : 'var(--muted)' }} />
                <span>{chip.label}</span>
                {isActive && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)', marginLeft: 2 }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Tabla de actas con rail de estado y hover lift */}
        <TableViewport className="tbl-wrap">
          <DataTable className="tbl">
            <thead>
              <tr>
                <th className="nw">Contrato</th>
                <th className="nw">Número</th>
                <th>Tipo de Acta</th>
                <th className="nw">Fecha</th>
                <th>Descripción / Objeto</th>
                <th>Firmantes</th>
                <th className="nw">Estado</th>
                <th className="nw">Soporte</th>
                <th className="nw">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((a, idx) => {
                const c = Store.get('contracts', a.contractId);
                const isVoid = a.estado === 'Anulada';
                const rail = isVoid
                  ? 'var(--na)'
                  : a.estado === 'Firmada'
                  ? 'var(--ok)'
                  : a.estado === 'En firmas'
                  ? 'var(--warn)'
                  : 'var(--info)';
                return (
                  <tr
                    key={a.id}
                    className={`rail anim-fade-rise ${isVoid ? 'void' : ''}`}
                    style={{
                      '--railc': rail,
                      animationDelay: `${idx * 25}ms`,
                      transition: 'transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)'
                    } as any}
                    {...rowHover}
                  >
                    <td className="nw">
                      {c ? (
                        <Link
                          className="link font-bold"
                          href={contractHref(c.id, 'actas')}
                          style={{ cursor: 'pointer' }}
                        >
                          {c.numero}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="nw">
                      <b>{a.numero}</b>
                    </td>
                    <td>{a.tipo}</td>
                    <td className="nw">{fdate(a.fecha)}</td>
                    <td className="clip" style={{ maxWidth: '280px' }} title={a.descripcion}>
                      {a.descripcion || '—'}
                    </td>
                    <td className="clip" style={{ maxWidth: '180px' }} title={a.firmantes}>
                      {a.firmantes || '—'}
                    </td>
                    <td className="nw">
                      <Badge
                        text={a.estado}
                        color={
                          a.estado === 'Firmada'
                            ? 'ok'
                            : a.estado === 'En firmas'
                            ? 'warn'
                            : a.estado === 'Anulada'
                            ? 'crit'
                            : 'na'
                        }
                      />
                    </td>
                    <td className="nw">
                      {a.archivo ? (
                        <span className="badge b-na" title={`Archivo soporte: ${a.archivo}`}>
                          <Icon name="file-text" size={12} /> {a.archivo}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="nw">
                      <div className="row-flex" style={{ gap: '4px', flexWrap: 'nowrap' }}>
                        {c && (
                          <Button
                            className="btn sm"
                            onClick={() => onSelectContract(c.id, 'actas')}
                            aria-label={`Ver expediente del contrato ${c.numero}`}
                          >
                            Expediente
                          </Button>
                        )}
                        {!isVoid && (
                          <Button
                            className="icon-btn"
                            style={{ color: 'var(--crit-text)' }}
                            onClick={() => handleAnular(a)}
                            title="Anular acta"
                            aria-label={`Anular acta ${a.numero}`}
                          >
                            <Icon name="x" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      title="No se encontraron actas"
                      description="Prueba ajustando los filtros o la búsqueda del registro formal."
                      action={
                        hasActiveFilters ? (
                          <Button className="btn sm" onClick={clearFilters} style={{ marginTop: 8 }}>
                            Restablecer filtros
                          </Button>
                        ) : (
                          <Button className="btn sm pri" onClick={() => setShowModal(true)} style={{ marginTop: 8 }}>
                            <Icon name="plus" /> Registrar primera acta
                          </Button>
                        )
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>

            {filtered.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={9}>
                    <div className="tbl-foot">
                      <span>
                        Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de{' '}
                        <b>{filtered.length}</b> actas
                      </span>
                      <div className="pager">
                        <Button
                          disabled={currentPage <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          aria-label="Página anterior"
                        >
                          &lt;
                        </Button>
                        {Array.from({ length: totalPages }, (_, p) => p + 1).map((p) => (
                          <Button key={p} className={p === currentPage ? 'on' : ''} aria-current={p === currentPage ? 'page' : undefined} onClick={() => setPage(p)}>
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

      {/* Modal for New Acta */}
      {showModal && (
        <Modal
          title="Nueva acta contractual"
          onClose={() => setShowModal(false)}
          size="lg"
          footer={
            <>
              <Button className="btn" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleCreate}>
                <Icon name="check" /> Registrar acta
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
                    {c.numero} · {c.contratista}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="lbl required">Tipo de acta</label>
              <Select
                className="inp"
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              >
                {tiposCatalogo.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="lbl required">Número de acta</label>
              <Input
                className="inp"
                value={form.numero}
                placeholder="Ej. ACT-001"
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
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
              <label className="lbl">Estado</label>
              <Select
                className="inp"
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
              >
                <option value="Borrador">Borrador</option>
                <option value="En firmas">En firmas</option>
                <option value="Firmada">Firmada</option>
              </Select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl">Firmantes</label>
              <Input
                className="inp"
                value={form.firmantes}
                placeholder="Nombres y cargos de quienes suscriben el acta"
                onChange={(e) => setForm({ ...form, firmantes: e.target.value })}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl">Descripción / Objeto del acta</label>
              <Textarea
                className="inp"
                rows={3}
                value={form.descripcion}
                placeholder="Detalle o acuerdos formalizados en el acta..."
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl">Documento soporte (archivo)</label>
              <Input
                className="inp"
                value={form.archivo}
                placeholder="Nombre del archivo adjunto (ej. acta_inicio_firmada.pdf)"
                onChange={(e) => setForm({ ...form, archivo: e.target.value })}
              />
            </div>
          </FormGrid>
        </Modal>
      )}
    </div>
  );
};
