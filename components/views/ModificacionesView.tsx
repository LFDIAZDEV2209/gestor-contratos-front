'use client';
import { fieldIcon } from '../forms/fieldIcon';
import { contractHref } from '../app/routes';
import Link from 'next/link';
import { Input, Select } from '../ui/Controls';
import { Button } from '../ui/button';
import { PageHeader, Surface, Field, TableViewport, DataTable, EmptyState, WorkspaceSkeleton } from '../ui/Workspace';
import { useState, useEffect } from 'react';
import type { Modification, Contract } from '../../lib/types';
import { Store, AuthService } from '../../lib/store';
import { M, companyName } from '../../lib/metrics';
import { money, moneyM, fdate, diffDays } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
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

export const ModificacionesView = ({
  onSelectContract
}: {
  onSelectContract: (cid: string, tab?: string) => void;
}) => {
  const [filterTipo, setFilterTipo] = useState('');
  const [filterContract, setFilterContract] = useState('');
  const [q, setQ] = useState('');
  // Paginación real + guardia de hidratación + refresco tras mutaciones
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Lectura tolerante a fallos del almacenamiento local (manejo de error)
  let loadError: string | null = null;
  const readAll = (kind: 'modifications' | 'contracts'): any[] => {
    try {
      return Store.all(kind) as any[];
    } catch {
      loadError = 'No fue posible leer el historial de modificaciones del almacenamiento local.';
      return [];
    }
  };

  const allModifications = (readAll('modifications') as Modification[]).slice().sort((a, b) =>
    (a.fecha || '') < (b.fecha || '') ? 1 : -1
  );
  const allContracts = (readAll('contracts') as Contract[]).filter((c) => !c.anulado);

  const totalMods = allModifications.length;
  const totalAdiciones = allModifications
    .filter((x) => x.tipo === 'Adición')
    .reduce((acc, curr) => acc + (Number(curr.valorNuevo) - Number(curr.valorAnterior || 0)), 0);
  const totalReducciones = allModifications
    .filter((x) => x.tipo === 'Reducción')
    .reduce((acc, curr) => acc + (Number(curr.valorAnterior || 0) - Number(curr.valorNuevo)), 0);
  const totalProrrogas = allModifications.filter((x) => x.tipo === 'Prórroga').length;

  const filtered = allModifications.filter((m) => {
    if (filterTipo && m.tipo !== filterTipo) return false;
    if (filterContract && m.contractId !== filterContract) return false;
    if (q) {
      const matchNum = m.numero.toLowerCase().includes(q.toLowerCase());
      const matchJust = m.justificacion.toLowerCase().includes(q.toLowerCase());
      const c = Store.get('contracts', m.contractId);
      const matchContr = c?.numero.toLowerCase().includes(q.toLowerCase()) || false;
      if (!matchNum && !matchJust && !matchContr) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasActiveFilters = Boolean(q || filterTipo || filterContract);

  // Restablece de una sola vez todos los criterios del listado
  const clearFilters = () => {
    setQ('');
    setFilterTipo('');
    setFilterContract('');
    setPage(1);
  };

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      {
        l: 'Contrato',
        k: 'contractId',
        r: (m: any) => {
          const c = Store.get('contracts', m.contractId);
          return c ? c.numero : m.contractId;
        }
      },
      { l: 'Número', k: 'numero' },
      { l: 'Tipo', k: 'tipo' },
      { l: 'Fecha', k: 'fecha', r: (m: any) => fdate(m.fecha) },
      { l: 'Justificación', k: 'justificacion' },
      {
        l: 'Efecto en valor',
        k: 'val',
        r: (m: any) => (m.valorNuevo ? money(m.valorNuevo) : '—')
      },
      {
        l: 'Nueva Fecha',
        k: 'fechaNueva',
        r: (m: any) => (m.fechaNueva ? fdate(m.fechaNueva) : '—')
      }
    ];
    exportRows('Modificaciones Contractuales Globales', cols, filtered, format);
  };

  return (
    <div className="anim-fade-rise">
      {!mounted ? (
        <WorkspaceSkeleton />
      ) : loadError ? (
        <div className="feedback-notice" role="alert">
          <Icon name="triangle-exclamation" />
          <div>
            <b>Error al cargar las modificaciones.</b> {loadError}
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
              <Icon name="code-compare" size={24} />
            </span>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                Modificaciones contractuales
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
                  {filtered.length} {filtered.length === 1 ? 'modificación' : 'modificaciones'}
                </span>
              </h1>
              <p style={{ margin: '4px 0 0' }}>
                Historial de adiciones, prórrogas, suspensiones, reinicios y cesiones con efectos
                automáticos
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
          {AuthService.can('editar') && (
            <Link href="/modificaciones/nueva" className="btn sm pri">
              <Icon name="plus" /> Nueva modificación
            </Link>
          )}
        </div>
      </PageHeader>

      {/* KPI Cards: Kpi v2 con icono y tono semántico */}
      <div className="kpis mb">
        <Kpi
          label="Total Modificaciones"
          value={totalMods}
          icon="code-compare"
          color="brand"
          className="anim-fade-rise stagger-1"
        />
        <Kpi
          label="Total Adiciones"
          value={moneyM(totalAdiciones)}
          sub={money(totalAdiciones)}
          icon="plus"
          color={totalAdiciones > 0 ? 'ok' : 'na'}
          className="anim-fade-rise stagger-2"
        />
        <Kpi
          label="Total Reducciones"
          value={moneyM(totalReducciones)}
          sub={money(totalReducciones)}
          icon="scale-balanced"
          color={totalReducciones > 0 ? 'warn' : 'na'}
          className="anim-fade-rise stagger-3"
        />
        <Kpi
          label="Prórrogas Suscritas"
          value={totalProrrogas}
          icon="calendar-days"
          color="info"
          className="anim-fade-rise stagger-4"
        />
      </div>

      {/* Table Panel */}
      <Surface className="panel">
        <div className={`filters ${hasActiveFilters ? '' : 'mb'}`} style={{ padding: '12px 16px' }}>
          <div className="gsearch">
            <Icon name="search" />
            <Input
              value={q}
              aria-label="Buscar modificaciones"
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por justificación, número o contrato..."
            />
          </div>
          <Field className="f">
            <label>Contrato</label>
            <Select icon={fieldIcon("filterContract", "Contrato", "")}
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
            <Select icon={fieldIcon("filterTipo", "Tipo", "")}
              className="inp sm"
              value={filterTipo}
              onChange={(e) => {
                setFilterTipo(e.target.value);
                setPage(1);
              }}
            >
              <option value="">— Todos los tipos —</option>
              <option value="Adición">Adición</option>
              <option value="Reducción">Reducción</option>
              <option value="Prórroga">Prórroga</option>
              <option value="Suspensión">Suspensión</option>
              <option value="Reinicio">Reinicio</option>
              <option value="Cesión">Cesión</option>
              <option value="Modificación de supervisor">Modificación de supervisor</option>
              <option value="Terminación anticipada">Terminación anticipada</option>
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
                <Icon name="code-compare" size={11} /> Tipo: {filterTipo}
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

        <TableViewport className="tbl-wrap">
          <DataTable className="tbl" aria-label="Actos y modificaciones contractuales">
            <thead>
              <tr>
                <th className="nw">Contrato</th>
                <th className="nw">Número</th>
                <th>Tipo</th>
                <th className="nw">Fecha</th>
                <th>Justificación / Impacto</th>
                <th className="nw num">Cambio de Valor</th>
                <th className="nw">Cambio de Plazo</th>
                <th>Nuevo Texto</th>
                <th className="nw">Soporte</th>
                <th className="nw">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((m, idx) => {
                const c = Store.get('contracts', m.contractId);
                const diffVal =
                  m.valorNuevo && m.valorAnterior
                    ? Number(m.valorNuevo) - Number(m.valorAnterior)
                    : null;
                const daysExt =
                  m.fechaNueva && m.fechaAnterior
                    ? diffDays(m.fechaAnterior, m.fechaNueva)
                    : null;

                return (
                  <tr
                    key={m.id}
                    className="anim-fade-rise"
                    style={{ animationDelay: `${idx * 25}ms`, transition: 'transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)' }}
                    {...HOVER_LIFT}
                  >
                    <td className="nw">
                      {c ? (
                        <Link
                          className="link font-bold"
                          href={contractHref(c.id, 'modificaciones')}
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
                      <b>{m.numero}</b>
                    </td>
                    <td>
                      <Badge
                        text={m.tipo}
                        color={
                          m.tipo === 'Adición'
                            ? 'ok'
                            : m.tipo === 'Reducción'
                            ? 'warn'
                            : m.tipo === 'Suspensión'
                            ? 'crit'
                            : m.tipo === 'Reinicio'
                            ? 'brand'
                            : 'default'
                        }
                      />
                    </td>
                    <td className="nw">{fdate(m.fecha)}</td>
                    <td className="clip" style={{ maxWidth: '280px' }} title={m.justificacion}>
                      {m.justificacion}
                      {m.impacto && <div className="small muted">{m.impacto}</div>}
                    </td>
                    <td className="nw num">
                      {m.valorNuevo ? (
                        <div>
                          <div>{money(m.valorNuevo)}</div>
                          {diffVal != null && (
                            <div
                              className="small"
                              style={{
                                color: diffVal > 0 ? 'var(--ok-text)' : 'var(--crit-text)',
                                fontWeight: 600
                              }}
                            >
                              {diffVal > 0 ? '+' : ''}
                              {money(diffVal)}
                            </div>
                          )}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="nw">
                      {m.fechaNueva ? (
                        <div>
                          <div>{fdate(m.fechaNueva)}</div>
                          {daysExt != null && daysExt !== 0 && (
                            <div className="small muted">+{daysExt} días</div>
                          )}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="clip" style={{ maxWidth: '160px' }} title={m.nuevoTexto || undefined}>
                      {m.nuevoTexto || '—'}
                    </td>
                    <td className="nw">
                      {m.soporte ? (
                        <span className="link">
                          <Icon name="paperclip" /> {m.soporte}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="nw">
                      {c && (
                        <Button
                          className="btn sm"
                          onClick={() => onSelectContract(c.id, 'modificaciones')}
                        >
                          Expediente
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10}>
                    <EmptyState
                      title="No se encontraron modificaciones"
                      description={
                        hasActiveFilters
                          ? 'Ajusta la búsqueda o el tipo/contrato filtrado para ver más resultados.'
                          : 'Cuando se registren adiciones, prórrogas u otrosíes aparecerán aquí.'
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
                  <td colSpan={10}>
                    <div className="tbl-foot">
                      <span>
                        Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} de{' '}
                        <b>{filtered.length}</b> modificaciones
                      </span>
                      <div className="pager" role="navigation" aria-label="Paginación de modificaciones contractuales">
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
