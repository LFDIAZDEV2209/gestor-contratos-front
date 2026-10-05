'use client';
import { contractHref } from '../app/routes';
import Link from 'next/link';
import { PBar } from '../ui/PBar';
import { Input, Select } from '../ui/Controls';
import { Button } from '../ui/button';
import { PageHeader, Surface, Field, TableViewport, DataTable, EmptyState } from '../ui/Workspace';
import { useState } from 'react';
import type { Subcontract, Contract, Company } from '../../lib/types';
import { Store, AuthService } from '../../lib/store';
import { M, companyName } from '../../lib/metrics';
import { money, moneyM, pct, fdate, sum, todayIso, diffDays, daysTxt } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Icon } from '../icons';

// Un subcontrato "Activo" con vigencia vencida se presenta como Vencido
// (misma regla efectiva que aplican las obligaciones y entregables).
const estadoEfectivo = (s: Subcontract): string => {
  if (s.estado === 'Activo' && diffDays(todayIso(), s.fechaFin) < 0) return 'Vencido';
  return s.estado;
};

export const SubcontratosView = ({
  onSelectContract
}: {
  onSelectContract: (cid: string, tab?: string) => void;
}) => {
  const [q, setQ] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [showTree, setShowTree] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const allSubcontracts = (Store.all('subcontracts') as Subcontract[]).slice();
  const allContracts = (Store.all('contracts') as Contract[]).filter((c) => !c.anulado);
  const allCompanies = Store.all('companies') as Company[];

  const hoy = todayIso();
  const totalSubs = allSubcontracts.length;
  const totalVal = sum(allSubcontracts, (s) => Number(s.valor) || 0);
  const activeSubs = allSubcontracts.filter((s) => estadoEfectivo(s) === 'Activo').length;
  const vencidos = allSubcontracts.filter((s) => estadoEfectivo(s) === 'Vencido').length;
  const avgExec = totalSubs
    ? sum(allSubcontracts, (s) => Number(s.ejecucion) || 0) / totalSubs
    : 0;
  // Tono de la KPI de ejecución acorde al desempeño real de la red
  const execTone = avgExec >= 90 ? 'ok' : avgExec >= 60 ? 'info' : avgExec >= 35 ? 'warn' : 'risk';

  const filtered = allSubcontracts.filter((s) => {
    const c = Store.get('contracts', s.contractId);
    if (filterEstado && estadoEfectivo(s) !== filterEstado) return false;
    if (filterCompany && c?.companyId !== filterCompany) return false;
    if (q) {
      const ql = q.toLowerCase();
      const matchNum = s.numero.toLowerCase().includes(ql);
      const matchContr = s.contratista.toLowerCase().includes(ql);
      const matchObj = s.objeto.toLowerCase().includes(ql);
      const matchNit = s.nit.toLowerCase().includes(ql);
      if (!matchNum && !matchContr && !matchObj && !matchNit) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedSubs = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      { l: 'Número', k: 'numero' },
      {
        l: 'Contrato Principal',
        k: 'contractId',
        r: (s: any) => {
          const c = Store.get('contracts', s.contractId);
          return c ? c.numero : s.contractId;
        }
      },
      {
        l: 'Empresa',
        k: 'company',
        r: (s: any) => {
          const c = Store.get('contracts', s.contractId);
          return c ? companyName(c.companyId) : '—';
        }
      },
      { l: 'Subcontratista', k: 'contratista' },
      { l: 'NIT', k: 'nit' },
      { l: 'Objeto', k: 'objeto' },
      { l: 'Valor', k: 'valor', r: (s: any) => money(s.valor) },
      { l: 'Inicio', k: 'fechaInicio', r: (s: any) => fdate(s.fechaInicio) },
      { l: 'Terminación', k: 'fechaFin', r: (s: any) => fdate(s.fechaFin) },
      { l: '% Ejecución', k: 'ejecucion', r: (s: any) => pct(s.ejecucion) },
      { l: 'Estado', k: 'estado', r: (s: any) => estadoEfectivo(s) },
      { l: 'Responsable', k: 'responsable' }
    ];
    exportRows('Subcontratos Globales', cols, filtered, format);
  };

  const clearFilters = () => {
    setQ('');
    setFilterCompany('');
    setFilterEstado('');
    setPage(1);
  };

  const hasFilters = Boolean(q || filterCompany || filterEstado);

  // Solo los accesos de escritura exigen permiso; la vista sigue siendo consultable.
  // La creación y la edición son VISTAS dedicadas (/subcontratos/nuevo y /…/editar).
  const puedeCrear = AuthService.can('crear');
  const puedeEditar = AuthService.can('editar');

  const linkNuevo = '/subcontratos/nuevo';

  return (
    <div>
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
              <Icon name="diagram-project" size={24} />
            </span>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0, flexWrap: 'wrap' }}>
                Subcontratos
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
                  {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
                </span>
              </h1>
              <p style={{ margin: '4px 0 0' }}>
                Supervisión de la red de subcontratación: valor delegado, ejecución y vencimientos
              </p>
            </div>
          </div>
        </div>

        <div className="ph-actions">
          {/* Exportación agrupada en un disclosure para no saturar la cabecera */}
          <details className="action-disclosure">
            <summary title="Exportar subcontratos" aria-label="Exportar subcontratos">
              <Icon name="download" />
            </summary>
            <div className="action-disclosure-content">
              <Button className="btn sm" onClick={() => handleExport('xlsx')}>
                <Icon name="file-excel" /> Excel (XLSX)
              </Button>
              <Button className="btn sm" onClick={() => handleExport('pdf')}>
                <Icon name="file-pdf" /> PDF
              </Button>
              <Button className="btn sm" onClick={() => handleExport('csv')}>
                <Icon name="file-csv" /> CSV
              </Button>
            </div>
          </details>
          <Button className="btn" onClick={() => setShowTree(!showTree)} aria-pressed={showTree}>
            <Icon name="diagram-project" /> {showTree ? 'Ver tabla' : 'Ver árbol'}
          </Button>
          {puedeCrear && (
            <Link href={linkNuevo} className="btn pri">
              <Icon name="plus" /> Nuevo subcontrato
            </Link>
          )}
        </div>
      </PageHeader>

      {/* KPI Cards: los totales funcionan como accesos a los filtros de la tabla */}
      <div className="kpis mb">
        <Kpi
          label="Total Subcontratos"
          value={totalSubs}
          icon="diagram-project"
          color="brand"
          className="anim-fade-rise stagger-1 click"
          onClick={() => {
            clearFilters();
          }}
        />
        <Kpi
          label="Valor Subcontratado"
          value={moneyM(totalVal)}
          sub={money(totalVal)}
          icon="money-check-dollar"
          color="info"
          className="anim-fade-rise stagger-2"
        />
        <Kpi
          label="Subcontratos Activos"
          value={activeSubs}
          icon="check-circle"
          color="ok"
          className="anim-fade-rise stagger-3 click"
          onClick={() => {
            setFilterEstado('Activo');
            setPage(1);
          }}
        />
        <Kpi
          label="Vencidos"
          value={vencidos}
          icon="clock"
          color={vencidos > 0 ? 'risk' : 'na'}
          sub={vencidos > 0 ? 'Requieren atención' : 'Sin vencidos'}
          className="anim-fade-rise stagger-4 click"
          onClick={() => {
            setFilterEstado('Vencido');
            setPage(1);
          }}
        />
        <Kpi
          label="Ejecución Promedio"
          value={pct(avgExec, 0)}
          icon="trending-up"
          color={execTone}
          className="anim-fade-rise stagger-5"
        />
      </div>

      {/* Visual Tree Mode */}
      {showTree ? (
        <Surface className="panel mb">
          <div className="panel-h">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="diagram-project" size={16} /> Red de Subcontratación
            </h3>
            <span className="sub">
              {allCompanies.length} empresas · {allContracts.length} contratos · {totalSubs} subcontratos
            </span>
          </div>
          <div className="tree">
            {totalSubs === 0 ? (
              <EmptyState
                title="Sin subcontratos en la red"
                description="Cuando registre subcontratos, la relación empresa → contrato → subcontrato se dibujará aquí."
                action={
                  <Link href={linkNuevo} className="btn pri sm" style={{ marginTop: 8 }}>
                    <Icon name="plus" /> Registrar el primer subcontrato
                  </Link>
                }
              />
            ) : (
              <ul>
                {allCompanies.map((co) => {
                  const cList = allContracts.filter((c) => c.companyId === co.id);
                  if (cList.length === 0) return null;
                  return (
                    <li key={co.id}>
                      <span className="node co">
                        <Icon name="building" />
                        <span>
                          <b>{co.razon || co.name}</b>
                          <div className="m">
                            NIT {co.nit} · {cList.length} {cList.length === 1 ? 'contrato' : 'contratos'}
                          </div>
                        </span>
                      </span>
                      <ul>
                        {cList.map((c) => {
                          const m = M(c);
                          const sList = allSubcontracts.filter((s) => s.contractId === c.id);
                          return (
                            <li key={c.id}>
                              <button
                                type="button"
                                className="node"
                                style={{ cursor: 'pointer', textAlign: 'left' }}
                                onClick={() => onSelectContract(c.id, 'subcontratos')}
                                title="Abrir subcontratos del contrato"
                                aria-label={`Abrir los subcontratos del contrato ${c.numero}`}
                              >
                                <span className={`sem ${m.sem}`} aria-hidden="true" />
                                <Icon name="file-contract" />
                                <span>
                                  <b>{c.numero}</b> · {c.contratista}
                                  <div className="m">
                                    {moneyM(m.valorActual)} · {m.estado} · {sList.length}{' '}
                                    {sList.length === 1 ? 'subcontrato' : 'subcontratos'}
                                  </div>
                                </span>
                              </button>
                              {sList.length > 0 && (
                                <ul>
                                  {sList.map((s) => (
                                    <li key={s.id}>
                                      <button
                                        type="button"
                                        className="node"
                                        style={{ cursor: 'pointer', textAlign: 'left' }}
                                        onClick={() => onSelectContract(c.id, 'subcontratos')}
                                        title="Abrir en el expediente del contrato"
                                        aria-label={`Abrir el subcontrato ${s.numero} de ${s.contratista}`}
                                      >
                                        <Icon name="diagram-project" />
                                        <span>
                                          <b>{s.numero}</b> · {s.contratista}
                                          <div className="m">
                                            {moneyM(s.valor)} · {estadoEfectivo(s)} · {pct(Number(s.ejecucion) || 0)} ejecutado · vence{' '}
                                            {fdate(s.fechaFin)}
                                          </div>
                                        </span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Surface>
      ) : (
        /* Table Mode */
        <Surface className="panel">
          {/* Filters Bar */}
          <div className="filters mb" style={{ padding: '12px 16px' }}>
            <div className="gsearch" style={{ minWidth: 280 }}>
              <Icon name="search" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por subcontratista, NIT, número u objeto..."
                aria-label="Buscar subcontratos por subcontratista, NIT, número u objeto"
              />
            </div>
            <Field className="f">
              <label>Empresa</label>
              <Select value={filterCompany} onChange={(e) => {
                setFilterCompany(e.target.value);
                setPage(1);
              }}>
                <option value="">Todas las empresas</option>
                {allCompanies.map((co) => (
                  <option key={co.id} value={co.id}>
                    {co.razon || co.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field className="f">
              <label>Estado</label>
              <Select value={filterEstado} onChange={(e) => {
                setFilterEstado(e.target.value);
                setPage(1);
              }}>
                <option value="">Todos los estados</option>
                <option value="Activo">Activo</option>
                <option value="Suspendido">Suspendido</option>
                <option value="Terminado">Terminado</option>
                <option value="Liquidado">Liquidado</option>
                <option value="Vencido">Vencido</option>
              </Select>
            </Field>
            {hasFilters && (
              <Button className="btn sm ghost" onClick={clearFilters} style={{ alignSelf: 'flex-end', height: 38 }}>
                <Icon name="trash" /> Limpiar filtros
              </Button>
            )}
          </div>

          {/* Chips de filtros activos: cada criterio se puede quitar por separado */}
          {hasFilters && (
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
              {filterCompany && (
                <span className="filter-chip">
                  <Icon name="building" size={11} />{' '}
                  Empresa: {allCompanies.find((co) => co.id === filterCompany)?.razon || 'seleccionada'}
                  <button
                    type="button"
                    className="filter-chip-remove"
                    onClick={() => {
                      setFilterCompany('');
                      setPage(1);
                    }}
                    aria-label="Quitar el filtro de empresa"
                    title="Quitar filtro"
                  >
                    <Icon name="xmark" size={12} />
                  </button>
                </span>
              )}
              {filterEstado && (
                <span className="filter-chip">
                  <Icon name="clock" size={11} /> Estado: {filterEstado}
                  <button
                    type="button"
                    className="filter-chip-remove"
                    onClick={() => {
                      setFilterEstado('');
                      setPage(1);
                    }}
                    aria-label="Quitar el filtro de estado"
                    title="Quitar filtro"
                  >
                    <Icon name="xmark" size={12} />
                  </button>
                </span>
              )}
            </div>
          )}

          <TableViewport className="tbl-wrap" aria-label="Tabla global de subcontratos">
            <DataTable className="tbl">
              <thead>
                <tr>
                  <th className="nw">Número</th>
                  <th>Subcontratista</th>
                  <th>Objeto</th>
                  <th className="nw num">Valor</th>
                  <th className="nw">Vigencia</th>
                  <th className="nw" style={{ minWidth: '120px' }}>
                    % Ejecución
                  </th>
                  <th className="nw">Estado</th>
                  <th className="nw" style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pagedSubs.map((s, idx) => {
                  const c = Store.get('contracts', s.contractId);
                  const restantes = diffDays(hoy, s.fechaFin);
                  const st = estadoEfectivo(s);
                  return (
                    <tr
                      key={s.id}
                      className="anim-fade-rise"
                      style={{
                        animationDelay: `${idx * 25}ms`,
                        transition: 'transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)'
                      }}
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
                      <td className="nw">
                        <b className="mono" style={{ fontWeight: 700, color: 'var(--ink)' }}>
                          {s.numero}
                        </b>
                        {c && (
                          <div style={{ marginTop: 2 }}>
                            <Link
                              className="link"
                              href={contractHref(c.id, 'subcontratos')}
                              title="Ver contrato principal"
                              style={{ fontSize: '11.5px' }}
                            >
                              contrato {c.numero}
                            </Link>
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="clip" style={{ maxWidth: 200, fontWeight: 600, color: 'var(--ink)' }} title={s.contratista}>
                          {s.contratista}
                        </div>
                        <div className="mono" style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                          {s.nit || '—'}
                        </div>
                      </td>
                      <td>
                        <div className="clip" style={{ maxWidth: 200 }} title={s.objeto}>
                          {s.objeto || '—'}
                        </div>
                      </td>
                      <td className="nw num mono" style={{ fontWeight: 600 }}>
                        {money(s.valor)}
                      </td>
                      <td className="nw">
                        {/* Vigencia apilada: terminación, inicio y alerta de días restantes */}
                        <div
                          style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}
                          title={`Vigencia: ${fdate(s.fechaInicio)} a ${fdate(s.fechaFin)}`}
                        >
                          <span className="mono" style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)' }}>
                            {fdate(s.fechaFin)}
                          </span>
                          <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                            inicia {fdate(s.fechaInicio)}
                          </span>
                          {restantes < 0 ? (
                            <span className="badge b-crit" style={{ width: 'fit-content' }}>
                              {daysTxt(restantes)}
                            </span>
                          ) : restantes <= 15 ? (
                            <span className="badge b-warn" style={{ width: 'fit-content' }}>
                              {daysTxt(restantes)}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                              {daysTxt(restantes)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="nw">
                        <PBar value={Number(s.ejecucion) || 0} />
                      </td>
                      <td className="nw">
                        {/* Color semántico resuelto por el catálogo global de estados */}
                        <Badge text={st} />
                      </td>
                      <td className="nw" style={{ textAlign: 'right' }}>
                        <div className="acts">
                          {puedeEditar && (
                            <Link
                              href={`/subcontratos/${encodeURIComponent(s.id)}/editar`}
                              className="icon-btn"
                              title="Editar subcontrato"
                              aria-label={`Editar el subcontrato ${s.numero}`}
                            >
                              <Icon name="pen" />
                            </Link>
                          )}
                          {c && (
                            <Button
                              className="icon-btn"
                              onClick={() => onSelectContract(c.id, 'subcontratos')}
                              title="Ver en el expediente del contrato"
                              aria-label={`Ver el subcontrato ${s.numero} en su contrato`}
                            >
                              <Icon name="eye" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        title="No se encontraron subcontratos"
                        description="Prueba ajustando la búsqueda, la empresa o el estado seleccionado."
                        action={
                          hasFilters ? (
                            <Button className="btn sm" onClick={clearFilters} style={{ marginTop: 8 }}>
                              Restablecer filtros
                            </Button>
                          ) : (
                            <Link href={linkNuevo} className="btn pri sm" style={{ marginTop: 8 }}>
                              <Icon name="plus" /> Registrar el primer subcontrato
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
                    <td colSpan={8}>
                      <div className="tbl-foot">
                        <span>
                          Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} de{' '}
                          <b>{filtered.length}</b> subcontratos
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
      )}
    </div>
  );
};
