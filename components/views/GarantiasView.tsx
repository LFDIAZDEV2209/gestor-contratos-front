'use client';
import { contractHref } from '../app/routes';
import Link from 'next/link';
import { Input, Select } from '../ui/Controls';
import { Button } from '../ui/button';
import { PageHeader, Surface, Field, TableViewport, DataTable, EmptyState } from '../ui/Workspace';
import { useState } from 'react';
import type { Guarantee } from '../../lib/types';
import { Store, AuthService } from '../../lib/store';
import { CAT } from '../../lib/catalog';
import { money, moneyM, fdate, diffDays, todayIso, sum } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Icon } from '../icons';

const PAGE_SIZE = 10;

// Montos compactos: espacios protegidos para que "mil M" no se parta feo en tiles angostos.
const nbsp = (s: string) => s.replace(/ /g, '\u00A0');

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

export const GarantiasView = ({
  onSelectContract
}: {
  onSelectContract: (cid: string, tab?: string) => void;
}) => {
  const [activeTab, setActiveTab] = useState<string>('todas');
  const [filterAseg, setFilterAseg] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const allGuarantees = (Store.all('guarantees') as Guarantee[]).slice().sort((a, b) =>
    (a.fechaVenc || '') < (b.fechaVenc || '') ? -1 : 1
  );

  const now = todayIso();
  const totalGarantias = allGuarantees.length;
  const totalVal = sum(allGuarantees, (g) => Number(g.valor) || 0);
  const vigentes = allGuarantees.filter(
    (g) => g.estado === 'Aprobada' && g.fechaVenc >= now
  ).length;
  const proxVencer = allGuarantees.filter((g) => {
    if (g.estado !== 'Aprobada') return false;
    const d = diffDays(now, g.fechaVenc);
    return d >= 0 && d <= 30;
  }).length;
  const vencidas = allGuarantees.filter((g) => {
    if (g.estado !== 'Aprobada') return false;
    return g.fechaVenc < now;
  }).length;

  const filtered = allGuarantees.filter((g) => {
    const d = diffDays(now, g.fechaVenc);
    if (activeTab === 'prox30' && (g.estado !== 'Aprobada' || d < 0 || d > 30)) return false;
    if (activeTab === 'vencidas' && (g.estado !== 'Aprobada' || d >= 0)) return false;
    if (activeTab === 'cupo' && g.modalidadPoliza !== 'Póliza por cupo') return false;
    if (activeTab === 'individual' && g.modalidadPoliza === 'Póliza por cupo') return false;

    if (filterAseg && g.aseguradora !== filterAseg) return false;
    if (filterTipo && g.tipo !== filterTipo) return false;
    if (q) {
      const matchPol = g.poliza.toLowerCase().includes(q.toLowerCase());
      const matchAseg = g.aseguradora.toLowerCase().includes(q.toLowerCase());
      const matchTom = (g.tomador || '').toLowerCase().includes(q.toLowerCase());
      const c = Store.get('contracts', g.contractId);
      const matchContr = c?.numero.toLowerCase().includes(q.toLowerCase()) || false;
      if (!matchPol && !matchAseg && !matchTom && !matchContr) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const hasActiveFilters = Boolean(activeTab !== 'todas' || filterAseg || filterTipo || q);
  const clearFilters = () => {
    setActiveTab('todas');
    setFilterAseg('');
    setFilterTipo('');
    setQ('');
    setPage(1);
  };

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      {
        l: 'Contrato',
        k: 'contractId',
        r: (g: any) => {
          const c = Store.get('contracts', g.contractId);
          return c ? c.numero : g.contractId;
        }
      },
      { l: 'Aseguradora', k: 'aseguradora' },
      { l: 'Póliza #', k: 'poliza' },
      { l: 'Modalidad', k: 'modalidadPoliza' },
      { l: 'Tipo Garantía', k: 'tipo' },
      { l: 'Valor Asegurado', k: 'valor', r: (g: any) => money(g.valor) },
      { l: 'Inicio', k: 'fechaInicio', r: (g: any) => fdate(g.fechaInicio) },
      { l: 'Vencimiento', k: 'fechaVenc', r: (g: any) => fdate(g.fechaVenc) },
      { l: 'Estado', k: 'estado' }
    ];
    exportRows('Relación Global de Garantías', cols, filtered, format);
  };

  const countCupo = allGuarantees.filter((g) => g.modalidadPoliza === 'Póliza por cupo').length;
  const QUICK_CHIPS: { id: string; label: string; icon: string }[] = [
    { id: 'todas', label: `Todas (${totalGarantias})`, icon: 'umbrella' },
    { id: 'prox30', label: `Vencen ≤ 30 días (${proxVencer})`, icon: 'hourglass' },
    { id: 'vencidas', label: `Vencidas (${vencidas})`, icon: 'alert-triangle' },
    { id: 'cupo', label: `Por cupo (${countCupo})`, icon: 'layers' },
    { id: 'individual', label: `Individuales (${totalGarantias - countCupo})`, icon: 'shield' }
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
              <Icon name="shield" size={24} />
            </span>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                Garantías y pólizas
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
                  {totalGarantias} {totalGarantias === 1 ? 'póliza' : 'pólizas'}
                </span>
              </h1>
              <p style={{ margin: '4px 0 0' }}>
                Control integral de pólizas contractuales, vigencias y esquemas de cupo por aseguradora
              </p>
            </div>
          </div>

          {/* Leyenda de vigencia dentro del hero */}
          <div className="legend" style={{ marginTop: 16 }}>
            <span><span className="sem ok" /> Vigente (&gt;30d)</span>
            <span><span className="sem warn" /> Por vencer (≤30d)</span>
            <span><span className="sem crit" /> Vencida</span>
            <span><span className="sem na" /> Anulada / Rechazada</span>
          </div>
        </div>

        <div className="ph-actions">
          <div className="exp-actions">
            <Button className="btn sm" onClick={() => handleExport('xlsx')} title="Exportar a Excel" aria-label="Exportar garantías a Excel">
              <Icon name="file-excel" /> Excel
            </Button>
            <Button className="btn sm" onClick={() => handleExport('pdf')} title="Exportar a PDF" aria-label="Exportar garantías a PDF">
              <Icon name="file-pdf" /> PDF
            </Button>
            <Button className="btn sm" onClick={() => handleExport('csv')} title="Exportar a CSV" aria-label="Exportar garantías a CSV">
              <Icon name="file-csv" /> CSV
            </Button>
          </div>
          {AuthService.can('crear') && (
            <Link href="/garantias/nueva" className="btn sm pri">
              <Icon name="plus" /> Nueva póliza
            </Link>
          )}
        </div>
      </PageHeader>

      {/* KPI Cards con icono, entrada escalonada y navegación contextual */}
      <div className="kpis mb">
        <Kpi label="Total Pólizas" value={totalGarantias} icon="umbrella" color="brand" className="anim-fade-rise stagger-1 click" onClick={() => { setActiveTab('todas'); setPage(1); }} />
        <Kpi label="Valor Asegurado Total" value={nbsp(moneyM(totalVal))} sub={money(totalVal)} icon="wallet" color="info" className="anim-fade-rise stagger-2" />
        <Kpi label="Pólizas Vigentes" value={vigentes} icon="check-circle" color="ok" className="anim-fade-rise stagger-3" />
        <Kpi label="Vencen ≤ 30 días" value={proxVencer} icon="hourglass" color={proxVencer > 0 ? 'warn' : 'ok'} className="anim-fade-rise stagger-4 click" onClick={() => { setActiveTab('prox30'); setPage(1); }} />
        <Kpi label="Pólizas Vencidas" value={vencidas} icon="alert-triangle" color={vencidas > 0 ? 'crit' : 'ok'} className="anim-fade-rise stagger-5 click" onClick={() => { setActiveTab('vencidas'); setPage(1); }} />
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
              placeholder="Buscar por póliza, tomador o contrato..."
              aria-label="Buscar garantías por póliza, tomador o contrato"
            />
          </div>
          <Field className="f">
            <label>Aseguradora</label>
            <Select
              className="inp sm"
              value={filterAseg}
              onChange={(e) => { setFilterAseg(e.target.value); setPage(1); }}
            >
              <option value="">— Todas las aseguradoras —</option>
              {CAT('aseguradoras').map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </Field>
          <Field className="f">
            <label>Tipo de garantía</label>
            <Select
              className="inp sm"
              value={filterTipo}
              onChange={(e) => { setFilterTipo(e.target.value); setPage(1); }}
            >
              <option value="">— Todos los tipos —</option>
              {CAT('tiposGarantia').map((t) => (
                <option key={t} value={t}>
                  {t}
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
            const isActive = activeTab === chip.id;
            return (
              <button
                type="button"
                key={chip.id}
                onClick={() => { setActiveTab(chip.id); setPage(1); }}
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

        {/* Tabla de pólizas con rail de vigencia y hover lift */}
        <TableViewport className="tbl-wrap">
          <DataTable className="tbl">
            <thead>
              <tr>
                <th className="nw">Contrato</th>
                <th>Aseguradora</th>
                <th className="nw">Póliza #</th>
                <th className="nw">Modalidad</th>
                <th>Tipo de Garantía</th>
                <th className="nw num">Valor Asegurado</th>
                <th className="nw">Inicio</th>
                <th className="nw">Vencimiento</th>
                <th className="nw">Días Restantes</th>
                <th className="nw">Estado</th>
                <th className="nw">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((g, idx) => {
                const c = Store.get('contracts', g.contractId);
                const d = diffDays(now, g.fechaVenc);
                const isPorCupo = g.modalidadPoliza === 'Póliza por cupo';
                const isVigente = g.estado === 'Aprobada';
                const rail = !isVigente
                  ? 'var(--na)'
                  : d < 0
                  ? 'var(--crit)'
                  : d <= 30
                  ? 'var(--warn)'
                  : 'var(--ok)';
                return (
                  <tr
                    key={g.id}
                    className="rail anim-fade-rise"
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
                          href={contractHref(c.id, 'garantias')}
                          style={{ cursor: 'pointer' }}
                        >
                          {c.numero}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{g.aseguradora}</td>
                    <td className="nw">
                      <b>{g.poliza}</b>
                    </td>
                    <td className="nw">
                      <span className={`badge ${isPorCupo ? 'b-info' : 'b-na'}`}>
                        {isPorCupo ? 'Por cupo' : 'Individual'}
                      </span>
                    </td>
                    <td>{g.tipo}</td>
                    <td className="nw num font-semibold">{money(g.valor)}</td>
                    <td className="nw">{fdate(g.fechaInicio)}</td>
                    <td className="nw font-semibold">{fdate(g.fechaVenc)}</td>
                    <td className="nw">
                      {!isVigente ? (
                        <span className="small muted">—</span>
                      ) : d < 0 ? (
                        <span className="badge b-crit" style={{ fontSize: '11px', borderRadius: 'var(--r-pill)' }}>
                          Vencida ({Math.abs(d)} d)
                        </span>
                      ) : d <= 30 ? (
                        <span className="badge b-warn" style={{ fontSize: '11px', borderRadius: 'var(--r-pill)' }}>
                          {d} días
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {d} días
                        </span>
                      )}
                    </td>
                    <td className="nw">
                      <Badge
                        text={g.estado}
                        color={
                          g.estado === 'Aprobada'
                            ? 'ok'
                            : g.estado === 'Pendiente'
                            ? 'warn'
                            : g.estado === 'Rechazada' || g.estado === 'Anulada'
                            ? 'crit'
                            : 'na'
                        }
                      />
                    </td>
                    <td className="nw">
                      {c && (
                        <Button
                          className="btn sm"
                          onClick={() => onSelectContract(c.id, 'garantias')}
                          title="Ver en expediente del contrato"
                          aria-label={`Ver expediente del contrato ${c.numero}`}
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
                  <td colSpan={11}>
                    <EmptyState
                      title="No se encontraron pólizas"
                      description="Prueba ajustando los filtros, la búsqueda o cambia de vista rápida."
                      action={
                        hasActiveFilters ? (
                          <Button className="btn sm" onClick={clearFilters} style={{ marginTop: 8 }}>
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
                  <td colSpan={11}>
                    <div className="tbl-foot">
                      <span>
                        Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de{' '}
                        <b>{filtered.length}</b> pólizas
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

    </div>
  );
};
