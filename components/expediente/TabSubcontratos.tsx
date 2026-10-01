'use client';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, FormGrid } from '../ui/Workspace';
import { useState } from 'react';
import type { Subcontract, Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { M } from '../../lib/metrics';
import { money, moneyM, pct, fdate, todayIso, uid, sum } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const TabSubcontratos = ({ cid }: { cid: string }) => {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
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

  const c = Store.get('contracts', cid) as Contract | undefined;
  if (!c) return <div className="empty">Contrato no encontrado</div>;

  const m = M(c);
  const subcontracts = (Store.byContract('subcontracts', cid) as Subcontract[]).sort((a, b) =>
    a.fechaInicio < b.fechaInicio ? -1 : 1
  );

  const sv = sum(subcontracts, (s) => Number(s.valor) || 0);
  const pctOfContract = m.valorActual ? (sv / m.valorActual) * 100 : 0;
  const company = Store.get('companies', c.companyId);

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      { l: 'Número', k: 'numero' },
      { l: 'Contratista', k: 'contratista' },
      { l: 'NIT', k: 'nit' },
      { l: 'Objeto', k: 'objeto' },
      { l: 'Valor', k: 'valor', r: (r: any) => money(r.valor) },
      { l: 'Inicio', k: 'fechaInicio', r: (r: any) => fdate(r.fechaInicio) },
      { l: 'Terminación', k: 'fechaFin', r: (r: any) => fdate(r.fechaFin) },
      { l: '% Ejecución', k: 'ejecucion', r: (r: any) => pct(r.ejecucion) },
      { l: 'Estado', k: 'estado' },
      { l: 'Responsable', k: 'responsable' }
    ];
    exportRows('Subcontratos - ' + c.numero, cols, subcontracts, format);
  };

  const handleCreate = () => {
    if (!AuthService.guard('crear')) return;
    if (!form.numero.trim()) return notify('Ingrese el número del subcontrato');
    if (!form.contratista.trim()) return notify('Ingrese el nombre del subcontratista');
    if (!form.valor) return notify('Ingrese el valor del subcontrato');

    const newSub: Subcontract = {
      id: uid('SC'),
      contractId: cid,
      numero: form.numero.trim(),
      contratista: form.contratista.trim(),
      nit: form.nit.trim(),
      objeto: form.objeto.trim(),
      valor: Number(form.valor),
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin,
      ejecucion: Number(form.ejecucion) || 0,
      estado: form.estado,
      responsable: form.responsable || c.supervisor || 'Supervisor',
      documentos: form.documentos,
      riesgos: form.riesgos,
      obligaciones: form.obligaciones
    };

    Store.insert('subcontracts', newSub);
    Audit.log({
      contractId: cid,
      modulo: 'Subcontratos',
      accion: 'Creación',
      campo: 'Nuevo subcontrato ' + newSub.numero,
      nuevo: `${newSub.contratista} · ${money(newSub.valor)}`
    });

    setShowModal(false);
    setForm({
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
  };

  return (
    <Surface className="panel">
      <div className="panel-h" style={{ borderTop: 0 }}>
        <div>
          <h3>Subcontratos</h3>
          <span className="sub">
            {subcontracts.length} subcontrato(s) · {money(sv)} ({pct(pctOfContract)} del valor contractual)
          </span>
        </div>
        <div className="row-flex">
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
            <Icon name="plus" /> Nuevo subcontrato
          </Button>
        </div>
      </div>

      {/* Visual Tree */}
      <div className="p-4" style={{ background: 'var(--bg-sub)', borderBottom: '1px solid var(--line)' }}>
        <div className="tree">
          <ul>
            <li>
              <span className="node co">
                <Icon name="building" />
                <span>
                  <b>{company?.razon || 'Empresa Contratante'}</b>
                  <div className="m">NIT {company?.nit || '—'}</div>
                </span>
              </span>
              <ul>
                <li>
                  <span className="node">
                    <Icon name="file-contract" />
                    <span>
                      <b>{c.numero}</b> · {c.contratista}
                      <div className="m">
                        {moneyM(m.valorActual)} · {m.estado} · {subcontracts.length} subcontrato(s)
                      </div>
                    </span>
                  </span>
                  {subcontracts.length > 0 && (
                    <ul>
                      {subcontracts.map((s) => (
                        <li key={s.id}>
                          <span className="node">
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
              </ul>
            </li>
          </ul>
        </div>
      </div>

      {/* Table */}
      <TableViewport className="tbl-wrap">
        <DataTable className="tbl">
          <thead>
            <tr>
              <th className="nw">Número</th>
              <th>Contratista</th>
              <th className="nw">NIT</th>
              <th>Objeto</th>
              <th className="nw num">Valor</th>
              <th className="nw">Inicio</th>
              <th className="nw">Terminación</th>
              <th className="nw" style={{ minWidth: '120px' }}>
                % Ejecución
              </th>
              <th className="nw">Estado</th>
              <th>Responsable</th>
            </tr>
          </thead>
          <tbody>
            {subcontracts.map((s) => (
              <tr key={s.id}>
                <td className="nw">
                  <b>{s.numero}</b>
                </td>
                <td className="clip" style={{ maxWidth: '200px' }} title={s.contratista}>
                  {s.contratista}
                </td>
                <td className="nw">{s.nit}</td>
                <td className="clip" style={{ maxWidth: '260px' }} title={s.objeto}>
                  {s.objeto}
                </td>
                <td className="nw num">{money(s.valor)}</td>
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
                <td>{s.responsable || '—'}</td>
              </tr>
            ))}
            {subcontracts.length === 0 && (
              <tr>
                <td colSpan={10} className="empty">
                  El contrato no registra subcontratos.
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </TableViewport>

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
            <div>
              <label className="lbl required">Número de subcontrato</label>
              <input
                className="inp"
                value={form.numero}
                placeholder="Ej. SC-001"
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl required">Nombre del subcontratista</label>
              <input
                className="inp"
                value={form.contratista}
                placeholder="Razón social o nombre"
                onChange={(e) => setForm({ ...form, contratista: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl required">NIT / Documento</label>
              <input
                className="inp"
                value={form.nit}
                placeholder="NIT 900.000.000-0"
                onChange={(e) => setForm({ ...form, nit: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl required">Valor del subcontrato</label>
              <input
                type="number"
                className="inp"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="lbl required">Fecha de inicio</label>
              <input
                type="date"
                className="inp"
                value={form.fechaInicio}
                onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl required">Fecha de terminación</label>
              <input
                type="date"
                className="inp"
                value={form.fechaFin}
                onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl">% Ejecución actual</label>
              <input
                type="number"
                className="inp"
                value={form.ejecucion}
                onChange={(e) => setForm({ ...form, ejecucion: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="lbl">Estado</label>
              <select
                className="inp"
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
              >
                <option value="Activo">Activo</option>
                <option value="Suspendido">Suspendido</option>
                <option value="Terminado">Terminado</option>
                <option value="Liquidado">Liquidado</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl required">Objeto del subcontrato</label>
              <textarea
                className="inp"
                rows={2}
                value={form.objeto}
                placeholder="Alcance o actividades delegadas al subcontratista..."
                onChange={(e) => setForm({ ...form, objeto: e.target.value })}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl">Relación de soportes y documentos</label>
              <input
                className="inp"
                value={form.documentos}
                placeholder="Contrato firmado, pólizas, habilitaciones..."
                onChange={(e) => setForm({ ...form, documentos: e.target.value })}
              />
            </div>
          </FormGrid>
        </Modal>
      )}
    </Surface>
  );
};
