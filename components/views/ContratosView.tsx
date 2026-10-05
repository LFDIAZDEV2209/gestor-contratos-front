'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input, Select } from '../ui/Controls';
import { Button } from '../ui/button';
import { PageHeader, Surface, Field, TableViewport, DataTable, EmptyState } from '../ui/Workspace';
import { contractHref } from '../app/routes';
import { useQueryFilters } from '../app/useQueryFilters';
import type { Contract } from '../../lib/types';
import { Store } from '../../lib/store';
import { M, companyName } from '../../lib/metrics';
import { Icon } from '../icons';
import { Badge } from '../ui/Badge';
import { PBar } from '../ui/PBar';
import { Kpi } from '../ui/Kpi';
import { money as fmtMoney, moneyM as fmtMoneyM, daysTxt } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { DEPTOS } from '../../lib/geo';

export const ContratosView = () => {
  const [contracts] = useState<Contract[]>(Store.all('contracts'));

  // Edición/creación de contrato: navegación a la vista dedicada (sin modal)

  // Filtros sincronizados con la URL
  const [query, updateQuery] = useQueryFilters();
  const q = query.get('q') || '';
  const filterEstado = query.get('estado') || '';
  const filterEmpresa = query.get('empresa') || '';
  const filterSem = query.get('nivel') || '';
  const quickFilter = query.get('vista');
  const geoFilter = query.has('depto') ? 'depto:' + query.get('depto') : query.has('region') ? 'reg:' + query.get('region') : '';

  const setQ = (value: string) => updateQuery({ q: value });
  const setFilterEstado = (value: string) => updateQuery({ estado: value });
  const setFilterEmpresa = (value: string) => updateQuery({ empresa: value });
  const setFilterSem = (value: string) => updateQuery({ nivel: value });
  const setQuickFilter = (value: string | null) => updateQuery({ vista: value });
  const setGeoFilter = (_value: string) => updateQuery({ depto: null, region: null });

  // Paginación
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const companies = Store.all('companies');

  const filtered = contracts.filter((c) => {
    const num = c.numero || (c as any).num || '';
    const obj = c.objeto || (c as any).obj || '';
    const cont = c.contratista || '';
    const nit = c.nitContratista || '';
    const m = M(c.id);

    if (geoFilter) {
      const [kind, value] = geoFilter.split(':');
      const deptos = c.deptos || [c.departamento || c.depto || ''];
      if (kind === 'depto' && !deptos.includes(value)) return false;
      if (kind === 'reg' && !deptos.some((d) => DEPTOS[d]?.[1] === value)) return false;
    }

    // Búsqueda de texto
    if (q) {
      const ql = q.toLowerCase();
      const match =
        num.toLowerCase().includes(ql) ||
        obj.toLowerCase().includes(ql) ||
        cont.toLowerCase().includes(ql) ||
        nit.toLowerCase().includes(ql);
      if (!match) return false;
    }

    // Estado
    if (filterEstado && m.estado !== filterEstado) return false;

    // Empresa
    if (filterEmpresa && c.companyId !== filterEmpresa) return false;

    // Semáforo
    if (filterSem && m.sem !== filterSem) return false;

    // Quick filters
    if (quickFilter === 'vencidos' && m.estado !== 'Vencido') return false;
    if (quickFilter === 'proximos' && !(m.activo && m.restantes != null && m.restantes >= 0 && m.restantes <= 30)) return false;
    if (quickFilter === 'sobreejec' && m.pctFin <= 100) return false;
    if (quickFilter === 'riesgo' && m.sem !== 'crit' && m.sem !== 'risk') return false;

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedContracts = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExport = () => {
    const cols = [
      { l: 'Número', x: (c: Contract) => c.numero || (c as any).num },
      { l: 'Empresa', x: (c: Contract) => companyName(c.companyId || (c as any).company) },
      { l: 'Contratista', x: (c: Contract) => c.contratista },
      { l: 'Objeto', x: (c: Contract) => c.objeto || (c as any).obj },
      { l: 'Estado', x: (c: Contract) => M(c).estado },
      { l: 'Semáforo', x: (c: Contract) => M(c).sem },
      { l: 'Valor Actual', x: (c: Contract) => M(c).valorActual },
      { l: '% Avance Fin.', x: (c: Contract) => M(c).pctFin },
      { l: 'Días Restantes', x: (c: Contract) => M(c).restantes ?? '—' }
    ];
    exportRows('Contratos Seven Safe', cols, filtered, 'xlsx');
  };

  const clearAllFilters = () => {
    updateQuery({ q: null, estado: null, empresa: null, nivel: null, vista: null, depto: null, region: null });
    setPage(1);
  };

  const hasActiveFilters = Boolean(q || filterEstado || filterEmpresa || filterSem || quickFilter || geoFilter);

  // Métricas agregadas para KPIs
  const totalActivos = contracts.filter((c) => M(c).activo).length;
  const totalCriticos = contracts.filter((c) => M(c).sem === 'crit').length;
  const totalRiesgo = contracts.filter((c) => ['warn', 'risk'].includes(M(c).sem)).length;
  const valorTotal = contracts.reduce((acc, c) => acc + (M(c).valorActual || 0), 0);

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
              <Icon name="file-contract" size={24} />
            </span>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                Contratos
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
                  {filtered.length} {filtered.length === 1 ? 'contrato' : 'contratos'}
                </span>
              </h1>
              <p style={{ margin: '4px 0 0' }}>
                Registro maestro de contratos, seguimiento financiero y control preventivo de vencimientos
              </p>
            </div>
          </div>

          {/* Leyenda institucional de semáforo dentro del hero */}
          <div className="legend" style={{ marginTop: 16 }}>
            <span><span className="sem ok" /> Normal (&gt;30d)</span>
            <span><span className="sem warn" /> Atención (16–30d)</span>
            <span><span className="sem risk" /> Riesgo (1–15d / &gt;90% fin.)</span>
            <span><span className="sem crit" /> Crítico (&le;0d / &gt;100% fin.)</span>
          </div>
        </div>

        <div className="ph-actions">
          <Button className="btn" onClick={handleExport} title="Descargar como Excel">
            <Icon name="file-excel" /> Exportar XLSX
          </Button>
          <Link className="btn pri" href="/contratos/nuevo">
            <Icon name="plus" /> Nuevo Contrato
          </Link>
        </div>
      </PageHeader>

      {/* KPI Cards con lenguaje canónico Kpi v2 y entrada escalonada */}
      <div className="kpis mb">
        <Kpi
          label="Total Registros"
          value={contracts.length.toString()}
          icon="file-contract"
          color="brand"
          className="anim-fade-rise stagger-1 click"
          onClick={() => {
            updateQuery({ vista: null, estado: null, nivel: null });
            setPage(1);
          }}
        />
        <Kpi
          label="Contratos Activos"
          value={totalActivos.toString()}
          color="ok"
          icon="check-circle"
          className="anim-fade-rise stagger-2 click"
          onClick={() => {
            updateQuery({ estado: 'Activo', vista: null });
            setPage(1);
          }}
        />
        <Kpi
          label="Vencidos / Críticos"
          value={totalCriticos.toString()}
          color="crit"
          icon="alert-circle"
          className="anim-fade-rise stagger-3 click"
          onClick={() => {
            updateQuery({ vista: 'vencidos' });
            setPage(1);
          }}
        />
        <Kpi
          label="En Atención / Riesgo"
          value={totalRiesgo.toString()}
          color="warn"
          icon="alert-triangle"
          className="anim-fade-rise stagger-4 click"
          onClick={() => {
            updateQuery({ vista: 'riesgo' });
            setPage(1);
          }}
        />
        <Kpi
          label="Compromiso Total"
          value={fmtMoneyM(valorTotal)}
          sub={fmtMoney(valorTotal)}
          icon="wallet"
          color="info"
          className="anim-fade-rise stagger-5"
        />
      </div>

      {/* Filtro territorial activo si existe */}
      {geoFilter && (
        <div className="filter-bar mb" style={{ background: 'var(--surface)', padding: '10px 16px', borderRadius: 'var(--r)', border: '1px solid var(--line)' }}>
          <span style={{ fontSize: '13px', color: 'var(--ink)' }}>
            Filtro Territorial: <strong style={{ color: 'var(--brand)' }}>{geoFilter.split(':')[1]}</strong>
          </span>
          <Button className="btn sm ghost" onClick={() => setGeoFilter('')}>
            Quitar filtro territorial
          </Button>
        </div>
      )}

      {/* Panel de Filtros y Búsqueda con focus ring de marca */}
      <Surface className="panel mb">
        <div className="filters">
          <div className="gsearch" style={{ minWidth: 260 }}>
            <Icon name="search" />
            <Input
              className="inp"
              style={{ transition: 'border-color var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)' }}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por número, contratista, objeto, NIT..."
              aria-label="Buscar contratos por número, contratista, objeto o NIT"
            />
          </div>

          <Field className="f">
            <label>Estado</label>
            <Select
              className="inp"
              style={{ transition: 'border-color var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)' }}
              value={filterEstado}
              onChange={(e) => {
                setFilterEstado(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los estados</option>
              <option value="Activo">Activo</option>
              <option value="Vencido">Vencido</option>
              <option value="Suspendido">Suspendido</option>
              <option value="En liquidación">En liquidación</option>
              <option value="Liquidado">Liquidado</option>
            </Select>
          </Field>

          <Field className="f">
            <label>Empresa</label>
            <Select
              className="inp"
              style={{ transition: 'border-color var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)' }}
              value={filterEmpresa}
              onChange={(e) => {
                setFilterEmpresa(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas las empresas</option>
              {companies.map((co) => (
                <option key={co.id} value={co.id}>
                  {co.razon || (co as any).name}
                </option>
              ))}
            </Select>
          </Field>

          <Field className="f">
            <label>Semáforo</label>
            <Select
              className="inp"
              style={{ transition: 'border-color var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)' }}
              value={filterSem}
              onChange={(e) => {
                setFilterSem(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los niveles</option>
              <option value="ok">Normal (Verde)</option>
              <option value="warn">Atención (Amarillo)</option>
              <option value="risk">Riesgo (Naranja)</option>
              <option value="crit">Crítico (Rojo)</option>
            </Select>
          </Field>

          {hasActiveFilters && (
            <Button
              className="btn sm ghost"
              onClick={clearAllFilters}
              style={{ alignSelf: 'flex-end', height: 38 }}
            >
              <Icon name="trash" /> Limpiar filtros
            </Button>
          )}
        </div>

        {/* Chips de acceso rápido seleccionables con microinteracción de escala al activar */}
        <div className="filter-chips" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 2 }}>
            <Icon name="clock" size={13} />
            <span>Vistas rápidas:</span>
          </span>
          {[
            { id: 'proximos', label: 'Próximos a vencer (≤30d)', icon: 'clock' },
            { id: 'vencidos', label: 'Vencidos', icon: 'alert-circle' },
            { id: 'sobreejec', label: 'Sobreejecución (>100%)', icon: 'trending-up' },
            { id: 'riesgo', label: 'Críticos / Riesgo', icon: 'alert-triangle' }
          ].map((chip) => {
            const isActive = quickFilter === chip.id;
            return (
              <button
                type="button"
                key={chip.id}
                onClick={() => {
                  setQuickFilter(isActive ? null : chip.id);
                  setPage(1);
                }}
                className={`btn xs ${isActive ? 'active-chip' : 'ghost'}`}
                style={{
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
                }}
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

        {/* Tabla de Contratos con efecto hover lift */}
        <TableViewport className="tbl-wrap">
          <DataTable className="tbl">
            <thead>
              <tr>
                <th style={{ width: 56, textAlign: 'center' }}>Sem</th>
                <th style={{ width: 118, whiteSpace: 'nowrap' }}>Número</th>
                <th style={{ width: 190 }}>Empresa</th>
                <th style={{ minWidth: 260 }}>Contratista y Objeto</th>
                <th style={{ width: 120 }}>Estado</th>
                <th className="num" style={{ width: 140, whiteSpace: 'nowrap' }}>Valor Actual</th>
                <th style={{ width: 160 }}>Avance Fin.</th>
                <th style={{ width: 140 }}>Días Restantes</th>
                <th style={{ width: 90, textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pagedContracts.map((c, idx) => {
                const metrics = M(c.id);
                const rail =
                  metrics.sem === 'ok'
                    ? 'var(--ok)'
                    : metrics.sem === 'warn'
                    ? 'var(--warn)'
                    : metrics.sem === 'risk'
                    ? 'var(--risk)'
                    : 'var(--crit)';
                const co = Store.get('companies', c.companyId || (c as any).company || '');
                const num = c.numero || (c as any).num || '';
                const obj = c.objeto || (c as any).obj || '';
                const st = metrics.estado;

                return (
                  <tr
                    key={c.id}
                    className="rail anim-fade-rise"
                    style={{
                      '--railc': rail,
                      animationDelay: `${idx * 25}ms`,
                      transition: 'transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)'
                    } as any}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-2)';
                      e.currentTarget.style.position = 'relative';
                      e.currentTarget.style.zIndex = '2';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.zIndex = 'auto';
                    }}
                  >
                    <td style={{ textAlign: 'center' }}>
                      <span className={`sem ${metrics.sem}`} title={`Semáforo: ${metrics.sem}`} />
                    </td>
                    <td>
                      <Link
                        className="link mono"
                        href={contractHref(c.id)}
                        title="Ver expediente digital"
                        style={{ fontWeight: 700 }}
                      >
                        {num}
                      </Link>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{co?.razon || (co as any).name || '—'}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{c.contratista || '—'}</div>
                      <div className="clip" style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: 2 }}>
                        {obj}
                      </div>
                    </td>
                    <td>
                      <Badge
                        text={st}
                        color={st === 'Activo' ? 'ok' : st === 'Vencido' ? 'crit' : st === 'Suspendido' ? 'warn' : 'na'}
                      />
                    </td>
                    <td className="num">
                      <span style={{ fontWeight: 600 }}>{fmtMoney(metrics.valorActual)}</span>
                    </td>
                    <td>
                      <PBar value={metrics.pctFin} showLabel={true} />
                    </td>
                    <td>
                      {metrics.daysLeft < 0 ? (
                        <span className="badge b-crit" style={{ fontSize: '11px', borderRadius: 'var(--r-pill)' }}>
                          {daysTxt(metrics.daysLeft)}
                        </span>
                      ) : metrics.daysLeft <= 15 ? (
                        <span className="badge b-warn" style={{ fontSize: '11px', borderRadius: 'var(--r-pill)' }}>
                          {daysTxt(metrics.daysLeft)}
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {daysTxt(metrics.daysLeft)}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="acts">
                        <Link
                          href={contractHref(c.id)}
                          className="icon-btn"
                          title="Ver expediente digital"
                          aria-label={`Ver expediente de ${num}`}
                        >
                          <Icon name="search" />
                        </Link>
                        <Link
                          href={`/contrato/${encodeURIComponent(c.id)}/editar`}
                          className="icon-btn"
                          title="Editar contrato"
                          aria-label={`Editar contrato ${num}`}
                        >
                          <Icon name="cog" />
                        </Link>
                        <details className="action-disclosure" style={{ display: 'none' }}>
                          <summary aria-label={`Acciones adicionales para ${num}`}>
                            <Icon name="settings" />
                          </summary>
                          <div className="action-disclosure-content">
                            <Link href={contractHref(c.id)} className="btn text-link">
                              <Icon name="eye" /> Ver expediente
                            </Link>
                            <Link href={`/contrato/${encodeURIComponent(c.id)}/editar`} className="btn text-link">
                              <Icon name="cog" /> Modificar
                            </Link>
                          </div>
                        </details>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      title="No se encontraron contratos"
                      description="Prueba ajustando los filtros o realizando otra búsqueda."
                      action={
                        hasActiveFilters ? (
                          <Button className="btn sm" onClick={clearAllFilters} style={{ marginTop: 8 }}>
                            Restablecer filtros
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
                        <b>{filtered.length}</b> contratos
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
                          <Button
                            key={p}
                            className={p === currentPage ? 'on' : ''}
                            onClick={() => setPage(p)}
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
    </div>
  );
};
