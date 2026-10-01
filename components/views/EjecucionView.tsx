'use client';
import { contractHref } from '../app/routes';
import Link from 'next/link';
import { PBar } from '../ui/PBar';
import { Input, Select, Textarea } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, TableViewport, DataTable, FormGrid, EmptyState, WorkspaceSkeleton } from '../ui/Workspace';
import { useState, useEffect } from 'react';
import type { Contract, Exec } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { M, activeContracts, companyName } from '../../lib/metrics';
import { money, moneyM, pct, fdate, sum, monthKey, monthLabel, lastMonths, groupBy, todayIso } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Kpi } from '../ui/Kpi';
import { Chart } from '../ui/Chart';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

// Color de gráfica leído del token compartido (sin hex por pantalla y siempre con la marca vigente)
const cssv = (name: string): string | undefined =>
  typeof document === 'undefined'
    ? undefined
    : getComputedStyle(document.documentElement).getPropertyValue(name).trim() || undefined;

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

export const EjecucionView = ({
  onSelectContract
}: {
  onSelectContract: (cid: string, tab?: string) => void;
}) => {
  const [q, setQ] = useState('');
  const [filterGap, setFilterGap] = useState(false);
  const [showModal, setShowModal] = useState(false);
  // Paginación real sobre el consolidado
  const [page, setPage] = useState(1);
  const pageSize = 12;
  // Guardia de hidratación (store en localStorage) + refresco tras mutaciones
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [form, setForm] = useState({
    contractId: '',
    periodo: todayIso().slice(0, 7),
    valor: 0,
    avanceFisico: 0,
    obs: ''
  });

  // Lectura tolerante a fallos del almacenamiento local (manejo de error)
  let loadError: string | null = null;
  const readActiveContracts = (): Contract[] => {
    try {
      return activeContracts();
    } catch {
      loadError = 'No fue posible leer los datos de ejecución del almacenamiento local.';
      return [];
    }
  };
  const readExecs = (): Exec[] => {
    try {
      return Store.all('execs') as Exec[];
    } catch {
      loadError = 'No fue posible leer los informes de ejecución del almacenamiento local.';
      return [];
    }
  };

  const cs = readActiveContracts();
  const allExecs = readExecs();

  const totalValor = sum(cs, (c) => M(c).valorActual);
  const totalEjec = sum(cs, (c) => M(c).ejecutado);
  const pctFinGlobal = totalValor > 0 ? (totalEjec / totalValor) * 100 : 0;
  const pctFisGlobal = cs.length
    ? sum(cs, (c) => M(c).pctFis) / cs.length
    : 0;

  // Contracts with early depletion
  const agotaAntesList = cs.filter((c) => M(c).agotaAntes);

  // 12 Months Execution Chart
  const mk = lastMonths(12);
  const execsByPeriod = groupBy(allExecs, (e) => e.periodo);
  const dataExecMonthly = mk.map((k) =>
    sum(execsByPeriod[k] || [], (e) => Number(e.valor) || 0)
  );

  const execChartData = {
    labels: mk.map(monthLabel),
    datasets: [
      {
        label: 'Ejecución mensual facturada',
        data: dataExecMonthly,
        backgroundColor: cssv('--brand'),
        borderRadius: 4
      }
    ]
  };

  const filtered = cs.filter((c) => {
    const m = M(c);
    const gap = Math.abs(m.pctFin - m.pctFis);
    if (filterGap && gap < 15) return false;
    if (q) {
      const matchNum = c.numero.toLowerCase().includes(q.toLowerCase());
      const matchContr = c.contratista.toLowerCase().includes(q.toLowerCase());
      if (!matchNum && !matchContr) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasActiveFilters = Boolean(q || filterGap);

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      { l: 'Contrato', k: 'numero' },
      { l: 'Empresa', k: 'companyId', r: (c: any) => companyName(c.companyId) },
      { l: 'Contratista', k: 'contratista' },
      { l: 'Valor Actualizado', k: 'val', r: (c: any) => money(M(c).valorActual) },
      { l: 'Ejecutado', k: 'ejec', r: (c: any) => money(M(c).ejecutado) },
      { l: 'Saldo', k: 'saldo', r: (c: any) => money(M(c).saldo) },
      { l: '% Financiero', k: 'pFin', r: (c: any) => pct(M(c).pctFin) },
      { l: '% Físico', k: 'pFis', r: (c: any) => pct(M(c).pctFis) },
      { l: 'Brecha', k: 'gap', r: (c: any) => pct(Math.abs(M(c).pctFin - M(c).pctFis)) },
      {
        l: 'Fecha Proyectada Agotamiento',
        k: 'agot',
        r: (c: any) => (M(c).fechaAgotar ? fdate(M(c).fechaAgotar) : '—')
      }
    ];
    exportRows('Consolidado de Ejecución Contractual', cols, filtered, format);
  };

  const handleRegisterExec = () => {
    if (!AuthService.guard('crear')) return;
    if (!form.contractId) return notify('Seleccione un contrato');
    if (!form.periodo) return notify('Seleccione el periodo');
    if (!form.valor) return notify('Ingrese el valor ejecutado');

    const newExec: Exec = {
      id: 'EX_' + Date.now(),
      contractId: form.contractId,
      periodo: form.periodo,
      valor: Number(form.valor),
      avanceFisico: Number(form.avanceFisico) || 0,
      obs: form.obs
    };

    Store.insert('execs', newExec);
    Audit.log({
      contractId: form.contractId,
      modulo: 'Ejecución',
      accion: 'Creación',
      campo: 'Periodo ' + form.periodo,
      nuevo: `${money(newExec.valor)} (${newExec.avanceFisico}% físico)`
    });

    setShowModal(false);
    refresh();
  };

  return (
    <div className="anim-fade-rise">
      {!mounted ? (
        <WorkspaceSkeleton />
      ) : loadError ? (
        <div className="feedback-notice" role="alert">
          <Icon name="triangle-exclamation" />
          <div>
            <b>Error al cargar la ejecución.</b> {loadError}
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
              <Icon name="chart-line" size={24} />
            </span>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                Ejecución contractual
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
                Consolidado financiero, físico y alertas de agotamiento temprano de recursos
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
            <Icon name="plus" /> Registrar ejecución
          </Button>
        </div>
      </PageHeader>

      {/* KPI Cards: Kpi v2 con icono y tono semántico */}
      <div className="kpis mb">
        <Kpi
          label="Total Administrado"
          value={moneyM(totalValor)}
          sub={money(totalValor)}
          icon="money-check-dollar"
          color="brand"
          className="anim-fade-rise stagger-1"
        />
        <Kpi
          label="Total Ejecutado"
          value={moneyM(totalEjec)}
          sub={money(totalEjec)}
          icon="trending-up"
          color="info"
          className="anim-fade-rise stagger-2"
        />
        <Kpi
          label="% Ejecución Financiera"
          value={pct(pctFinGlobal)}
          icon="chart-pie"
          color={pctFinGlobal > 100 ? 'crit' : 'ok'}
          className="anim-fade-rise stagger-3"
        />
        <Kpi
          label="% Ejecución Física Promedio"
          value={pct(pctFisGlobal)}
          icon="chart-line"
          color="info"
          className="anim-fade-rise stagger-4"
        />
      </div>

      {/* Depletion Notice con tokens AA */}
      {agotaAntesList.length > 0 && (
        <Surface
          className="panel mb p-3"
          style={{
            background: 'var(--crit-bg)',
            border: '1px solid var(--crit)',
            borderRadius: '6px',
            color: 'var(--crit-text)'
          }}
        >
          <div className="flex items-center gap-2 font-semibold" style={{ color: 'var(--crit-text)' }}>
            <Icon name="triangle-exclamation" />
            <span>
              {agotaAntesList.length} contrato(s) presentan ritmo de gasto superior al plazo y
              agotarán recursos antes de la fecha de terminación:
            </span>
          </div>
          <div className="mt-2" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {agotaAntesList.map((c) => {
              const m = M(c);
              return (
                <Button
                  key={c.id}
                  className="btn sm"
                  onClick={() => onSelectContract(c.id, 'ejecucion')}
                  title={`Abrir expediente de ${c.numero}`}
                >
                  <b>{c.numero}</b> (se agota ~{fdate(m.fechaAgotar)})
                </Button>
              );
            })}
          </div>
        </Surface>
      )}

      {/* Chart */}
      <Surface className="panel mb anim-fade-rise stagger-1">
        <div className="panel-h">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="chart-line" style={{ color: 'var(--brand)' }} /> Evolución de ejecución mensual
          </h3>
          <span className="sub">Valor mensual facturado del portafolio (últimos 12 meses)</span>
        </div>
        <div className="panel-b">
          <div className="chart-box lg" style={{ height: '240px' }}>
            <Chart
              type="bar"
              data={execChartData}
              options={{
                scales: {
                  y: { ticks: { callback: (val: any) => moneyM(val) } }
                }
              }}
            />
          </div>
        </div>
      </Surface>

      {/* Table */}
      <Surface className="panel">
        <div className="filters mb" style={{ padding: '12px 16px' }}>
          <div className="gsearch">
            <Icon name="search" />
            <Input
              value={q}
              aria-label="Buscar contratos en ejecución"
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar contrato..."
            />
          </div>
          {/* Vistas rápidas: chip seleccionable con estado activo marcado */}
          <button
            type="button"
            className={`btn xs ${filterGap ? 'active-chip' : 'ghost'}`}
            onClick={() => {
              setFilterGap(!filterGap);
              setPage(1);
            }}
            aria-pressed={filterGap}
            style={{
              borderRadius: 'var(--r-pill)',
              background: filterGap ? 'var(--brand-soft)' : 'var(--surface-2)',
              color: filterGap ? 'var(--brand-2)' : 'var(--ink-2)',
              borderColor: filterGap ? 'var(--brand)' : 'var(--border-control)',
              fontWeight: filterGap ? 600 : 500,
              transform: filterGap ? 'scale(1.05)' : 'scale(1)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              transition: 'transform var(--t-fast) cubic-bezier(0.34, 1.56, 0.64, 1), background var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease), color var(--t-fast) var(--ease)'
            }}
            onMouseEnter={(e) => {
              if (!filterGap) e.currentTarget.style.transform = 'scale(1.03)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = filterGap ? 'scale(1.05)' : 'scale(1)';
            }}
          >
            <Icon name="scale-balanced" size={12} style={{ color: filterGap ? 'var(--brand)' : 'var(--muted)' }} />
            <span>Solo brecha física vs financiera ≥ 15%</span>
            {filterGap && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)' }} />}
          </button>
        </div>

        <TableViewport className="tbl-wrap">
          <DataTable className="tbl">
            <thead>
              <tr>
                <th className="nw">Contrato</th>
                <th>Empresa</th>
                <th>Contratista</th>
                <th className="nw num">Valor Actualizado</th>
                <th className="nw num">Ejecutado</th>
                <th className="nw num">Saldo</th>
                <th className="nw" style={{ minWidth: '110px' }}>
                  % Financiero
                </th>
                <th className="nw" style={{ minWidth: '110px' }}>
                  % Físico
                </th>
                <th className="nw">Brecha</th>
                <th className="nw">Proyección Agotamiento</th>
                <th className="nw">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((c, idx) => {
                const m = M(c);
                const gap = Math.abs(m.pctFin - m.pctFis);
                return (
                  <tr
                    key={c.id}
                    className="anim-fade-rise"
                    style={{ animationDelay: `${idx * 25}ms`, transition: 'transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)' }}
                    {...HOVER_LIFT}
                  >
                    <td className="nw">
                      <Link
                        className="link font-bold"
                        href={contractHref(c.id, 'ejecucion')}
                        style={{ cursor: 'pointer' }}
                        title="Abrir expediente del contrato"
                      >
                        {c.numero}
                      </Link>
                    </td>
                    <td className="clip" style={{ maxWidth: '160px' }}>
                      {companyName(c.companyId)}
                    </td>
                    <td className="clip" style={{ maxWidth: '180px' }} title={c.contratista}>
                      {c.contratista}
                    </td>
                    <td className="nw num">{money(m.valorActual)}</td>
                    <td className="nw num font-semibold">{money(m.ejecutado)}</td>
                    <td className="nw num" style={{ color: m.saldo < 0 ? 'var(--crit)' : undefined }}>
                      {money(m.saldo)}
                    </td>
                    <td className="nw">
<PBar value={m.pctFin} />
                    </td>
                    <td className="nw">
<PBar value={m.pctFis} color="var(--brand-3)" />
                    </td>
                    <td className="nw">
                      <span className={`badge ${gap >= 20 ? 'crit' : gap >= 10 ? 'warn' : 'ok'}`}>
                        {pct(gap)}
                      </span>
                    </td>
                    <td className="nw">
                      {m.agotaAntes ? (
                        <span className="badge crit">
                          <Icon name="triangle-exclamation" /> {fdate(m.fechaAgotar)}
                        </span>
                      ) : m.fechaAgotar ? (
                        <span className="small muted">{fdate(m.fechaAgotar)}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="nw">
                      <Button className="btn sm" onClick={() => onSelectContract(c.id, 'ejecucion')}>
                        Expediente
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11}>
                    <EmptyState
                      title="No se encontraron contratos"
                      description={
                        hasActiveFilters
                          ? 'Ajusta la búsqueda o desactiva el filtro de brecha para ver el consolidado completo.'
                          : 'Cuando existan contratos activos con informes de ejecución aparecerán aquí.'
                      }
                      action={
                        hasActiveFilters ? (
                          <Button
                            className="btn sm"
                            style={{ marginTop: 8 }}
                            onClick={() => {
                              setQ('');
                              setFilterGap(false);
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
                  <td colSpan={11}>
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

      {/* Modal for Registering Execution */}
      {showModal && (
        <Modal
          title="Registrar avance de ejecución"
          onClose={() => setShowModal(false)}
          size="md"
          footer={
            <>
              <Button className="btn" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleRegisterExec}>
                <Icon name="save" /> Guardar registro
              </Button>
            </>
          }
        >
          <FormGrid className="grid g-1" style={{ gap: '14px' }}>
            <div>
              <label className="lbl required">Contrato</label>
              <Select
                className="inp"
                value={form.contractId}
                onChange={(e) => setForm({ ...form, contractId: e.target.value })}
              >
                <option value="">— Seleccione contrato —</option>
                {cs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero} · {c.contratista}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="lbl required">Periodo (Año - Mes)</label>
              <Input
                type="month"
                className="inp"
                value={form.periodo}
                onChange={(e) => setForm({ ...form, periodo: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl required">Valor ejecutado / facturado en el periodo</label>
              <Input
                type="number"
                className="inp"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="lbl">% Avance físico acumulado</label>
              <Input
                type="number"
                className="inp"
                value={form.avanceFisico}
                onChange={(e) => setForm({ ...form, avanceFisico: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="lbl">Observaciones</label>
              <Textarea
                className="inp"
                rows={2}
                value={form.obs}
                placeholder="Hitos o actividades ejecutadas en este periodo..."
                onChange={(e) => setForm({ ...form, obs: e.target.value })}
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
