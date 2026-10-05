'use client';
import { Select, Input } from '../ui/Controls';
import { requestReason } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, TableViewport, DataTable, EmptyState, Field } from '../ui/Workspace';
import { Kpi } from '../ui/Kpi';

import React, { useState } from 'react';
import Link from 'next/link';
import { Store, AuthService, Audit } from '@/lib/store';
import { riskLevel, activeContracts } from '@/lib/metrics';
import { exportRows } from '@/lib/export';
import { CAT } from '@/lib/catalog';
import { Icon } from '../icons';
import { Badge } from '../ui/Badge';
import { Chart } from '../ui/Chart';
import { RiskMatrix } from '../ui/RiskMatrix';
import { riskPresentation, riskScore } from '../ui/presentation';
import { contractHref } from '../app/routes';
import type { Risk, Contract } from '@/lib/types';

interface RiesgosViewProps {
  onSelectContract?: (contractId: string, tab?: string) => void;
}

/* ---------- Presentación local (2ª pasada): hover lift en filas y badges pill con pop ---------- */
const rowLift = (e: React.MouseEvent<HTMLTableRowElement>) => {
  const el = e.currentTarget;
  el.style.animation = 'none'; // libera el transform final del fadeRise para permitir el lift
  el.style.transform = 'translateY(-2px)';
  el.style.boxShadow = 'var(--shadow-2)';
  el.style.position = 'relative';
  el.style.zIndex = '2';
};
const rowReset = (e: React.MouseEvent<HTMLTableRowElement>) => {
  const el = e.currentTarget;
  el.style.transform = 'none';
  el.style.boxShadow = 'none';
  el.style.zIndex = 'auto';
};
const badgePop = { animation: 'pop 250ms var(--ease)' } as const;
const countPill = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  padding: '2px 8px',
  borderRadius: 'var(--r-pill)',
  background: 'rgba(255, 255, 255, 0.18)',
  color: 'var(--surface)',
  whiteSpace: 'nowrap' as const
};

// Semáforo institucional de severidad -> clase de badge con tokens AA
const nivelBadge: Record<string, string> = {
  Extremo: 'b-crit',
  Alto: 'b-risk',
  Moderado: 'b-warn',
  Bajo: 'b-ok'
};

export const RiesgosView: React.FC<RiesgosViewProps> = ({ onSelectContract }) => {
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterSev, setFilterSev] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [heatmapCell, setHeatmapCell] = useState<{ p: number; i: number } | null>(null);

  const refresh = () => setTick((t) => t + 1);

  const contracts: Contract[] = activeContracts();
  const allRisks: Risk[] = Store.all('risks').map(riskPresentation).filter((r) => {
    const c = Store.get('contracts', r.contractId);
    return c && !c.anulado;
  });

  const openRisks = allRisks.filter((r) => r.estado !== 'Cerrado');

  // KPIs
  const totalR = allRisks.length;
  const abiertosR = allRisks.filter((r) => r.estado === 'Abierto').length;
  const extremosR = openRisks.filter((r) => riskLevel(r) === 'Extremo').length;
  const altosR = openRisks.filter((r) => riskLevel(r) === 'Alto').length;
  const sinMitigacionR = openRisks.filter((r) => !r.mitigacion).length;

  // Filtrado de la tabla
  const filteredRisks = allRisks.filter((r) => {
    if (filterCat && r.categoria !== filterCat) return false;
    if (filterEstado && r.estado !== filterEstado) return false;
    if (filterSev === 'Sin mitigación') {
      if (r.mitigacion) return false;
    } else if (filterSev && riskLevel(r) !== filterSev) {
      return false;
    }
    if (heatmapCell && (Number(r.probabilidad) !== heatmapCell.p || Number(r.impacto) !== heatmapCell.i)) {
      return false;
    }
    if (q) {
      const ql = q.toLowerCase();
      const c = Store.get('contracts', r.contractId);
      const match =
        (r.descripcion || '').toLowerCase().includes(ql) ||
        (r.categoria || '').toLowerCase().includes(ql) ||
        (r.mitigacion || '').toLowerCase().includes(ql) ||
        (c?.numero || '').toLowerCase().includes(ql);
      if (!match) return false;
    }
    return true;
  });

  // Paginación real de la tabla
  const totalPages = Math.max(1, Math.ceil(filteredRisks.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRisks = filteredRisks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const hasFilters = Boolean(q || filterCat || filterEstado || filterSev || heatmapCell);

  const clearFilters = () => {
    setQ('');
    setFilterCat('');
    setFilterEstado('');
    setFilterSev('');
    setHeatmapCell(null);
    setPage(1);
  };

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv' | 'print') => {
    const cols = [
      { l: 'ID', k: 'id' },
      {
        l: 'Contrato',
        x: (r: Risk) => {
          const c = Store.get('contracts', r.contractId);
          return c ? c.numero : r.contractId;
        }
      },
      { l: 'Categoría', k: 'categoria' },
      { l: 'Descripción', k: 'descripcion' },
      { l: 'Probabilidad', k: 'probabilidad' },
      { l: 'Impacto', k: 'impacto' },
      { l: 'Nivel', x: (r: Risk) => riskLevel(r) },
      { l: 'Mitigación', k: 'mitigacion' },
      { l: 'Responsable', k: 'responsable' },
      { l: 'Estado', k: 'estado' }
    ];
    exportRows('Matriz de riesgos', cols, filteredRisks, format);
  };

  const handleAnular = async (r: Risk) => {
    if (!AuthService.guard('anular')) return;
    const motivo = await requestReason('Motivo de la anulación / cierre del riesgo:');
    if (motivo == null) return;
    Store.update('risks', r.id, { estado: 'Cerrado' });
    Audit.log({
      contractId: r.contractId,
      modulo: 'Riesgos',
      accion: 'Cierre de riesgo',
      campo: 'Estado',
      anterior: r.estado,
      nuevo: 'Cerrado',
      obs: motivo
    });
    refresh();
  };

  // Datos para gráfica de riesgos por categoría
  const categories = CAT('categoriasRiesgo');
  const catData = categories.map((cat) => {
    const rs = openRisks.filter((r) => r.categoria === cat);
    return {
      cat,
      bajo: rs.filter((r) => riskLevel(r) === 'Bajo').length,
      moderado: rs.filter((r) => riskLevel(r) === 'Moderado').length,
      alto: rs.filter((r) => riskLevel(r) === 'Alto').length,
      extremo: rs.filter((r) => riskLevel(r) === 'Extremo').length
    };
  }).filter((c) => c.bajo + c.moderado + c.alto + c.extremo > 0);

  const chartConfig = {
    type: 'bar' as const,
    data: {
      labels: catData.map((c) => c.cat),
      datasets: [
        { label: 'Bajo', data: catData.map((c) => c.bajo), backgroundColor: '#7FBF93' },
        { label: 'Moderado', data: catData.map((c) => c.moderado), backgroundColor: '#D9C255' },
        { label: 'Alto', data: catData.map((c) => c.alto), backgroundColor: '#E49A52' },
        { label: 'Extremo', data: catData.map((c) => c.extremo), backgroundColor: '#D0543F' }
      ]
    },
    options: {
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, ticks: { precision: 0 } },
        y: { stacked: true }
      }
    }
  };

  const toggleSev = (sev: string) => {
    setFilterSev(filterSev === sev ? '' : sev);
    setPage(1);
  };

  return (
    <div className="anim-fade-rise">
      {/* Banner de cabecera con gradiente de marca institucional */}
      <style>
        {`
          /* El hero recorta (overflow:clip) cualquier menú absoluto: el desplegable
             Exportar se expande en flujo dentro de .ph-actions (patrón Agenda/Gerencia). */
          @media (min-width: 1024px) { .rkx-dd { display: none !important; } }
          @media (max-width: 1023.98px) { .rkx-inline { display: none !important; } }
          .rkx-chev { transition: transform var(--t-fast) var(--ease); }
          .rkx-dd[open] .rkx-chev { transform: rotate(180deg); }
        `}
      </style>
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
              <Icon name="triangle-exclamation" size={24} />
            </span>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                Riesgos
                <span style={countPill}>{openRisks.length} abiertos</span>
              </h1>
              <p style={{ margin: '4px 0 0' }}>
                Matriz de riesgos contractuales: probabilidad × impacto, plan de mitigación y responsable de seguimiento
              </p>
            </div>
          </div>

          {/* Leyenda institucional de severidad, dentro del hero */}
          <div className="legend" style={{ marginTop: 16 }}>
            <span><span className="sem ok" /> Bajo</span>
            <span><span className="sem warn" /> Moderado</span>
            <span><span className="sem risk" /> Alto</span>
            <span><span className="sem crit" /> Extremo</span>
          </div>
        </div>

        <div className="ph-actions">
          {/* ≥1024px: accesos directos a exportación · <1024px: un desplegable único */}
          <div className="rkx-inline" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          {/* <1024px: desplegable expandido en flujo dentro del hero (overflow: clip) */}
          <details className="rkx-dd" style={{ width: '100%' }}>
            <summary
              className="btn sm"
              style={{ listStyle: 'none' }}
              title="Exportar la matriz de riesgos"
              aria-label="Exportar la matriz de riesgos"
            >
              <Icon name="download" /> Exportar <Icon name="chevron-down" size={14} className="rkx-chev" />
            </summary>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                marginTop: 8,
                padding: 8,
                border: '1px solid rgba(255, 255, 255, 0.28)',
                borderRadius: 'var(--r)',
                background: 'rgba(255, 255, 255, 0.08)'
              }}
            >
              <Button className="btn sm" onClick={() => handleExport('xlsx')}>
                <Icon name="file-excel" /> Excel
              </Button>
              <Button className="btn sm" onClick={() => handleExport('pdf')}>
                <Icon name="file-pdf" /> PDF
              </Button>
              <Button className="btn sm" onClick={() => handleExport('csv')}>
                <Icon name="file-csv" /> CSV
              </Button>
            </div>
          </details>
          {AuthService.can('crear') && (
            <Link className="btn sm pri" href="/riesgos/nuevo">
              <Icon name="plus" /> Nuevo riesgo
            </Link>
          )}
        </div>
      </PageHeader>

      {/* KPIs canónicos con entrada escalonada; clic aplica el filtro correspondiente */}
      <div className="kpis mb">
        <Kpi
          label="Riesgos identificados"
          value={totalR}
          sub="En contratos activos"
          icon="list-check"
          color="na"
          className="anim-fade-rise stagger-1 click"
          onClick={() => {
            setFilterSev('');
            setFilterEstado('');
            setPage(1);
          }}
        />
        <Kpi
          label="Abiertos"
          value={abiertosR}
          sub="Requieren control"
          icon="alert-circle"
          color="risk"
          className="anim-fade-rise stagger-2 click"
          onClick={() => {
            setFilterEstado(filterEstado === 'Abierto' ? '' : 'Abierto');
            setPage(1);
          }}
        />
        <Kpi
          label="Extremos"
          value={extremosR}
          sub="Prioridad crítica"
          icon="triangle-exclamation"
          color="crit"
          className="anim-fade-rise stagger-3 click"
          onClick={() => toggleSev('Extremo')}
        />
        <Kpi
          label="Altos"
          value={altosR}
          sub="Seguimiento continuo"
          icon="fire"
          color="risk"
          className="anim-fade-rise stagger-4 click"
          onClick={() => toggleSev('Alto')}
        />
        <Kpi
          label="Sin mitigación"
          value={sinMitigacionR}
          sub="Sin plan de acción"
          icon="shield-alert"
          color={sinMitigacionR > 0 ? 'warn' : 'ok'}
          className="anim-fade-rise stagger-5 click"
          onClick={() => toggleSev('Sin mitigación')}
        />
      </div>

      {/* Grid: Heatmap + Categorías */}
      <div className="grid g-12 mb">
        {/* Heatmap */}
        <Surface className="panel">
          <div className="panel-h">
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="map" size={14} /> Mapa de calor
              </h3>
              <span className="sub">Riesgos no cerrados · Haz clic en una celda para filtrar la tabla</span>
            </div>
            {heatmapCell && (
              <Button className="btn xs" onClick={() => setHeatmapCell(null)}>
                <Icon name="xmark" /> Limpiar celda (P:{heatmapCell.p} × I:{heatmapCell.i})
              </Button>
            )}
          </div>
          <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {openRisks.length === 0 ? (
              <EmptyState
                title="Sin riesgos abiertos"
                description="No hay riesgos sin cerrar para pintar en el mapa de calor."
                action={
                  AuthService.can('crear') ? (
                    <Link className="btn sm pri" href="/riesgos/nuevo" style={{ marginTop: 8 }}>
                      <Icon name="plus" /> Registrar riesgo
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <RiskMatrix
                risks={openRisks}
                selected={heatmapCell}
                onSelect={(cell) => {
                  setHeatmapCell(cell);
                  setPage(1);
                }}
              />
            )}
          </div>
        </Surface>

        {/* Gráfica por categoría */}
        <Surface className="panel">
          <div className="panel-h">
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="chart-pie" size={14} /> Riesgos por categoría
              </h3>
              <span className="sub">Distribución por severidad</span>
            </div>
          </div>
          <div className="panel-b">
            {catData.length === 0 ? (
              <EmptyState
                title="Sin riesgos abiertos"
                description="La distribución por categoría aparecerá cuando existan riesgos registrados."
              />
            ) : (
              <div className="chart-box" style={{ height: 240 }}>
                <Chart config={chartConfig} />
              </div>
            )}
          </div>
        </Surface>
      </div>

      {/* Tabla completa de riesgos */}
      <Surface className="panel">
        <div className="panel-h">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="list-check" size={14} /> Matriz de riesgos
              <span className="badge b-na">{filteredRisks.length}</span>
            </h3>
            <span className="sub">Registro completo con nivel calculado (P × I)</span>
          </div>
        </div>

        <div className="filters">
          <Field className="f" style={{ flex: 1, minWidth: 240 }}>
            <label>Buscar</label>
            <div className="gsearch">
              <Icon name="search" />
              <Input
                aria-label="Buscar riesgos por descripción, categoría o contrato"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Descripción, categoría o contrato..."
              />
            </div>
          </Field>
          <Field className="f">
            <label>Categoría</label>
            <Select
              value={filterCat}
              onChange={(e) => {
                setFilterCat(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field className="f">
            <label>Estado</label>
            <Select
              value={filterEstado}
              onChange={(e) => {
                setFilterEstado(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los estados</option>
              <option value="Abierto">Abierto</option>
              <option value="Mitigado">Mitigado</option>
              <option value="Cerrado">Cerrado</option>
            </Select>
          </Field>
          <Field className="f">
            <label>Severidad</label>
            <Select
              value={filterSev}
              onChange={(e) => {
                setFilterSev(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los niveles</option>
              <option value="Bajo">Bajo</option>
              <option value="Moderado">Moderado</option>
              <option value="Alto">Alto</option>
              <option value="Extremo">Extremo</option>
              <option value="Sin mitigación">Sin mitigación</option>
            </Select>
          </Field>
          {hasFilters && (
            <Button className="btn sm ghost" onClick={clearFilters} style={{ alignSelf: 'flex-end', height: 38 }}>
              <Icon name="trash" /> Limpiar filtros
            </Button>
          )}
        </div>

        <TableViewport className="tbl-wrap">
          <DataTable className="tbl" aria-label="Matriz de riesgos contractuales">
            <thead>
              <tr>
                <th>ID</th>
                <th>Contrato</th>
                <th>Categoría</th>
                <th>Descripción</th>
                <th className="num">P</th>
                <th className="num">I</th>
                <th>Nivel</th>
                <th>Mitigación</th>
                <th>Responsable</th>
                <th>Estado</th>
                <th className="acts">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pagedRisks.map((r, idx) => {
                const c = Store.get('contracts', r.contractId);
                const level = riskLevel(r);
                const score = riskScore(r);
                return (
                  <tr
                    key={r.id}
                    className="anim-fade-rise"
                    style={{ animationDelay: `${Math.min(idx, 12) * 25}ms`, transition: 'transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)' }}
                    onMouseEnter={rowLift}
                    onMouseLeave={rowReset}
                  >
                    <td className="strong mono">{r.id}</td>
                    <td>
                      {c ? (
                        <Link
                          className="link mono"
                          href={contractHref(c.id, 'riesgos')}
                          title="Ver expediente digital"
                          style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                        >
                          {c.numero}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span className="badge b-info">{r.categoria}</span>
                    </td>
                    <td style={{ maxWidth: 260 }}>{r.descripcion}</td>
                    <td className="num">{r.probabilidad}</td>
                    <td className="num">{r.impacto}</td>
                    <td>
                      <span className={`badge ${nivelBadge[level] || 'b-na'}`} style={badgePop}>
                        {level} ({score ?? 'Sin evaluar'})
                      </span>
                    </td>
                    <td style={{ maxWidth: 200 }} className="clip">
                      {r.mitigacion || <span className="muted">Sin mitigación</span>}
                    </td>
                    <td>{r.responsable || '—'}</td>
                    <td>
                      <Badge state={r.estado} style={badgePop} />
                    </td>
                    <td className="acts">
                      <Link
                        className="icon-btn"
                        href={`/riesgos/${encodeURIComponent(r.id)}/editar`}
                        title="Editar riesgo"
                        aria-label={`Editar riesgo ${r.id}`}
                      >
                        <Icon name="edit" />
                      </Link>
                      {r.estado !== 'Cerrado' && (
                        <Button
                          className="icon-btn"
                          title="Cerrar / Anular riesgo"
                          aria-label={`Cerrar riesgo ${r.id}`}
                          onClick={() => handleAnular(r)}
                        >
                          <Icon name="xmark" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredRisks.length === 0 && (
                <tr>
                  <td colSpan={11}>
                    <EmptyState
                      title="No se encontraron riesgos"
                      description="Ajusta los filtros, la severidad o la celda seleccionada en el mapa de calor."
                      action={
                        hasFilters ? (
                          <Button className="btn sm" onClick={clearFilters} style={{ marginTop: 8 }}>
                            Limpiar filtros
                          </Button>
                        ) : (
                          AuthService.can('crear') && (
                            <Link className="btn sm pri" href="/riesgos/nuevo" style={{ marginTop: 8 }}>
                              <Icon name="plus" /> Registrar riesgo
                            </Link>
                          )
                        )
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>

            {filteredRisks.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={11}>
                    <div className="tbl-foot">
                      <span>
                        Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredRisks.length)} de{' '}
                        <b>{filteredRisks.length}</b> riesgos
                      </span>
                      <div className="pager" role="navigation" aria-label="Paginación de matriz de riesgos">
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
    </div>
  );
};
