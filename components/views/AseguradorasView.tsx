'use client';
import { contractHref } from '../app/routes';
import Link from 'next/link';
import { Button } from '../ui/button';
import { PageHeader, Surface, TableViewport, DataTable, EmptyState } from '../ui/Workspace';
import { useEffect, useState } from 'react';
import type { Guarantee, Cupo } from '../../lib/types';
import { Store, AuthService } from '../../lib/store';
import { CAT } from '../../lib/catalog';
import { cupoStats, activeContracts, contractInsurers } from '../../lib/metrics';
import { money, moneyM, pct, fdate, diffDays, todayIso, sum, clamp, groupBy } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Icon } from '../icons';

const PAGE_SIZE = 10;

// Montos compactos: espacios protegidos para que "mil M" no se parta feo en tiles angostos.
const nbsp = (s: string) => s.replace(/ /g, '\u00A0');

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

// Hover lift de tarjetas (grid de aseguradoras).
const cardHover = {
  onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = 'translateY(-2px)';
    e.currentTarget.style.boxShadow = 'var(--shadow-2)';
  },
  onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = 'none';
    e.currentTarget.style.boxShadow = 'var(--shadow-1)';
  }
};

// Barra de uso animada al montar (0 → valor) con la transición del sistema.
function AnimatedBar({ pct: value, color, label }: { pct: number; color: string; label?: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="bar" role="progressbar" aria-label={label || 'Uso del cupo'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamp(value, 0, 100))}>
      <i style={{ width: on ? `${clamp(value, 0, 100)}%` : '0%', background: color }} />
    </div>
  );
}

export const AseguradorasView = ({
  onSelectContract,
  onNavigateToGarantias
}: {
  onSelectContract: (cid: string, tab?: string) => void;
  onNavigateToGarantias?: () => void;
}) => {
  const [pageMatrix, setPageMatrix] = useState(1);
  const [pageCupos, setPageCupos] = useState(1);

  const allGuarantees = (Store.all('guarantees') as Guarantee[]).filter((g) => {
    const c = Store.get('contracts', g.contractId);
    return c && !c.anulado && g.estado !== 'Anulada' && g.estado !== 'Rechazada';
  });
  const allCupos = Store.all('cupos') as Cupo[];
  const cs = activeContracts();
  const now = todayIso();

  // Aggregate stats by insurer
  const byInsurer = groupBy(allGuarantees, (g) => g.aseguradora);
  const insurerKeys = Object.keys(byInsurer);

  const insurerStatsList = insurerKeys
    .map((a) => {
      const ps = byInsurer[a] || [];
      const ap = ps.filter((g) => g.estado === 'Aprobada');
      const cups = allCupos.filter((cp) => cp.aseguradora === a && cp.estado !== 'Anulado');
      const uniqueContracts = Array.from(new Set(ps.map((g) => g.contractId)));
      const vencidas = ap.filter((g) => g.fechaVenc < now).length;
      const prox = ap.filter((g) => {
        const d = diffDays(now, g.fechaVenc);
        return d >= 0 && d <= 30;
      }).length;
      const valor = sum(ps, (g) => Number(g.valor) || 0);
      const prima = sum(ps, (g) => Number(g.prima) || 0);
      const porCupo = ps.filter((g) => g.modalidadPoliza === 'Póliza por cupo');
      const indiv = ps.filter((g) => g.modalidadPoliza !== 'Póliza por cupo');

      return {
        a,
        polizas: ps,
        n: ps.length,
        contratos: uniqueContracts,
        valor,
        prima,
        porCupo,
        indiv,
        vencidas,
        prox,
        cupos: cups,
        cupoTotal: sum(cups, (cp) => Number(cp.valor) || 0),
        cupoUso: sum(cups, (cp) => cupoStats(cp).utilizado)
      };
    })
    .sort((x, y) => y.valor - x.valor);

  const vigCupos = allCupos.filter((c) => c.estado === 'Vigente');
  const ct = sum(vigCupos, (c) => Number(c.valor) || 0);
  const cu = sum(vigCupos, (c) => cupoStats(c).utilizado);
  const multiAseg = cs.filter((c) => contractInsurers(c).length >= 2);
  const sinPolizas = cs.filter((c) => !contractInsurers(c).length);

  const totalPagesMatrix = Math.max(1, Math.ceil(cs.length / PAGE_SIZE));
  const currentPageMatrix = Math.min(pageMatrix, totalPagesMatrix);
  const matrixRows = cs.slice((currentPageMatrix - 1) * PAGE_SIZE, currentPageMatrix * PAGE_SIZE);
  const totalPagesCupos = Math.max(1, Math.ceil(allCupos.length / PAGE_SIZE));
  const currentPageCupos = Math.min(pageCupos, totalPagesCupos);
  const cupoRows = allCupos.slice((currentPageCupos - 1) * PAGE_SIZE, currentPageCupos * PAGE_SIZE);

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      { l: 'Aseguradora', k: 'a' },
      { l: 'Pólizas', k: 'n' },
      { l: 'Contratos Vinculados', k: 'contratos', r: (x: any) => x.contratos.length },
      { l: 'Valor Asegurado Total', k: 'valor', r: (x: any) => money(x.valor) },
      { l: 'Primas Totales', k: 'prima', r: (x: any) => money(x.prima) },
      { l: 'Pólizas por Cupo', k: 'porCupo', r: (x: any) => x.porCupo.length },
      { l: 'Pólizas Individuales', k: 'indiv', r: (x: any) => x.indiv.length },
      { l: 'Vencidas', k: 'vencidas' },
      { l: 'Por Vencer (≤30d)', k: 'prox' }
    ];
    exportRows('Resumen de Aseguradoras y Cupos', cols, insurerStatsList, format);
  };

  // Top 5 insurers for matrix
  const topInsurers = insurerStatsList.slice(0, 5).map((x) => x.a);

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
              <Icon name="umbrella" size={24} />
            </span>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                Aseguradoras y cupos
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
                  {insurerStatsList.length} {insurerStatsList.length === 1 ? 'aseguradora' : 'aseguradoras'}
                </span>
              </h1>
              <p style={{ margin: '4px 0 0' }}>
                Supervisión de afianzamiento, pólizas por cupo global e individuales, y balance de cupos
              </p>
            </div>
          </div>

          {/* Leyenda de uso de cupo dentro del hero */}
          <div className="legend" style={{ marginTop: 16 }}>
            <span><span className="sem ok" /> Uso normal (&lt;85%)</span>
            <span><span className="sem warn" /> Uso alto (≥85%)</span>
            <span><span className="sem crit" /> Excedido (&gt;100%)</span>
          </div>
        </div>

        <div className="ph-actions">
          <div className="exp-actions">
            <Button className="btn sm" onClick={() => handleExport('xlsx')} title="Exportar a Excel" aria-label="Exportar resumen a Excel">
              <Icon name="file-excel" /> Excel
            </Button>
            <Button className="btn sm" onClick={() => handleExport('pdf')} title="Exportar a PDF" aria-label="Exportar resumen a PDF">
              <Icon name="file-pdf" /> PDF
            </Button>
            <Button className="btn sm" onClick={() => handleExport('csv')} title="Exportar a CSV" aria-label="Exportar resumen a CSV">
              <Icon name="file-csv" /> CSV
            </Button>
          </div>
          {AuthService.can('crear') && (
            <Link href="/aseguradoras/cupos/nuevo" className="btn sm pri">
              <Icon name="plus" /> Nuevo cupo
            </Link>
          )}
        </div>
      </PageHeader>

      {/* KPI Cards con icono y entrada escalonada */}
      <div className="kpis mb">
        <Kpi label="Aseguradoras activas" value={insurerStatsList.length} sub={`${CAT('aseguradoras').length} en catálogo`} icon="umbrella" color="brand" className="anim-fade-rise stagger-1" />
        <Kpi
          label="Pólizas vigentes"
          value={allGuarantees.filter((g) => g.estado === 'Aprobada' && g.fechaVenc >= now).length}
          sub={`${allGuarantees.length} registradas`}
          icon="check-circle"
          color="ok"
          className="anim-fade-rise stagger-2 click"
          onClick={onNavigateToGarantias}
        />
        <Kpi label="Valor Asegurado Total" value={nbsp(moneyM(sum(allGuarantees, (g) => Number(g.valor) || 0)))} icon="wallet" color="info" className="anim-fade-rise stagger-3" />
        <Kpi
          label="Pólizas por cupo"
          value={allGuarantees.filter((g) => g.modalidadPoliza === 'Póliza por cupo').length}
          sub={`${allGuarantees.filter((g) => g.modalidadPoliza !== 'Póliza por cupo').length} individuales`}
          icon="layers"
          color="na"
          className="anim-fade-rise stagger-4"
        />
        <Kpi label="Cupos vigentes" value={vigCupos.length} sub={`Cupo total ${nbsp(moneyM(ct))}`} icon="shield" color="info" className="anim-fade-rise stagger-5" />
        <Kpi
          label="Cupo utilizado"
          value={pct(ct ? (cu / ct) * 100 : 0, 0)}
          sub={`Disponible ${nbsp(moneyM(ct - cu))}`}
          icon="chart-pie"
          color={ct && cu / ct > 0.85 ? 'risk' : 'ok'}
          className="anim-fade-rise stagger-6"
        />
        <Kpi label="Contratos multi-aseguradora" value={multiAseg.length} sub={`de ${cs.length} contratos`} icon="sitemap" color="info" className="anim-fade-rise stagger-6" />
        <Kpi
          label="Contratos sin pólizas"
          value={sinPolizas.length}
          sub="Revisar requisitos"
          icon="alert-triangle"
          color={sinPolizas.length > 0 ? 'warn' : 'ok'}
          className="anim-fade-rise stagger-6"
        />
      </div>

      {/* Insurer Cards Grid */}
      {insurerStatsList.length === 0 ? (
        <Surface className="panel mb">
          <EmptyState
            title="Aún no hay aseguradoras con pólizas"
            description="Las tarjetas resumen aparecerán cuando registres pólizas asociadas a contratos activos."
            action={
              AuthService.can('crear') ? (
                <Link href="/aseguradoras/cupos/nuevo" className="btn sm pri" style={{ marginTop: 8 }}>
                  <Icon name="plus" /> Registrar primer cupo
                </Link>
              ) : undefined
            }
          />
        </Surface>
      ) : (
        <div className="grid g3 mb" style={{ gap: '16px' }}>
          {insurerStatsList.map((x, idx) => (
            <Surface
              key={x.a}
              className="panel anim-fade-rise"
              style={{
                animationDelay: `${Math.min(idx, 8) * 40}ms`,
                boxShadow: 'var(--shadow-1)',
                transition: 'transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)'
              }}
              {...cardHover}
            >
              <div className="panel-b">
                <div className="row-flex" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', gap: '10px' }}>
                  <div
                    className="alert-ic"
                    style={{
                      background: 'var(--brand-soft)',
                      color: 'var(--brand-2)',
                      padding: '8px',
                      borderRadius: '8px'
                    }}
                  >
                    <Icon name="shield" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="strong" style={{ fontSize: '13.5px', marginBottom: '2px' }}>
                      {x.a}
                    </div>
                    <div className="small muted">
                      {x.n} póliza(s) · {x.contratos.length} contrato(s)
                      {x.vencidas > 0 && <span style={{ color: 'var(--crit-text)' }}> · {x.vencidas} vencida(s)</span>}
                      {x.prox > 0 && <span style={{ color: 'var(--warn-text)' }}> · {x.prox} por vencer</span>}
                    </div>
                  </div>
                </div>

                <div
                  className="dl"
                  style={{
                    gridTemplateColumns: '1fr 1fr',
                    padding: '10px 0 0',
                    border: 0,
                    marginTop: '10px',
                    borderTop: '1px solid var(--line)'
                  }}
                >
                  <div>
                    <span>Valor asegurado</span>
                    <b>{moneyM(x.valor)}</b>
                  </div>
                  <div>
                    <span>Primas</span>
                    <b>{moneyM(x.prima)}</b>
                  </div>
                  <div>
                    <span>Por cupo</span>
                    <b>{x.porCupo.length}</b>
                  </div>
                  <div>
                    <span>Individuales</span>
                    <b>{x.indiv.length}</b>
                  </div>
                </div>

                {/* Quotas Progress Bars */}
                {x.cupos.length > 0 ? (
                  <div style={{ marginTop: '12px', borderTop: '1px dashed var(--line)', paddingTop: '8px' }}>
                    {x.cupos.map((cp) => {
                      const st = cupoStats(cp);
                      const color =
                        st.pct > 100
                          ? 'var(--crit)'
                          : st.pct >= 85
                          ? 'var(--warn)'
                          : 'var(--brand)';
                      return (
                        <div key={cp.id} style={{ marginBottom: '8px' }}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-semibold">{cp.numero}</span>
                            <b>
                              {pct(st.pct, 0)} ({moneyM(st.utilizado)} / {moneyM(cp.valor)})
                            </b>
                          </div>
                          <AnimatedBar pct={st.pct} color={color} label={`Uso del cupo ${cp.numero}`} />
                          <div className="small muted mt-1" style={{ fontSize: '11px' }}>
                            Saldo disponible: {moneyM(st.disponible)} · Vence {fdate(cp.fechaVenc)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="small muted mt-1" style={{ borderTop: '1px dashed var(--line)', paddingTop: 8 }}>
                    Sin cupos registrados para esta aseguradora.
                  </div>
                )}
              </div>
            </Surface>
          ))}
        </div>
      )}

      {/* Contracts x Insurers Matrix (solo con aseguradoras registradas) */}
      {insurerStatsList.length > 0 && (
      <Surface className="panel mb">
        <div className="panel-h">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <Icon name="sitemap" /> Matriz de cobertura: Contratos × Aseguradoras
            </h3>
            <span className="sub small muted">Pólizas vigentes de los contratos activos en las principales aseguradoras</span>
          </div>
        </div>
        <TableViewport className="tbl-wrap">
          <DataTable className="tbl" aria-label="Matriz de cobertura por aseguradora">
            <thead>
              <tr>
                <th className="nw">Contrato</th>
                <th>Contratista</th>
                <th className="nw num">Valor Contrato</th>
                {topInsurers.map((ins) => (
                  <th key={ins} className="nw" style={{ maxWidth: '160px' }} title={ins}>
                    {ins.split(' ')[0]} {ins.split(' ')[1] || ''}
                  </th>
                ))}
                <th className="nw">Pólizas</th>
              </tr>
            </thead>
            <tbody>
              {matrixRows.map((c, idx) => {
                const cPols = allGuarantees.filter((g) => g.contractId === c.id);
                return (
                  <tr
                    key={c.id}
                    className="anim-fade-rise"
                    style={{ animationDelay: `${idx * 25}ms`, transition: 'transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)' }}
                    {...rowHover}
                  >
                    <td className="nw">
                      <Link
                        className="link font-bold"
                        href={contractHref(c.id, 'garantias')}
                        style={{ cursor: 'pointer' }}
                      >
                        {c.numero}
                      </Link>
                    </td>
                    <td className="clip" style={{ maxWidth: '200px' }} title={c.contratista}>
                      {c.contratista}
                    </td>
                    <td className="nw num font-semibold">{moneyM(c.valorBase)}</td>
                    {topInsurers.map((ins) => {
                      const count = cPols.filter((g) => g.aseguradora === ins).length;
                      return (
                        <td key={ins} className="nw" style={{ textAlign: 'center' }}>
                          {count > 0 ? (
                            <span className="badge b-ok" title={`${count} póliza(s) vigente(s)`} style={{ borderRadius: 'var(--r-pill)' }}>
                              ✓ {count}
                            </span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="nw">
                      <Badge
                        text={`${cPols.length} pólizas`}
                        color={cPols.length > 0 ? 'brand' : 'crit'}
                      />
                    </td>
                  </tr>
                );
              })}

              {cs.length === 0 && (
                <tr>
                  <td colSpan={3 + topInsurers.length + 1}>
                    <EmptyState
                      title="Sin contratos activos"
                      description="La matriz de cobertura se llena con los contratos activos del portafolio."
                    />
                  </td>
                </tr>
              )}
            </tbody>

            {cs.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3 + topInsurers.length + 1}>
                    <div className="tbl-foot">
                      <span>
                        Mostrando {(currentPageMatrix - 1) * PAGE_SIZE + 1}–{Math.min(currentPageMatrix * PAGE_SIZE, cs.length)} de{' '}
                        <b>{cs.length}</b> contratos
                      </span>
                      <div className="pager" role="navigation" aria-label="Paginación de matriz de aseguradoras">
                        <Button
                          disabled={currentPageMatrix <= 1}
                          onClick={() => setPageMatrix((p) => Math.max(1, p - 1))}
                          aria-label="Página anterior"
                        >
                          &lt;
                        </Button>
                        {Array.from({ length: totalPagesMatrix }, (_, p) => p + 1).map((p) => (
                          <Button key={p} className={p === currentPageMatrix ? 'on' : ''} aria-current={p === currentPageMatrix ? 'page' : undefined} aria-label={`Ir a la página ${p}`} onClick={() => setPageMatrix(p)}>
                            {p}
                          </Button>
                        ))}
                        <Button
                          disabled={currentPageMatrix >= totalPagesMatrix}
                          onClick={() => setPageMatrix((p) => Math.min(totalPagesMatrix, p + 1))}
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

      {/* CRUD Table for Quotas */}
      <Surface className="panel">
        <div className="panel-h">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <Icon name="layers" /> Cupos de crédito / afianzamiento
            </h3>
            <span className="sub small muted">Líneas globales de seguro rotativo por aseguradora</span>
          </div>
          {AuthService.can('crear') && (
            <Link href="/aseguradoras/cupos/nuevo" className="btn sm pri">
              <Icon name="plus" /> Nuevo cupo
            </Link>
          )}
        </div>
        <TableViewport className="tbl-wrap">
          <DataTable className="tbl" aria-label="Cupos autorizados por aseguradora">
            <thead>
              <tr>
                <th className="nw">Número de Cupo</th>
                <th>Aseguradora</th>
                <th>Tomador</th>
                <th className="nw num">Valor Cupo</th>
                <th className="nw num">Utilizado</th>
                <th className="nw num">Disponible</th>
                <th className="nw" style={{ minWidth: '120px' }}>
                  % Uso
                </th>
                <th className="nw">Inicio</th>
                <th className="nw">Vencimiento</th>
                <th className="nw">Estado</th>
              </tr>
            </thead>
            <tbody>
              {cupoRows.map((cp, idx) => {
                const st = cupoStats(cp);
                return (
                  <tr
                    key={cp.id}
                    className="anim-fade-rise"
                    style={{ animationDelay: `${idx * 25}ms`, transition: 'transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)' }}
                    {...rowHover}
                  >
                    <td className="nw">
                      <b>{cp.numero}</b>
                    </td>
                    <td>{cp.aseguradora}</td>
                    <td>{cp.tomador || '—'}</td>
                    <td className="nw num">{money(cp.valor)}</td>
                    <td className="nw num font-semibold">{money(st.utilizado)}</td>
                    <td
                      className="nw num font-semibold"
                      style={{ color: st.disponible < 0 ? 'var(--crit-text)' : undefined }}
                    >
                      {money(st.disponible)}
                    </td>
                    <td className="nw">
                      <div className="row-flex" style={{ gap: '6px' }}>
                        <div style={{ flex: 1, minWidth: '50px' }}>
                          <AnimatedBar
                            pct={st.pct}
                            color={
                              st.pct > 100
                                ? 'var(--crit)'
                                : st.pct >= 85
                                ? 'var(--warn)'
                                : 'var(--brand)'
                            }
                            label={`Uso del cupo ${cp.numero}`}
                          />
                        </div>
                        <span className="small font-semibold">{pct(st.pct, 0)}</span>
                      </div>
                    </td>
                    <td className="nw">{fdate(cp.fechaInicio)}</td>
                    <td className="nw">{fdate(cp.fechaVenc)}</td>
                    <td className="nw">
                      <Badge text={cp.estado} color={cp.estado === 'Vigente' ? 'ok' : 'crit'} />
                    </td>
                  </tr>
                );
              })}

              {allCupos.length === 0 && (
                <tr>
                  <td colSpan={10}>
                    <EmptyState
                      title="No hay cupos registrados"
                      description="Registra la primera línea de afianzamiento para controlar el uso por aseguradora."
                      action={
                        <Link
                          href="/aseguradoras/cupos/nuevo"
                          className="btn sm pri"
                          style={{ marginTop: 8 }}
                        >
                          <Icon name="plus" /> Nuevo cupo
                        </Link>
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>

            {allCupos.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={10}>
                    <div className="tbl-foot">
                      <span>
                        Mostrando {(currentPageCupos - 1) * PAGE_SIZE + 1}–{Math.min(currentPageCupos * PAGE_SIZE, allCupos.length)} de{' '}
                        <b>{allCupos.length}</b> cupos
                      </span>
                      <div className="pager" role="navigation" aria-label="Paginación de cupos de aseguradoras">
                        <Button
                          disabled={currentPageCupos <= 1}
                          onClick={() => setPageCupos((p) => Math.max(1, p - 1))}
                          aria-label="Página anterior"
                        >
                          &lt;
                        </Button>
                        {Array.from({ length: totalPagesCupos }, (_, p) => p + 1).map((p) => (
                          <Button key={p} className={p === currentPageCupos ? 'on' : ''} aria-current={p === currentPageCupos ? 'page' : undefined} aria-label={`Ir a la página ${p}`} onClick={() => setPageCupos(p)}>
                            {p}
                          </Button>
                        ))}
                        <Button
                          disabled={currentPageCupos >= totalPagesCupos}
                          onClick={() => setPageCupos((p) => Math.min(totalPagesCupos, p + 1))}
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
