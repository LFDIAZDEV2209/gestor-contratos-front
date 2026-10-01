'use client';
import { Input, Select, Textarea } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, Field, TableViewport, DataTable, FormGrid } from '../ui/Workspace';
import { useState } from 'react';
import type { Subcontract, Contract, Company } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { M, companyName } from '../../lib/metrics';
import { money, moneyM, pct, fdate, sum, todayIso, uid } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const SubcontratosView = ({
  onSelectContract
}: {
  onSelectContract: (cid: string, tab?: string) => void;
}) => {
  const [q, setQ] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [showTree, setShowTree] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    contractId: '',
    numero: '',
    contratista: '',
    nit: '',
    objeto: '',
    valor: 0,
    fechaInicio: todayIso(),
    fechaFin: todayIso(),
    ejecucion: 0,
    estado: 'Activo',
    responsable: '',
    documentos: '',
    riesgos: '',
    obligaciones: ''
  });

  const allSubcontracts = (Store.all('subcontracts') as Subcontract[]).slice();
  const allContracts = (Store.all('contracts') as Contract[]).filter((c) => !c.anulado);
  const allCompanies = Store.all('companies') as Company[];

  const totalSubs = allSubcontracts.length;
  const totalVal = sum(allSubcontracts, (s) => Number(s.valor) || 0);
  const activeSubs = allSubcontracts.filter((s) => s.estado === 'Activo').length;
  const avgExec = totalSubs
    ? sum(allSubcontracts, (s) => Number(s.ejecucion) || 0) / totalSubs
    : 0;

  const filtered = allSubcontracts.filter((s) => {
    const c = Store.get('contracts', s.contractId);
    if (filterEstado && s.estado !== filterEstado) return false;
    if (filterCompany && c?.companyId !== filterCompany) return false;
    if (q) {
      const matchNum = s.numero.toLowerCase().includes(q.toLowerCase());
      const matchContr = s.contratista.toLowerCase().includes(q.toLowerCase());
      const matchObj = s.objeto.toLowerCase().includes(q.toLowerCase());
      const matchNit = s.nit.toLowerCase().includes(q.toLowerCase());
      if (!matchNum && !matchContr && !matchObj && !matchNit) return false;
    }
    return true;
  });

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
      { l: 'Estado', k: 'estado' },
      { l: 'Responsable', k: 'responsable' }
    ];
    exportRows('Subcontratos Globales', cols, filtered, format);
  };

  const handleCreate = () => {
    if (!AuthService.guard('crear')) return;
    if (!form.contractId) return notify('Seleccione el contrato principal');
    if (!form.numero.trim()) return notify('Ingrese el número del subcontrato');
    if (!form.contratista.trim()) return notify('Ingrese el nombre del contratista');

    const newSub: Subcontract = {
      id: uid('SC'),
      contractId: form.contractId,
      numero: form.numero.trim(),
      contratista: form.contratista.trim(),
      nit: form.nit.trim(),
      objeto: form.objeto.trim(),
      valor: Number(form.valor) || 0,
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin,
      ejecucion: Number(form.ejecucion) || 0,
      estado: form.estado,
      responsable: form.responsable,
      documentos: form.documentos,
      riesgos: form.riesgos,
      obligaciones: form.obligaciones
    };

    Store.insert('subcontracts', newSub);
    Audit.log({
      contractId: form.contractId,
      modulo: 'Subcontratos',
      accion: 'Creación',
      campo: 'Nuevo subcontrato ' + newSub.numero,
      nuevo: `${newSub.contratista} · ${money(newSub.valor)}`
    });

    setShowModal(false);
  };

  return (
    <div>
      {/* Page Header */}
      <PageHeader className="ph">
        <div>
          <h1>Subcontratos</h1>
          <p>Supervisión y control global de subcontratación en la red de contratos</p>
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
          <Button className="btn sm" onClick={() => setShowTree(!showTree)}>
            <Icon name="diagram-project" /> {showTree ? 'Ver tabla' : 'Ver árbol'}
          </Button>
          <Button className="btn sm pri" onClick={() => setShowModal(true)}>
            <Icon name="plus" /> Nuevo subcontrato
          </Button>
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <div className="kpis mb">
        <Kpi label="Total Subcontratos" value={totalSubs} />
        <Kpi label="Valor Subcontratado" value={moneyM(totalVal)} sub={money(totalVal)} />
        <Kpi label="Subcontratos Activos" value={activeSubs} color="ok" />
        <Kpi label="Ejecución Promedio" value={pct(avgExec, 0)} color="info" />
      </div>

      {/* Visual Tree Mode */}
      {showTree ? (
        <Surface className="panel mb p-4" style={{ background: 'var(--bg-sub)' }}>
          <div className="tree">
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
                          NIT {co.nit} · {cList.length} contrato(s)
                        </div>
                      </span>
                    </span>
                    <ul>
                      {cList.map((c) => {
                        const m = M(c);
                        const sList = allSubcontracts.filter((s) => s.contractId === c.id);
                        return (
                          <li key={c.id}>
                            <span
                              className="node"
                              onClick={() => onSelectContract(c.id, 'subcontratos')}
                              style={{ cursor: 'pointer' }}
                            >
                              <span className={`sem ${m.sem}`}></span>
                              <Icon name="file-contract" />
                              <span>
                                <b>{c.numero}</b> · {c.contratista}
                                <div className="m">
                                  {moneyM(m.valorActual)} · {m.estado} · {sList.length} subcontrato(s)
                                </div>
                              </span>
                            </span>
                            {sList.length > 0 && (
                              <ul>
                                {sList.map((s) => (
                                  <li key={s.id}>
                                    <span
                                      className="node"
                                      onClick={() => onSelectContract(c.id, 'subcontratos')}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      <Icon name="diagram-project" />
                                      <span>
                                        <b>{s.numero}</b> · {s.contratista}
                                        <div className="m">
                                          {moneyM(s.valor)} · {s.estado} · {pct(Number(s.ejecucion) || 0)} ejecutado · vence{' '}
                                          {fdate(s.fechaFin)}
                                        </div>
                                      </span>
                                    </span>
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
          </div>
        </Surface>
      ) : (
        /* Table Mode */
        <Surface className="panel">
          {/* Filters Bar */}
          <div className="filters mb" style={{ padding: '12px 16px' }}>
            <div className="gsearch">
              <Icon name="search" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por subcontratista, NIT, número u objeto..."
              />
            </div>
            <Field className="f">
              <Select
                className="inp sm"
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
              >
                <option value="">— Todas las empresas —</option>
                {allCompanies.map((co) => (
                  <option key={co.id} value={co.id}>
                    {co.razon || co.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field className="f">
              <Select
                className="inp sm"
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
              >
                <option value="">— Todos los estados —</option>
                <option value="Activo">Activo</option>
                <option value="Suspendido">Suspendido</option>
                <option value="Terminado">Terminado</option>
                <option value="Liquidado">Liquidado</option>
              </Select>
            </Field>
          </div>

          <TableViewport className="tbl-wrap">
            <DataTable className="tbl">
              <thead>
                <tr>
                  <th className="nw">Número</th>
                  <th className="nw">Contrato Principal</th>
                  <th>Subcontratista</th>
                  <th className="nw">NIT</th>
                  <th>Objeto</th>
                  <th className="nw num">Valor</th>
                  <th className="nw">Inicio</th>
                  <th className="nw">Terminación</th>
                  <th className="nw" style={{ minWidth: '120px' }}>
                    % Ejecución
                  </th>
                  <th className="nw">Estado</th>
                  <th className="nw">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const c = Store.get('contracts', s.contractId);
                  return (
                    <tr key={s.id}>
                      <td className="nw">
                        <b>{s.numero}</b>
                      </td>
                      <td className="nw">
                        {c ? (
                          <a
                            className="link"
                            onClick={() => onSelectContract(c.id, 'subcontratos')}
                            style={{ cursor: 'pointer' }}
                          >
                            {c.numero}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="clip" style={{ maxWidth: '180px' }} title={s.contratista}>
                        {s.contratista}
                      </td>
                      <td className="nw">{s.nit}</td>
                      <td className="clip" style={{ maxWidth: '240px' }} title={s.objeto}>
                        {s.objeto}
                      </td>
                      <td className="nw num font-semibold">{money(s.valor)}</td>
                      <td className="nw">{fdate(s.fechaInicio)}</td>
                      <td className="nw">{fdate(s.fechaFin)}</td>
                      <td className="nw">
                        <div className="row-flex" style={{ gap: '6px' }}>
                          <div className="bar" style={{ flex: 1, minWidth: '50px' }}>
                            <i style={{ width: pct(Number(s.ejecucion) || 0) }}></i>
                          </div>
                          <span className="small">{pct(Number(s.ejecucion) || 0)}</span>
                        </div>
                      </td>
                      <td className="nw">
                        <Badge
                          text={s.estado}
                          color={
                            s.estado === 'Activo'
                              ? 'ok'
                              : s.estado === 'Suspendido'
                              ? 'warn'
                              : 'default'
                          }
                        />
                      </td>
                      <td className="nw">
                        {c && (
                          <Button
                            className="btn sm"
                            onClick={() => onSelectContract(c.id, 'subcontratos')}
                          >
                            Ver en contrato
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} className="empty">
                      No se encontraron subcontratos con los criterios seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </DataTable>
          </TableViewport>
        </Surface>
      )}

      {/* Modal for New Subcontract */}
      {showModal && (
        <Modal
          title="Nuevo subcontrato"
          onClose={() => setShowModal(false)}
          size="lg"
          footer={
            <>
              <Button className="btn" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleCreate}>
                <Icon name="save" /> Guardar subcontrato
              </Button>
            </>
          }
        >
          <FormGrid className="grid g-2" style={{ gap: '14px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl required">Contrato principal</label>
              <Select
                className="inp"
                value={form.contractId}
                onChange={(e) => setForm({ ...form, contractId: e.target.value })}
              >
                <option value="">— Seleccione contrato —</option>
                {allContracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero} · {c.contratista} · {moneyM(M(c).valorActual)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="lbl required">Número de subcontrato</label>
              <Input
                className="inp"
                value={form.numero}
                placeholder="Ej. SC-001"
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl required">Subcontratista</label>
              <Input
                className="inp"
                value={form.contratista}
                placeholder="Nombre o razón social"
                onChange={(e) => setForm({ ...form, contratista: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl required">NIT</label>
              <Input
                className="inp"
                value={form.nit}
                placeholder="900.000.000-0"
                onChange={(e) => setForm({ ...form, nit: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl required">Valor</label>
              <Input
                type="number"
                className="inp"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="lbl required">Fecha de inicio</label>
              <Input
                type="date"
                className="inp"
                value={form.fechaInicio}
                onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl required">Fecha de terminación</label>
              <Input
                type="date"
                className="inp"
                value={form.fechaFin}
                onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl required">Objeto del subcontrato</label>
              <Textarea
                className="inp"
                rows={2}
                value={form.objeto}
                placeholder="Detalle de actividades a ejecutar..."
                onChange={(e) => setForm({ ...form, objeto: e.target.value })}
              />
            </div>
          </FormGrid>
        </Modal>
      )}
    </div>
  );
};
