'use client';
import { notify, confirmAction } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, Field, TableViewport, DataTable, FormGrid } from '../ui/Workspace';
import { useState } from 'react';
import type { Guarantee, Contract, Cupo } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { CAT } from '../../lib/catalog';
import { cupoStats } from '../../lib/metrics';
import { money, moneyM, pct, fdate, diffDays, todayIso, uid, sum } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const GarantiasView = ({
  onSelectContract
}: {
  onSelectContract: (cid: string, tab?: string) => void;
}) => {
  const [activeTab, setActiveTab] = useState<string>('todas');
  const [filterAseg, setFilterAseg] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [q, setQ] = useState('');
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    contractId: '',
    tipo: 'Cumplimiento',
    aseguradora: CAT('aseguradoras')[0] || 'Seguros del Estado S.A.',
    poliza: '',
    modalidadPoliza: 'Póliza individual',
    cupoId: '',
    porcentaje: 10,
    tomador: '',
    intermediario: '',
    prima: 0,
    valor: 0,
    fechaExp: todayIso(),
    fechaInicio: todayIso(),
    fechaVenc: todayIso(),
    estado: 'Aprobada',
    documento: ''
  });

  const allGuarantees = (Store.all('guarantees') as Guarantee[]).slice().sort((a, b) =>
    (a.fechaVenc || '') < (b.fechaVenc || '') ? -1 : 1
  );
  const allContracts = (Store.all('contracts') as Contract[]).filter((c) => !c.anulado);
  const allCupos = Store.all('cupos') as Cupo[];

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

  const availableCupos = allCupos.filter(
    (cp) => cp.aseguradora === form.aseguradora && cp.estado === 'Vigente'
  );

  const handleCreate = async () => {
    if (!AuthService.guard('crear')) return;
    if (!form.contractId) return notify('Seleccione un contrato');
    if (!form.poliza.trim()) return notify('Ingrese el número de la póliza');
    if (!form.valor) return notify('Ingrese el valor asegurado');

    if (form.modalidadPoliza === 'Póliza por cupo' && form.cupoId) {
      const cupoObj = Store.get('cupos', form.cupoId);
      if (cupoObj) {
        const stats = cupoStats(cupoObj);
        if (Number(form.valor) > stats.disponible) {
          const proceed = await confirmAction(
            `El valor asegurado (${money(form.valor)}) supera el saldo disponible del cupo (${money(
              stats.disponible
            )}).\n\n¿Desea registrar la póliza de todas formas?`
          );
          if (!proceed) return;
        }
      }
    }

    const newG: Guarantee = {
      id: uid('GR'),
      contractId: form.contractId,
      tipo: form.tipo,
      aseguradora: form.aseguradora,
      poliza: form.poliza.trim(),
      modalidadPoliza: form.modalidadPoliza,
      cupoId: form.modalidadPoliza === 'Póliza por cupo' ? form.cupoId : undefined,
      porcentaje: Number(form.porcentaje) || 10,
      tomador: form.tomador,
      intermediario: form.intermediario,
      prima: Number(form.prima) || 0,
      valor: Number(form.valor),
      fechaExp: form.fechaExp,
      fechaInicio: form.fechaInicio,
      fechaVenc: form.fechaVenc,
      estado: form.estado,
      documento: form.documento || `${form.poliza.trim()}.pdf`
    };

    Store.insert('guarantees', newG);
    Audit.log({
      contractId: form.contractId,
      modulo: 'Garantías',
      accion: 'Creación',
      campo: 'Póliza ' + newG.poliza,
      nuevo: `${newG.tipo} - ${newG.aseguradora} - ${money(newG.valor)}`
    });

    setShowModal(false);
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

  return (
    <div>
      {/* Page Header */}
      <PageHeader className="ph">
        <div>
          <h1>Garantías y pólizas</h1>
          <p>Control integral de pólizas contractuales, vigencias y esquemas de cupo</p>
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
            <Icon name="plus" /> Nueva póliza
          </Button>
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <div className="kpis mb">
        <Kpi label="Total Pólizas" value={totalGarantias} />
        <Kpi label="Valor Asegurado Total" value={moneyM(totalVal)} sub={money(totalVal)} />
        <Kpi label="Pólizas Vigentes" value={vigentes} color="ok" />
        <Kpi label="Vencen ≤ 30 días" value={proxVencer} color={proxVencer > 0 ? 'warn' : 'ok'} />
        <Kpi label="Pólizas Vencidas" value={vencidas} color={vencidas > 0 ? 'crit' : 'ok'} />
      </div>

      {/* Main Panel */}
      <Surface className="panel">
        {/* Quick Views */}
        <div className="tabs" style={{ padding: '0 12px' }}>
          <Button
            className={`tab ${activeTab === 'todas' ? 'on' : ''}`}
            onClick={() => setActiveTab('todas')}
          >
            Todas ({totalGarantias})
          </Button>
          <Button
            className={`tab ${activeTab === 'prox30' ? 'on' : ''}`}
            onClick={() => setActiveTab('prox30')}
          >
            Vencen ≤ 30 días ({proxVencer})
          </Button>
          <Button
            className={`tab ${activeTab === 'vencidas' ? 'on' : ''}`}
            onClick={() => setActiveTab('vencidas')}
          >
            Vencidas ({vencidas})
          </Button>
          <Button
            className={`tab ${activeTab === 'cupo' ? 'on' : ''}`}
            onClick={() => setActiveTab('cupo')}
          >
            Por cupo ({allGuarantees.filter((g) => g.modalidadPoliza === 'Póliza por cupo').length})
          </Button>
          <Button
            className={`tab ${activeTab === 'individual' ? 'on' : ''}`}
            onClick={() => setActiveTab('individual')}
          >
            Individuales ({allGuarantees.filter((g) => g.modalidadPoliza !== 'Póliza por cupo').length})
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="filters mb" style={{ padding: '12px 16px' }}>
          <div className="gsearch">
            <Icon name="search" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por póliza, tomador o contrato..."
            />
          </div>
          <Field className="f">
            <select
              className="inp sm"
              value={filterAseg}
              onChange={(e) => setFilterAseg(e.target.value)}
            >
              <option value="">— Todas las aseguradoras —</option>
              {CAT('aseguradoras').map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>
          <Field className="f">
            <select
              className="inp sm"
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
            >
              <option value="">— Todos los tipos —</option>
              {CAT('tiposGarantia').map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Table */}
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
              {filtered.map((g) => {
                const c = Store.get('contracts', g.contractId);
                const d = diffDays(now, g.fechaVenc);
                const isPorCupo = g.modalidadPoliza === 'Póliza por cupo';
                return (
                  <tr key={g.id}>
                    <td className="nw">
                      {c ? (
                        <a
                          className="link font-bold"
                          onClick={() => onSelectContract(c.id, 'garantias')}
                          style={{ cursor: 'pointer' }}
                        >
                          {c.numero}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{g.aseguradora}</td>
                    <td className="nw">
                      <b>{g.poliza}</b>
                    </td>
                    <td className="nw">
                      <span className={`badge ${isPorCupo ? 'b-info' : ''}`}>
                        {isPorCupo ? 'Por cupo' : 'Individual'}
                      </span>
                    </td>
                    <td>{g.tipo}</td>
                    <td className="nw num font-semibold">{money(g.valor)}</td>
                    <td className="nw">{fdate(g.fechaInicio)}</td>
                    <td className="nw font-semibold">{fdate(g.fechaVenc)}</td>
                    <td className="nw">
                      <span
                        className={`badge ${
                          d < 0 ? 'crit' : d <= 30 ? 'warn' : 'ok'
                        }`}
                      >
                        {d < 0 ? `Vencida (${Math.abs(d)} d)` : `${d} días`}
                      </span>
                    </td>
                    <td className="nw">
                      <Badge
                        text={g.estado}
                        color={
                          g.estado === 'Aprobada'
                            ? 'ok'
                            : g.estado === 'Pendiente'
                            ? 'warn'
                            : 'crit'
                        }
                      />
                    </td>
                    <td className="nw">
                      {c && (
                        <Button
                          className="btn sm"
                          onClick={() => onSelectContract(c.id, 'garantias')}
                          title="Ver en expediente del contrato"
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
                  <td colSpan={11} className="empty">
                    No se encontraron pólizas con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </TableViewport>
      </Surface>

      {/* Modal for New Policy */}
      {showModal && (
        <Modal
          title="Nueva póliza de garantía"
          onClose={() => setShowModal(false)}
          size="lg"
          footer={
            <>
              <Button className="btn" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleCreate}>
                <Icon name="save" /> Registrar póliza
              </Button>
            </>
          }
        >
          <FormGrid className="grid g-2" style={{ gap: '14px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl required">Contrato</label>
              <select
                className="inp"
                value={form.contractId}
                onChange={(e) => setForm({ ...form, contractId: e.target.value })}
              >
                <option value="">— Seleccione contrato —</option>
                {allContracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero} · {c.contratista} · {moneyM(c.valorBase)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl required">Aseguradora</label>
              <select
                className="inp"
                value={form.aseguradora}
                onChange={(e) => setForm({ ...form, aseguradora: e.target.value, cupoId: '' })}
              >
                {CAT('aseguradoras').map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl required">Tipo de garantía</label>
              <select
                className="inp"
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              >
                {CAT('tiposGarantia').map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl required">Número de póliza</label>
              <input
                className="inp"
                value={form.poliza}
                placeholder="Ej. POL-984321"
                onChange={(e) => setForm({ ...form, poliza: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl required">Modalidad de expedición</label>
              <select
                className="inp"
                value={form.modalidadPoliza}
                onChange={(e) => setForm({ ...form, modalidadPoliza: e.target.value })}
              >
                <option value="Póliza individual">Póliza individual</option>
                <option value="Póliza por cupo">Póliza por cupo</option>
              </select>
            </div>

            {form.modalidadPoliza === 'Póliza por cupo' && (
              <div style={{ gridColumn: 'span 2' }}>
                <label className="lbl required">
                  Cupo de la aseguradora ({availableCupos.length} disponibles)
                </label>
                <select
                  className="inp"
                  value={form.cupoId}
                  onChange={(e) => setForm({ ...form, cupoId: e.target.value })}
                >
                  <option value="">— Seleccione un cupo vigente —</option>
                  {availableCupos.map((cp) => {
                    const st = cupoStats(cp);
                    return (
                      <option key={cp.id} value={cp.id}>
                        {cp.numero} · Total {moneyM(cp.valor)} · Disp: {moneyM(st.disponible)} ({pct(st.pct, 0)} usado)
                      </option>
                    );
                  })}
                </select>
                {availableCupos.length === 0 && (
                  <div className="small text-danger mt-1" style={{ color: 'var(--crit)' }}>
                    No hay cupos vigentes registrados para {form.aseguradora}.
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="lbl required">Valor asegurado</label>
              <input
                type="number"
                className="inp"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="lbl">Prima</label>
              <input
                type="number"
                className="inp"
                value={form.prima}
                onChange={(e) => setForm({ ...form, prima: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="lbl required">Fecha inicio vigencia</label>
              <input
                type="date"
                className="inp"
                value={form.fechaInicio}
                onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl required">Fecha fin vigencia</label>
              <input
                type="date"
                className="inp"
                value={form.fechaVenc}
                onChange={(e) => setForm({ ...form, fechaVenc: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl">Tomador</label>
              <input
                className="inp"
                value={form.tomador}
                placeholder="Razón social o contratista"
                onChange={(e) => setForm({ ...form, tomador: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl">Intermediario / Corredor</label>
              <input
                className="inp"
                value={form.intermediario}
                placeholder="Corredor de seguros"
                onChange={(e) => setForm({ ...form, intermediario: e.target.value })}
              />
            </div>
          </FormGrid>
        </Modal>
      )}
    </div>
  );
};
