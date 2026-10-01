'use client';
import { useState } from 'react';
import type { Guarantee, Contract, Cupo } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { CAT } from '../../lib/catalog';
import { cupoStats, activeContracts, contractInsurers } from '../../lib/metrics';
import { money, moneyM, pct, fdate, diffDays, todayIso, uid, sum, clamp, groupBy } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const AseguradorasView = ({
  onSelectContract,
  onNavigateToGarantias
}: {
  onSelectContract: (cid: string, tab?: string) => void;
  onNavigateToGarantias?: () => void;
}) => {
  const [showCupoModal, setShowCupoModal] = useState(false);
  const [cupoForm, setCupoForm] = useState({
    aseguradora: CAT('aseguradoras')[0] || 'Seguros del Estado S.A.',
    numero: '',
    tomador: '',
    intermediario: '',
    valor: 0,
    fechaInicio: todayIso(),
    fechaVenc: todayIso(),
    estado: 'Vigente',
    observaciones: ''
  });

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

  const handleCreateCupo = () => {
    if (!AuthService.guard('crear')) return;
    if (!cupoForm.numero.trim()) return alert('Ingrese el número del cupo');
    if (!cupoForm.valor) return alert('Ingrese el valor asignado al cupo');

    const newCp: Cupo = {
      id: uid('CP'),
      aseguradora: cupoForm.aseguradora,
      numero: cupoForm.numero.trim(),
      tomador: cupoForm.tomador,
      intermediario: cupoForm.intermediario,
      valor: Number(cupoForm.valor),
      fechaInicio: cupoForm.fechaInicio,
      fechaVenc: cupoForm.fechaVenc,
      estado: cupoForm.estado,
      observaciones: cupoForm.observaciones
    };

    Store.insert('cupos', newCp);
    Audit.log({
      modulo: 'Cupos',
      accion: 'Creación',
      campo: 'Cupo ' + newCp.numero,
      nuevo: `${newCp.aseguradora} - ${money(newCp.valor)}`
    });

    setShowCupoModal(false);
  };

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
    <div>
      {/* Page Header */}
      <div className="ph">
        <div>
          <h1>Aseguradoras y cupos</h1>
          <p>
            Supervisión integral de afianzamiento, pólizas por cupo global e individuales, y balance
            de cupos
          </p>
        </div>
        <div className="ph-actions">
          <div className="exp-actions">
            <button className="btn sm" onClick={() => handleExport('xlsx')} title="Exportar a Excel">
              <Icon name="file-excel" /> Excel
            </button>
            <button className="btn sm" onClick={() => handleExport('pdf')} title="Exportar a PDF">
              <Icon name="file-pdf" /> PDF
            </button>
            <button className="btn sm" onClick={() => handleExport('csv')} title="Exportar a CSV">
              <Icon name="file-csv" /> CSV
            </button>
          </div>
          <button className="btn sm pri" onClick={() => setShowCupoModal(true)}>
            <Icon name="plus" /> Nuevo cupo
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpis mb">
        <Kpi label="Aseguradoras activas" value={insurerStatsList.length} sub={`${CAT('aseguradoras').length} en catálogo`} />
        <Kpi
          label="Pólizas vigentes"
          value={allGuarantees.filter((g) => g.estado === 'Aprobada' && g.fechaVenc >= now).length}
          sub={`${allGuarantees.length} registradas`}
          color="ok"
          onClick={onNavigateToGarantias}
        />
        <Kpi label="Valor Asegurado Total" value={moneyM(sum(allGuarantees, (g) => Number(g.valor) || 0))} />
        <Kpi
          label="Pólizas por cupo"
          value={allGuarantees.filter((g) => g.modalidadPoliza === 'Póliza por cupo').length}
          sub={`${allGuarantees.filter((g) => g.modalidadPoliza !== 'Póliza por cupo').length} individuales`}
        />
        <Kpi label="Cupos vigentes" value={vigCupos.length} sub={`Cupo total ${moneyM(ct)}`} />
        <Kpi
          label="Cupo utilizado"
          value={pct(ct ? (cu / ct) * 100 : 0, 0)}
          sub={`Disponible ${moneyM(ct - cu)}`}
          color={ct && cu / ct > 0.85 ? 'risk' : 'ok'}
        />
        <Kpi label="Contratos multi-aseguradora" value={multiAseg.length} sub={`de ${cs.length} contratos`} />
        <Kpi
          label="Contratos sin pólizas"
          value={sinPolizas.length}
          sub="Revisar requisitos"
          color={sinPolizas.length > 0 ? 'warn' : 'ok'}
        />
      </div>

      {/* Insurer Cards Grid */}
      <div className="grid g3 mb" style={{ gap: '16px' }}>
        {insurerStatsList.map((x) => (
          <div key={x.a} className="panel">
            <div className="panel-b">
              <div className="row-flex" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', gap: '10px' }}>
                <div
                  className="alert-ic"
                  style={{
                    background: 'rgba(11, 110, 104, 0.1)',
                    color: '#0B6E68',
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
                    {x.vencidas > 0 && <span style={{ color: 'var(--crit)' }}> · {x.vencidas} vencida(s)</span>}
                    {x.prox > 0 && <span style={{ color: 'var(--warn)' }}> · {x.prox} por vencer</span>}
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
              {x.cupos.length > 0 && (
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
                        <div className="bar" style={{ height: '6px' }}>
                          <i style={{ width: `${clamp(st.pct, 0, 100)}%`, background: color }}></i>
                        </div>
                        <div className="small muted mt-1" style={{ fontSize: '11px' }}>
                          Saldo disponible: {moneyM(st.disponible)} · Vence {fdate(cp.fechaVenc)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Contracts x Insurers Matrix */}
      <div className="panel mb">
        <div className="panel-h">
          <div>
            <h3>Matriz de cobertura: Contratos × Aseguradoras</h3>
            <span className="sub">Pólizas vigentes de los contratos activos en las principales aseguradoras</span>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
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
              {cs.map((c) => {
                const cPols = allGuarantees.filter((g) => g.contractId === c.id);
                return (
                  <tr key={c.id}>
                    <td className="nw">
                      <a
                        className="link font-bold"
                        onClick={() => onSelectContract(c.id, 'garantias')}
                        style={{ cursor: 'pointer' }}
                      >
                        {c.numero}
                      </a>
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
                            <span className="badge ok" title={`${count} póliza(s)`}>
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
            </tbody>
          </table>
        </div>
      </div>

      {/* CRUD Table for Quotas */}
      <div className="panel">
        <div className="panel-h">
          <div>
            <h3>Cupos de crédito / afianzamiento</h3>
            <span className="sub">Líneas globales de seguro rotativo por aseguradora</span>
          </div>
          <button className="btn sm pri" onClick={() => setShowCupoModal(true)}>
            <Icon name="plus" /> Nuevo cupo
          </button>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
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
              {allCupos.map((cp) => {
                const st = cupoStats(cp);
                return (
                  <tr key={cp.id}>
                    <td className="nw">
                      <b>{cp.numero}</b>
                    </td>
                    <td>{cp.aseguradora}</td>
                    <td>{cp.tomador || '—'}</td>
                    <td className="nw num">{money(cp.valor)}</td>
                    <td className="nw num font-semibold">{money(st.utilizado)}</td>
                    <td
                      className="nw num font-semibold"
                      style={{ color: st.disponible < 0 ? 'var(--crit)' : undefined }}
                    >
                      {money(st.disponible)}
                    </td>
                    <td className="nw">
                      <div className="row-flex" style={{ gap: '6px' }}>
                        <div className="bar" style={{ flex: 1, minWidth: '50px' }}>
                          <i
                            style={{
                              width: `${clamp(st.pct, 0, 100)}%`,
                              background:
                                st.pct > 100
                                  ? 'var(--crit)'
                                  : st.pct >= 85
                                  ? 'var(--warn)'
                                  : 'var(--brand)'
                            }}
                          ></i>
                        </div>
                        <span className="small">{pct(st.pct, 0)}</span>
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
                  <td colSpan={10} className="empty">
                    No hay cupos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for New Quota */}
      {showCupoModal && (
        <Modal
          title="Nuevo cupo de aseguradora"
          onClose={() => setShowCupoModal(false)}
          size="md"
          footer={
            <>
              <button className="btn" onClick={() => setShowCupoModal(false)}>
                Cancelar
              </button>
              <button className="btn pri" onClick={handleCreateCupo}>
                <Icon name="save" /> Registrar cupo
              </button>
            </>
          }
        >
          <div className="grid g-1" style={{ gap: '14px' }}>
            <div>
              <label className="lbl required">Aseguradora</label>
              <select
                className="inp"
                value={cupoForm.aseguradora}
                onChange={(e) => setCupoForm({ ...cupoForm, aseguradora: e.target.value })}
              >
                {CAT('aseguradoras').map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl required">Número / Código de cupo</label>
              <input
                className="inp"
                value={cupoForm.numero}
                placeholder="Ej. CUP-SURA-2026"
                onChange={(e) => setCupoForm({ ...cupoForm, numero: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl required">Valor total asignado</label>
              <input
                type="number"
                className="inp"
                value={cupoForm.valor}
                onChange={(e) => setCupoForm({ ...cupoForm, valor: Number(e.target.value) })}
              />
            </div>
            <div className="grid g-2" style={{ gap: '10px' }}>
              <div>
                <label className="lbl required">Fecha inicio</label>
                <input
                  type="date"
                  className="inp"
                  value={cupoForm.fechaInicio}
                  onChange={(e) => setCupoForm({ ...cupoForm, fechaInicio: e.target.value })}
                />
              </div>
              <div>
                <label className="lbl required">Fecha vencimiento</label>
                <input
                  type="date"
                  className="inp"
                  value={cupoForm.fechaVenc}
                  onChange={(e) => setCupoForm({ ...cupoForm, fechaVenc: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="lbl">Tomador / Beneficiario</label>
              <input
                className="inp"
                value={cupoForm.tomador}
                placeholder="Razón social contratante o consorcio"
                onChange={(e) => setCupoForm({ ...cupoForm, tomador: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl">Intermediario / Corredor</label>
              <input
                className="inp"
                value={cupoForm.intermediario}
                placeholder="Agencia o corredor de seguros"
                onChange={(e) => setCupoForm({ ...cupoForm, intermediario: e.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
