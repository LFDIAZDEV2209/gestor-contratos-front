'use client';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, TableViewport, DataTable, FormGrid } from '../ui/Workspace';
import { useState } from 'react';
import type { Contract, Exec } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { M, activeContracts, companyName } from '../../lib/metrics';
import { money, moneyM, pct, fdate, sum, monthKey, monthLabel, lastMonths, groupBy, todayIso } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Chart } from '../ui/Chart';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const EjecucionView = ({
  onSelectContract
}: {
  onSelectContract: (cid: string, tab?: string) => void;
}) => {
  const [q, setQ] = useState('');
  const [filterGap, setFilterGap] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    contractId: '',
    periodo: todayIso().slice(0, 7),
    valor: 0,
    avanceFisico: 0,
    obs: ''
  });

  const cs = activeContracts();
  const allExecs = Store.all('execs') as Exec[];

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
        backgroundColor: '#0B6E68',
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
  };

  return (
    <div>
      {/* Page Header */}
      <PageHeader className="ph">
        <div>
          <h1>Ejecución contractual</h1>
          <p>Consolidado financiero, físico y alertas de agotamiento temprano de recursos</p>
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

      {/* KPI Cards */}
      <div className="kpis mb">
        <Kpi label="Total Administrado" value={moneyM(totalValor)} sub={money(totalValor)} />
        <Kpi label="Total Ejecutado" value={moneyM(totalEjec)} sub={money(totalEjec)} />
        <Kpi label="% Ejecución Financiera" value={pct(pctFinGlobal)} color={pctFinGlobal > 100 ? 'crit' : 'ok'} />
        <Kpi label="% Ejecución Física Promedio" value={pct(pctFisGlobal)} color="info" />
      </div>

      {/* Depletion Notice */}
      {agotaAntesList.length > 0 && (
        <Surface
          className="panel mb p-3"
          style={{
            background: 'var(--crit-s)',
            border: '1px solid var(--crit)',
            borderRadius: '6px'
          }}
        >
          <div className="flex items-center gap-2 font-semibold" style={{ color: 'var(--crit)' }}>
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
                  style={{ background: '#fff' }}
                  onClick={() => onSelectContract(c.id, 'ejecucion')}
                >
                  <b>{c.numero}</b> (se agota ~{fdate(m.fechaAgotar)})
                </Button>
              );
            })}
          </div>
        </Surface>
      )}

      {/* Chart */}
      <Surface className="panel mb">
        <div className="panel-h">
          <h3>Evolución de ejecución mensual</h3>
          <span className="sub">Valor mensual acumulado del portafolio (últimos 12 meses)</span>
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
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar contrato..."
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={filterGap}
              onChange={(e) => setFilterGap(e.target.checked)}
            />
            <span>Solo brecha física vs financiera ≥ 15%</span>
          </label>
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
              {filtered.map((c) => {
                const m = M(c);
                const gap = Math.abs(m.pctFin - m.pctFis);
                return (
                  <tr key={c.id}>
                    <td className="nw">
                      <a
                        className="link font-bold"
                        onClick={() => onSelectContract(c.id, 'ejecucion')}
                        style={{ cursor: 'pointer' }}
                      >
                        {c.numero}
                      </a>
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
                      <div className="row-flex" style={{ gap: '6px' }}>
                        <div className="bar" style={{ flex: 1, minWidth: '50px' }}>
                          <i
                            style={{
                              width: pct(m.pctFin),
                              background: m.pctFin > 100 ? 'var(--crit)' : 'var(--brand)'
                            }}
                          ></i>
                        </div>
                        <span className="small">{pct(m.pctFin)}</span>
                      </div>
                    </td>
                    <td className="nw">
                      <div className="row-flex" style={{ gap: '6px' }}>
                        <div className="bar" style={{ flex: 1, minWidth: '50px' }}>
                          <i style={{ width: pct(m.pctFis), background: '#4E9A8F' }}></i>
                        </div>
                        <span className="small">{pct(m.pctFis)}</span>
                      </div>
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
                  <td colSpan={11} className="empty">
                    No se encontraron contratos con los criterios especificados.
                  </td>
                </tr>
              )}
            </tbody>
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
              <select
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
              </select>
            </div>
            <div>
              <label className="lbl required">Periodo (Año - Mes)</label>
              <input
                type="month"
                className="inp"
                value={form.periodo}
                onChange={(e) => setForm({ ...form, periodo: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl required">Valor ejecutado / facturado en el periodo</label>
              <input
                type="number"
                className="inp"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="lbl">% Avance físico acumulado</label>
              <input
                type="number"
                className="inp"
                value={form.avanceFisico}
                onChange={(e) => setForm({ ...form, avanceFisico: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="lbl">Observaciones</label>
              <textarea
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
    </div>
  );
};
