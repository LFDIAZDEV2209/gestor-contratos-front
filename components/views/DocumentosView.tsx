'use client';
import { fieldIcon } from '../forms/fieldIcon';
import { contractHref } from '../app/routes';
import Link from 'next/link';
import { Input, Select } from '../ui/Controls';
import { requestReason } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, Field, TableViewport, DataTable, EmptyState } from '../ui/Workspace';
import { useState } from 'react';
import type { Document, Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { CAT } from '../../lib/catalog';
import { M, activeContracts, companyName } from '../../lib/metrics';
import { fdate, sum } from '../../lib/format';
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
  boxShadow: isActive ? '0 2px 8px -2px rgba(6, 47, 88, 0.35)' : 'none',
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

export const DocumentosView = ({
  onSelectContract
}: {
  onSelectContract: (cid: string, tab?: string) => void;
}) => {
  const [q, setQ] = useState('');
  const [filterContract, setFilterContract] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [viewEstado, setViewEstado] = useState<'todos' | 'Activos' | 'Anulados'>('todos');
  const [page, setPage] = useState(1);
  const [selectedDocHistory, setSelectedDocHistory] = useState<Document | null>(null);

  const allDocs = (Store.all('documents') as Document[]).slice();
  const allContracts = (Store.all('contracts') as Contract[]).filter((c) => !c.anulado);
  const cs = activeContracts();

  const totalDocs = allDocs.length;
  const totalVersions = sum(allDocs, (d) => d.versions?.length || 1);
  const faltantesCount = cs.filter(
    (c) => M(c).docsFaltantes.length && M(c).estado !== 'Liquidado'
  ).length;
  const anuladosCount = allDocs.filter((d) => d.estado === 'Anulado').length;

  const filtered = allDocs.filter((d) => {
    // Estados de repositorio: 'Activo'/'Vigente' cuentan como activos; solo 'Anulado' sale del flujo.
    if (viewEstado === 'Activos' && d.estado === 'Anulado') return false;
    if (viewEstado === 'Anulados' && d.estado !== 'Anulado') return false;
    if (filterContract && d.contractId !== filterContract) return false;
    if (filterCat && d.categoria !== filterCat) return false;
    if (q) {
      const matchName = d.nombre.toLowerCase().includes(q.toLowerCase());
      const matchFile = (d.versions?.[d.versions.length - 1]?.archivo || '')
        .toLowerCase()
        .includes(q.toLowerCase());
      const c = Store.get('contracts', d.contractId);
      const matchContr = c?.numero.toLowerCase().includes(q.toLowerCase()) || false;
      if (!matchName && !matchFile && !matchContr) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const hasActiveFilters = Boolean(viewEstado !== 'todos' || filterContract || filterCat || q);
  const clearFilters = () => {
    setViewEstado('todos');
    setFilterContract('');
    setFilterCat('');
    setQ('');
    setPage(1);
  };

  const handleAnular = async (doc: Document) => {
    if (!AuthService.guard('anular')) return;
    const motivo = await requestReason(`Motivo de anulación del documento «${doc.nombre}»:`);
    if (!motivo) return;

    Store.update('documents', doc.id, { estado: 'Anulado' });
    Audit.log({
      contractId: doc.contractId,
      modulo: 'Documentos',
      accion: 'Anulación',
      campo: 'Estado del documento ' + doc.nombre,
      anterior: doc.estado,
      nuevo: 'Anulado',
      obs: motivo
    });
  };

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      {
        l: 'Contrato',
        k: 'contractId',
        r: (d: any) => {
          const c = Store.get('contracts', d.contractId);
          return c ? c.numero : d.contractId;
        }
      },
      { l: 'Nombre Documento', k: 'nombre' },
      { l: 'Categoría', k: 'categoria' },
      {
        l: 'Archivo Actual',
        k: 'file',
        r: (d: any) => d.versions?.[d.versions.length - 1]?.archivo || '—'
      },
      {
        l: 'Versión',
        k: 'v',
        r: (d: any) => `v${d.versions?.length || 1}`
      },
      {
        l: 'Última Fecha',
        k: 'fecha',
        r: (d: any) => fdate(d.versions?.[d.versions.length - 1]?.fecha)
      },
      { l: 'Estado', k: 'estado' }
    ];
    exportRows('Repositorio Global de Documentos', cols, filtered, format);
  };

  const QUICK_CHIPS: { id: 'todos' | 'Activos' | 'Anulados'; label: string; icon: string }[] = [
    { id: 'todos', label: `Todos (${totalDocs})`, icon: 'folder-tree' },
    { id: 'Activos', label: `Activos (${totalDocs - anuladosCount})`, icon: 'check-circle' },
    { id: 'Anulados', label: `Anulados (${anuladosCount})`, icon: 'circle-xmark' }
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
              <Icon name="folder-tree" size={24} />
            </span>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                Documentos contractuales
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
                  {totalDocs} {totalDocs === 1 ? 'documento' : 'documentos'}
                </span>
              </h1>
              <p style={{ margin: '4px 0 0' }}>
                Repositorio digital con trazabilidad y versionamiento histórico inmutable por contrato
              </p>
            </div>
          </div>

          {/* Leyenda de estados dentro del hero */}
          <div className="legend" style={{ marginTop: 16 }}>
            <span><span className="sem ok" /> Activo / Vigente</span>
            <span><span className="sem crit" /> Anulado</span>
            <span><span className="sem info" /> vN = historial inmutable de versiones</span>
          </div>
        </div>

        <div className="ph-actions">
          <div className="exp-actions">
            <Button className="btn sm" onClick={() => handleExport('xlsx')} title="Exportar a Excel" aria-label="Exportar documentos a Excel">
              <Icon name="file-excel" /> Excel
            </Button>
            <Button className="btn sm" onClick={() => handleExport('pdf')} title="Exportar a PDF" aria-label="Exportar documentos a PDF">
              <Icon name="file-pdf" /> PDF
            </Button>
            <Button className="btn sm" onClick={() => handleExport('csv')} title="Exportar a CSV" aria-label="Exportar documentos a CSV">
              <Icon name="file-csv" /> CSV
            </Button>
          </div>
          {AuthService.can('crear') && (
            <Link href="/documentos/nuevo" className="btn sm pri">
              <Icon name="upload" /> Cargar documento
            </Link>
          )}
        </div>
      </PageHeader>

      {/* KPI Cards con icono, entrada escalonada y navegación contextual */}
      <div className="kpis mb">
        <Kpi label="Total Documentos" value={totalDocs} icon="file-text" color="brand" className="anim-fade-rise stagger-1 click" onClick={() => { setViewEstado('todos'); setPage(1); }} />
        <Kpi label="Versiones Totales" value={totalVersions} sub="Nunca se eliminan" icon="history" color="info" className="anim-fade-rise stagger-2" />
        <Kpi
          label="Contratos con Faltantes"
          value={faltantesCount}
          sub="Requeridos: Contrato, Propuesta, Pólizas, Actas"
          icon="alert-triangle"
          color={faltantesCount > 0 ? 'warn' : 'ok'}
          className="anim-fade-rise stagger-3"
        />
        <Kpi
          label="Documentos Anulados"
          value={anuladosCount}
          icon="circle-xmark"
          color={anuladosCount > 0 ? 'crit' : 'ok'}
          className="anim-fade-rise stagger-4 click"
          onClick={() => { setViewEstado('Anulados'); setPage(1); }}
        />
      </div>

      {/* Main Panel */}
      <Surface className="panel">
        {/* Filtros */}
        <div className="filters" style={{ padding: '12px 16px' }}>
          <div className="gsearch" style={{ alignSelf: 'flex-end' }}>
            <Icon name="search" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Buscar por nombre, archivo o contrato..."
              aria-label="Buscar documentos por nombre, archivo o contrato"
            />
          </div>
          <Field className="f">
            <label>Contrato</label>
            <Select icon={fieldIcon("filterContract", "Contrato", "")}
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
          <Field className="f">
            <label>Categoría</label>
            <Select icon={fieldIcon("filterCat", "Categoría", "")}
              className="inp sm"
              value={filterCat}
              onChange={(e) => { setFilterCat(e.target.value); setPage(1); }}
            >
              <option value="">— Todas las categorías —</option>
              {CAT('categoriasDoc').map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
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

        {/* Chips de vistas rápidas seleccionables */}
        <div className="filter-chips" role="group" aria-label="Vistas rápidas" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 2 }}>
            <Icon name="eye" size={13} />
            <span>Vistas rápidas:</span>
          </span>
          {QUICK_CHIPS.map((chip) => {
            const isActive = viewEstado === chip.id;
            return (
              <button
                type="button"
                key={chip.id}
                onClick={() => { setViewEstado(chip.id); setPage(1); }}
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

        {/* Tabla de documentos con rail de estado y hover lift */}
        <TableViewport className="tbl-wrap">
          <DataTable className="tbl" aria-label="Expediente documental">
            <thead>
              <tr>
                <th className="nw">Contrato</th>
                <th>Categoría</th>
                <th>Nombre del Documento</th>
                <th>Archivo Actual</th>
                <th className="nw">Versión</th>
                <th className="nw">Fecha</th>
                <th>Usuario</th>
                <th className="nw">Estado</th>
                <th className="nw">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((d, idx) => {
                const c = Store.get('contracts', d.contractId);
                const lastVer = d.versions?.[d.versions.length - 1];
                const isVoid = d.estado === 'Anulado';

                return (
                  <tr
                    key={d.id}
                    className={`rail anim-fade-rise ${isVoid ? 'void' : ''}`}
                    style={{
                      '--railc': isVoid ? 'var(--na)' : 'var(--ok)',
                      animationDelay: `${idx * 25}ms`,
                      transition: 'transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)'
                    } as any}
                    {...rowHover}
                  >
                    <td className="nw">
                      {c ? (
                        <Link
                          className="link font-bold"
                          href={contractHref(c.id, 'documentos')}
                          style={{ cursor: 'pointer' }}
                        >
                          {c.numero}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span className="badge">{d.categoria}</span>
                    </td>
                    <td>
                      <b>{d.nombre}</b>
                      {d.obs && <div className="small muted">{d.obs}</div>}
                    </td>
                    <td className="nw">
                      {lastVer ? (
                        <span className="badge b-na" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', maxWidth: 240 }} title={`Archivo: ${lastVer.archivo}`}>
                          <Icon name="file-text" size={12} /> {lastVer.archivo}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="nw">
                      <span
                        className="badge b-brand font-bold"
                        style={{ cursor: 'pointer', borderRadius: 'var(--r-pill)' }}
                        onClick={() => setSelectedDocHistory(d)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedDocHistory(d);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`Ver historial de versiones de ${d.nombre}`}
                        title="Ver historial de versiones"
                      >
                        v{d.versions?.length || 1}
                      </span>
                    </td>
                    <td className="nw">{lastVer ? fdate(lastVer.fecha) : '—'}</td>
                    <td>{lastVer?.usuario || '—'}</td>
                    <td className="nw">
                      <Badge
                        text={d.estado}
                        color={d.estado === 'Activo' || d.estado === 'Vigente' ? 'ok' : 'crit'}
                      />
                    </td>
                    <td className="nw">
                      <div className="row-flex" style={{ gap: '4px', flexWrap: 'nowrap' }}>
                        <Button
                          className="btn sm"
                          onClick={() => setSelectedDocHistory(d)}
                          title="Historial de versiones"
                          aria-label={`Ver historial de versiones de ${d.nombre}`}
                        >
                          Versiones
                        </Button>
                        {!isVoid && (
                          <>
                            <Link
                              href={`/documentos/${encodeURIComponent(d.id)}/versiones/nueva`}
                              className="btn sm"
                              title="Subir nueva versión"
                              aria-label={`Subir nueva versión de ${d.nombre}`}
                            >
                              <Icon name="upload" />
                            </Link>
                            <Button
                              className="icon-btn"
                              style={{ color: 'var(--crit-text)' }}
                              onClick={() => handleAnular(d)}
                              title="Anular documento"
                              aria-label={`Anular documento ${d.nombre}`}
                            >
                              <Icon name="x" />
                            </Button>
                          </>
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
                      title="No se encontraron documentos"
                      description="Prueba ajustando los filtros o la búsqueda del repositorio."
                      action={
                        hasActiveFilters ? (
                          <Button className="btn sm" onClick={clearFilters} style={{ marginTop: 8 }}>
                            Restablecer filtros
                          </Button>
                        ) : (
                          <Link
                            href="/documentos/nuevo"
                            className="btn sm pri"
                            style={{ marginTop: 8 }}
                          >
                            <Icon name="upload" /> Cargar primer documento
                          </Link>
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
                        <b>{filtered.length}</b> documentos
                      </span>
                      <div className="pager" role="navigation" aria-label="Paginación de documentos">
                        <Button
                          disabled={currentPage <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          aria-label="Página anterior"
                        >
                          &lt;
                        </Button>
                        {Array.from({ length: totalPages }, (_, p) => p + 1).map((p) => (
                          <Button key={p} className={p === currentPage ? 'on' : ''} aria-current={p === currentPage ? 'page' : undefined} aria-label={`Ir a la página ${p}`} onClick={() => setPage(p)}>
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

      {/* Version History Modal */}
      {selectedDocHistory && (
        <Modal
          title={`Historial de versiones: ${selectedDocHistory.nombre}`}
          onClose={() => setSelectedDocHistory(null)}
          size="lg"
          footer={
            <Button className="btn pri" onClick={() => setSelectedDocHistory(null)}>
              Cerrar
            </Button>
          }
        >
          <div>
            <p className="small muted mb-3">
              Categoría: <b>{selectedDocHistory.categoria}</b> · Total versiones:{' '}
              <b>{selectedDocHistory.versions?.length || 1}</b>
            </p>
            <TableViewport className="tbl-wrap">
              <DataTable className="tbl" aria-label="Historial de versiones del documento">
                <thead>
                  <tr>
                    <th className="nw">Versión</th>
                    <th className="nw">Fecha</th>
                    <th>Usuario</th>
                    <th>Archivo</th>
                    <th>Motivo / Cambios</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedDocHistory.versions || []).map((ver) => (
                    <tr key={ver.v}>
                      <td className="nw">
                        <span className="badge b-brand font-bold" style={{ borderRadius: 'var(--r-pill)' }}>v{ver.v}</span>
                      </td>
                      <td className="nw">{fdate(ver.fecha)}</td>
                      <td>{ver.usuario}</td>
                      <td className="nw">
                        <span className="badge b-na" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', maxWidth: 240 }} title={`Archivo: ${ver.archivo}`}>
                          <Icon name="file-text" size={12} /> {ver.archivo}
                        </span>
                      </td>
                      <td>
                        {ver.motivo}
                        {ver.cambios && <div className="small muted">Cambios: {ver.cambios}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </TableViewport>
          </div>
        </Modal>
      )}

    </div>
  );
};
