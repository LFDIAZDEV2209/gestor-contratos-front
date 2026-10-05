'use client';
import { PBar } from '../ui/PBar';
import { Input, Select } from '../ui/Controls';
import { Button } from '../ui/button';
import { PageHeader, Surface, Field, TableViewport, DataTable, EmptyState, WorkspaceSkeleton } from '../ui/Workspace';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { obligationHref, contractHref } from '../app/routes';
import type { Obligation, Contract } from '../../lib/types';
import { Store } from '../../lib/store';
import { effOblig } from '../../lib/metrics';
import { fdate, pct, sum } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Icon } from '../icons';

// Acciones sobre la tabla que mutan Store: marcan el refresco de la vista
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

export const ObligacionesView = ({
  onSelectContract
}: {
  onSelectContract: (cid: string, tab?: string) => void;
}) => {
  const [activeTab, setActiveTab] = useState<'todas' | 'pendientes' | 'vencidas' | 'cumplidas'>('todas');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterContract, setFilterContract] = useState('');
  const [q, setQ] = useState('');
  // Paginación real sobre el listado filtrado
  const [page, setPage] = useState(1);
  const pageSize = 12;
  // Guardia de hidratación: el store vive en localStorage; mientras tanto, skeleton
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Lectura tolerante a fallos del almacenamiento local (manejo de error)
  let loadError: string | null = null;
  const readAll = (kind: 'obligations' | 'contracts'): any[] => {
    try {
      return Store.all(kind) as any[];
    } catch {
      loadError = 'No fue posible leer los datos del expediente. Verifica el almacenamiento del navegador.';
      return [];
    }
  };

  const allObligations = (readAll('obligations') as Obligation[]).slice();
  const allContracts = (readAll('contracts') as Contract[]).filter((c) => !c.anulado);

  const total = allObligations.length;
  const cumplidas = allObligations.filter((o) => o.estado === 'Cumplida').length;
  const vencidas = allObligations.filter((o) => {
    const e = effOblig(o);
    return e === 'Vencida' || e === 'Incumplida';
  }).length;
  // Pendientes reales: ni cumplidas ni vencidas (coincide con la pestaña "Pendientes")
  const pendientes = total - cumplidas - vencidas;
  const avgCumpl = total
    ? sum(allObligations, (o) => Number(o.cumplimiento || 0)) / total
    : 0;
  // Tipos derivados de los datos reales, no de una lista fija
  const tipos = Array.from(new Set(allObligations.map((o) => o.tipo).filter(Boolean)));

  const filtered = allObligations.filter((o) => {
    const eff = effOblig(o);
    if (activeTab === 'pendientes' && (o.estado === 'Cumplida' || eff === 'Vencida')) return false;
    if (activeTab === 'vencidas' && eff !== 'Vencida' && eff !== 'Incumplida') return false;
    if (activeTab === 'cumplidas' && o.estado !== 'Cumplida') return false;

    if (filterTipo && o.tipo !== filterTipo) return false;
    if (filterContract && o.contractId !== filterContract) return false;
    if (q) {
      const matchDesc = o.descripcion.toLowerCase().includes(q.toLowerCase());
      const c = Store.get('contracts', o.contractId);
      const matchContr = c?.numero.toLowerCase().includes(q.toLowerCase()) || false;
      if (!matchDesc && !matchContr) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasActiveFilters = Boolean(q || filterTipo || filterContract || activeTab !== 'todas');

  // Restablece de una sola vez todos los criterios del listado
  const clearFilters = () => {
    setQ('');
    setFilterTipo('');
    setFilterContract('');
    setActiveTab('todas');
    setPage(1);
  };

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      {
        l: 'Contrato',
        k: 'contractId',
        r: (o: any) => {
          const c = Store.get('contracts', o.contractId);
          return c ? c.numero : o.contractId;
        }
      },
      { l: 'Tipo', k: 'tipo' },
      { l: 'Descripción', k: 'descripcion' },
      { l: 'Responsable', k: 'responsable' },
      { l: 'Vencimiento', k: 'fechaLimite', r: (o: any) => fdate(o.fechaLimite) },
      { l: 'Periodicidad', k: 'periodicidad' },
      { l: '% Cumplimiento', k: 'cumplimiento', r: (o: any) => pct(o.cumplimiento || 0) },
      { l: 'Estado Efectivo', k: 'estado', r: (o: any) => effOblig(o) },
      { l: 'Verificado Por', k: 'verificadoPor' }
    ];
    exportRows('Matriz Global de Obligaciones', cols, filtered, format);
  };

  return (
    <div className="anim-fade-rise">
      {!mounted ? (
        <WorkspaceSkeleton />
      ) : loadError ? (
        <div className="feedback-notice" role="alert">
          <Icon name="triangle-exclamation" />
          <div>
            <b>Error al cargar obligaciones.</b> {loadError}
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
              <Icon name="list-check" size={24} />
            </span>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                Obligaciones contractuales
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
                  {filtered.length} {filtered.length === 1 ? 'obligación' : 'obligaciones'}
                </span>
              </h1>
              <p style={{ margin: '4px 0 0' }}>
                Supervisión, checklist de evidencias y verificación de cumplimiento del portafolio
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
        </div>
      </PageHeader>

      {/* KPI Cards: Kpi v2 con icono, tono semántico y clic que activa su vista */}
      <div className="kpis mb">
        <Kpi
          label="Total Obligaciones"
          value={total}
          icon="list-check"
          color="brand"
          className="anim-fade-rise stagger-1 click"
          onClick={() => {
            setActiveTab('todas');
            setPage(1);
          }}
        />
        <Kpi
          label="Cumplimiento Promedio"
          value={pct(avgCumpl, 0)}
          icon="chart-line"
          color={avgCumpl >= 80 ? 'ok' : 'warn'}
          className="anim-fade-rise stagger-2"
        />
        <Kpi
          label="Pendientes"
          value={pendientes}
          icon="hourglass-half"
          color={pendientes > 0 ? 'warn' : 'ok'}
          className="anim-fade-rise stagger-3 click"
          onClick={() => {
            setActiveTab('pendientes');
            setPage(1);
          }}
        />
        <Kpi
          label="Vencidas / En riesgo"
          value={vencidas}
          icon="alert-circle"
          color={vencidas > 0 ? 'crit' : 'ok'}
          className="anim-fade-rise stagger-4 click"
          onClick={() => {
            setActiveTab('vencidas');
            setPage(1);
          }}
        />
      </div>

      {/* Main Panel */}
      <Surface className="panel">
        {/* Quick Views Tabs con icono */}
        <div className="tabs" style={{ padding: '0 12px' }} role="tablist" aria-label="Filtro de obligaciones por estado">
          <Button
            role="tab"
            aria-selected={activeTab === 'todas'}
            className={`tab ${activeTab === 'todas' ? 'on' : ''}`}
            aria-pressed={activeTab === 'todas'}
            onClick={() => {
              setActiveTab('todas');
              setPage(1);
            }}
          >
            <Icon name="list-check" size={12} /> Todas ({total})
          </Button>
          <Button
            role="tab"
            aria-selected={activeTab === 'pendientes'}
            className={`tab ${activeTab === 'pendientes' ? 'on' : ''}`}
            aria-pressed={activeTab === 'pendientes'}
            onClick={() => {
              setActiveTab('pendientes');
              setPage(1);
            }}
          >
            <Icon name="hourglass-half" size={12} /> Pendientes / En proceso ({pendientes})
          </Button>
          <Button
            role="tab"
            aria-selected={activeTab === 'vencidas'}
            className={`tab ${activeTab === 'vencidas' ? 'on' : ''}`}
            aria-pressed={activeTab === 'vencidas'}
            onClick={() => {
              setActiveTab('vencidas');
              setPage(1);
            }}
          >
            <Icon name="alert-circle" size={12} /> Vencidas ({vencidas})
          </Button>
          <Button
            role="tab"
            aria-selected={activeTab === 'cumplidas'}
            className={`tab ${activeTab === 'cumplidas' ? 'on' : ''}`}
            aria-pressed={activeTab === 'cumplidas'}
            onClick={() => {
              setActiveTab('cumplidas');
              setPage(1);
            }}
          >
            <Icon name="check-circle" size={12} /> Cumplidas ({cumplidas})
          </Button>
        </div>

        {/* Filter Toolbar */}
        <div className={`filters ${hasActiveFilters ? '' : 'mb'}`} style={{ padding: '12px 16px' }}>
          <div className="gsearch">
            <Icon name="search" />
            <Input
              value={q}
              aria-label="Buscar obligaciones"
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por descripción u objeto..."
            />
          </div>
          <Field className="f">
            <label>Contrato</label>
            <Select
              className="inp sm"
              value={filterContract}
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
          <Field className="f">
            <label>Tipo</label>
            <Select
              className="inp sm"
              value={filterTipo}
              onChange={(e) => {
                setFilterTipo(e.target.value);
                setPage(1);
              }}
            >
              <option value="">— Todos los tipos —</option>
              {tipos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>

          {hasActiveFilters && (
            <Button
              className="btn sm ghost"
              onClick={clearFilters}
              style={{ alignSelf: 'flex-end', height: 38 }}
            >
              <Icon name="trash" /> Limpiar filtros
            </Button>
          )}
        </div>

        {/* Chips de filtros activos: cada criterio se puede quitar por separado */}
        {hasActiveFilters && (
          <div className="filter-chips" role="group" aria-label="Filtros activos" style={{ marginBottom: 16 }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginRight: 2 }}>
              Filtros activos:
            </span>
            {activeTab !== 'todas' && (
              <span className="filter-chip">
                <Icon name="eye" size={11} /> Vista: {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                <button
                  type="button"
                  className="filter-chip-remove"
                  onClick={() => {
                    setActiveTab('todas');
                    setPage(1);
                  }}
                  aria-label="Quitar el filtro de vista"
                  title="Quitar filtro"
                >
                  <Icon name="xmark" size={12} />
                </button>
              </span>
            )}
            {q && (
              <span className="filter-chip">
                <Icon name="search" size={11} /> Búsqueda: «{q}»
                <button
                  type="button"
                  className="filter-chip-remove"
                  onClick={() => {
                    setQ('');
                    setPage(1);
                  }}
                  aria-label="Quitar el filtro de búsqueda"
                  title="Quitar filtro"
                >
                  <Icon name="xmark" size={12} />
                </button>
              </span>
            )}
            {filterContract && (
              <span className="filter-chip">
                <Icon name="file-signature" size={11} /> Contrato:{' '}
                {Store.get('contracts', filterContract)?.numero || 'seleccionado'}
                <button
                  type="button"
                  className="filter-chip-remove"
                  onClick={() => {
                    setFilterContract('');
                    setPage(1);
                  }}
                  aria-label="Quitar el filtro de contrato"
                  title="Quitar filtro"
                >
                  <Icon name="xmark" size={12} />
                </button>
              </span>
            )}
            {filterTipo && (
              <span className="filter-chip">
                <Icon name="list-check" size={11} /> Tipo: {filterTipo}
                <button
                  type="button"
                  className="filter-chip-remove"
                  onClick={() => {
                    setFilterTipo('');
                    setPage(1);
                  }}
                  aria-label="Quitar el filtro de tipo"
                  title="Quitar filtro"
                >
                  <Icon name="xmark" size={12} />
                </button>
              </span>
            )}
          </div>
        )}

        {/* Table */}
        <TableViewport className="tbl-wrap">
          <DataTable className="tbl" aria-label="Listado de obligaciones contractuales">
            <thead>
              <tr>
                <th className="nw">Contrato</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Responsable</th>
                <th className="nw">Vencimiento</th>
                <th className="nw" style={{ minWidth: '120px' }}>
                  % Avance
                </th>
                <th className="nw">Estado</th>
                <th>Verificado</th>
                <th className="nw">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((o, idx) => {
                const c = Store.get('contracts', o.contractId);
                const eff = effOblig(o);
                const vencidaEff = eff === 'Vencida' || eff === 'Incumplida';
                return (
                  <tr
                    key={o.id}
                    className="anim-fade-rise"
                    style={{ animationDelay: `${idx * 25}ms`, transition: 'transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)' }}
                    {...HOVER_LIFT}
                  >
                    <td className="nw">
                      {c ? (
                        <Link
                          className="link font-bold"
                          href={contractHref(c.id, 'obligaciones')}
                          style={{ cursor: 'pointer' }}
                        >
                          {c.numero}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span className="badge b-info">{o.tipo}</span>
                    </td>
                    <td
                      className="clip"
                      style={{ maxWidth: '280px' }}
                      title={o.descripcion}
                    >
                      <Link
                        href={obligationHref(o.id)}
                        style={{ cursor: 'pointer', color: 'inherit' }}
                        title="Abrir la ficha de la obligación"
                      >
                        <b>{o.descripcion}</b>
                      </Link>
                    </td>
                    <td
                      className="clip"
                      style={{ maxWidth: '190px' }}
                      title={o.responsable}
                    >
                      {o.responsable}
                    </td>
                    <td className="nw">
                      {vencidaEff ? (
                        <span className="badge b-crit" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          <Icon name="triangle-exclamation" size={11} /> {fdate(o.fechaLimite)}
                        </span>
                      ) : (
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-2)' }}>
                          {fdate(o.fechaLimite)}
                        </span>
                      )}
                    </td>
                    <td className="nw">
                      <PBar value={o.cumplimiento || 0} color={eff === 'Cumplida' ? 'var(--ok)' : vencidaEff ? 'var(--crit)' : 'var(--brand)'} />
                    </td>
                    <td className="nw">
                      <Badge
                        text={eff}
                        color={
                          eff === 'Cumplida'
                            ? 'ok'
                            : vencidaEff
                            ? 'crit'
                            : eff === 'En proceso'
                            ? 'info'
                            : 'warn'
                        }
                      />
                    </td>
                    <td className="small muted">
                      {o.verificadoPor ? `${o.verificadoPor} (${fdate(o.verificadoFecha)})` : '—'}
                    </td>
                    <td className="nw">
                      <Link
                        className="btn sm"
                        href={obligationHref(o.id)}
                        title="Ver detalle y checklist"
                      >
                        Ficha
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      title={activeTab === 'vencidas' ? 'Sin obligaciones vencidas' : 'No se encontraron obligaciones'}
                      description={
                        hasActiveFilters
                          ? 'Ajusta la búsqueda, la pestaña activa o los filtros para ver más resultados.'
                          : 'Cuando se registren obligaciones en los contratos aparecerán aquí.'
                      }
                      action={
                        hasActiveFilters ? (
                          <Button
                            className="btn sm"
                            style={{ marginTop: 8 }}
                            onClick={clearFilters}
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
                  <td colSpan={9}>
                    <div className="tbl-foot">
                      <span>
                        Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} de{' '}
                        <b>{filtered.length}</b> obligaciones
                      </span>
                      <div className="pager" role="navigation" aria-label="Paginación de obligaciones">
                        <Button
                          disabled={currentPage <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          aria-label="Página anterior"
                        >
                          &lt;
                        </Button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                          <Button
                            key={p}
                            className={p === currentPage ? 'on' : ''}
                            aria-current={p === currentPage ? 'page' : undefined}
                            onClick={() => setPage(p)}
                            aria-label={`Ir a la página ${p}`}
                          >
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
        </>
      )}
    </div>
  );
};
