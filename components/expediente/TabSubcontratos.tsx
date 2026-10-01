'use client';

import { useState } from 'react';
import { PBar } from '../ui/PBar';
import { Input, Select, Textarea } from '../ui/Controls';
import { notify, confirmAction } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, FormGrid, Field, EmptyState } from '../ui/Workspace';
import type { Subcontract, Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { M } from '../../lib/metrics';
import { money, moneyM, pct, fdate, todayIso, uid, sum } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const TabSubcontratos = ({ cid }: { cid: string }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingSub, setEditingSub] = useState<Subcontract | null>(null);

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
  if (!c) {
    return (
      <EmptyState
        title="Contrato no encontrado"
        description="No se encontró el contrato especificado en la base de datos."
      />
    );
  }

  const m = M(c);
  const subcontracts = (Store.byContract('subcontracts', cid) as Subcontract[]).sort((a, b) =>
    (a.fechaInicio || '') < (b.fechaInicio || '') ? -1 : 1
  );

  const sv = sum(subcontracts, (s) => Number(s.valor) || 0);
  const pctOfContract = m.valorActual ? (sv / m.valorActual) * 100 : 0;
  const company = Store.get('companies', c.companyId);

  // Estadísticas KPI
  const totalSubs = subcontracts.length;
  const activosSubs = subcontracts.filter((s) => s.estado === 'Activo').length;
  const ejecucionPromedio = totalSubs > 0
    ? subcontracts.reduce((acc, s) => acc + (Number(s.ejecucion) || 0), 0) / totalSubs
    : 0;

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
    if (!form.valor || Number(form.valor) <= 0) return notify('Ingrese un valor válido mayor a cero');

    const newSub: Subcontract = {
      id: uid('SC'),
      contractId: cid,
      numero: form.numero.trim(),
      contratista: form.contratista.trim(),
      nit: form.nit.trim(),
      objeto: form.objeto.trim() || 'Sin objeto especificado',
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

    notify(`Subcontrato ${newSub.numero} registrado con éxito`);
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

  const handleUpdate = () => {
    if (!AuthService.guard('editar')) return;
    if (!editingSub) return;
    if (!editingSub.numero.trim()) return notify('El número de subcontrato es requerido');
    if (!editingSub.contratista.trim()) return notify('El nombre del contratista es requerido');

    Store.update('subcontracts', editingSub.id, {
      numero: editingSub.numero.trim(),
      contratista: editingSub.contratista.trim(),
      nit: editingSub.nit.trim(),
      objeto: editingSub.objeto.trim(),
      valor: Number(editingSub.valor) || 0,
      fechaInicio: editingSub.fechaInicio,
      fechaFin: editingSub.fechaFin,
      ejecucion: Number(editingSub.ejecucion) || 0,
      estado: editingSub.estado,
      responsable: editingSub.responsable?.trim(),
      documentos: editingSub.documentos
    });

    Audit.log({
      contractId: cid,
      modulo: 'Subcontratos',
      accion: 'Edición',
      campo: 'Subcontrato ' + editingSub.numero,
      nuevo: `${editingSub.estado} · ${money(editingSub.valor)}`
    });

    notify(`Subcontrato ${editingSub.numero} actualizado`);
    setEditingSub(null);
  };

  const handleDelete = async (s: Subcontract) => {
    if (!AuthService.guard('editar')) return;
    const ok = await confirmAction(`¿Está seguro de eliminar el subcontrato ${s.numero} (${s.contratista})? Esta acción no se puede deshacer.`);
    if (!ok) return;

    const db = Store.getDB();
    db.subcontracts = (db.subcontracts || []).filter((item) => item.id !== s.id);
    Store.persist();
    Audit.log({
      contractId: cid,
      modulo: 'Subcontratos',
      accion: 'Eliminación',
      campo: 'Subcontrato ' + s.numero,
      anterior: `${s.contratista} · ${money(s.valor)}`
    });
    notify(`Subcontrato ${s.numero} eliminado`);
  };

  return (
    <div className="tab-subcontratos-container">
      {/* Encabezado */}
      <div className="panel-h mb-3 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-[var(--ink)]">Estructura de subcontratación y delegación</h3>
          <span className="sub text-xs text-[var(--muted)]">
            Registro de subcontratos derivados, autorizaciones de delegación y porcentaje de tercerización
          </span>
        </div>
        <div className="row-flex">
          <div className="exp-actions">
            <Button className="btn sm" onClick={() => handleExport('xlsx')} title="Exportar a Excel" aria-label="Exportar Excel">
              <Icon name="file-excel" /> Excel
            </Button>
            <Button className="btn sm" onClick={() => handleExport('pdf')} title="Exportar a PDF" aria-label="Exportar PDF">
              <Icon name="file-pdf" /> PDF
            </Button>
            <Button className="btn sm" onClick={() => handleExport('csv')} title="Exportar a CSV" aria-label="Exportar CSV">
              <Icon name="file-csv" /> CSV
            </Button>
          </div>
          <Button className="btn sm pri" onClick={() => setShowModal(true)} aria-label="Crear nuevo subcontrato">
            <Icon name="plus" /> Nuevo subcontrato
          </Button>
        </div>
      </div>

      {/* Tarjetas KPI canónicas */}
      <div className="kpis mb [&_.kpi]:!p-2 sm:[&_.kpi]:!p-[14px_16px] [&_.kpi-ic]:!w-7 [&_.kpi-ic]:!h-7 sm:[&_.kpi-ic]:!w-[34px] sm:[&_.kpi-ic]:!h-[34px] [&_.kpi.kpi-v2]:!gap-2 sm:[&_.kpi.kpi-v2]:!gap-3 [&_.kpi-v]:!whitespace-nowrap [&_.kpi-v]:!text-[13.5px] sm:[&_.kpi-v]:!text-[23px] [&_.kpi-s]:!whitespace-nowrap [&_.kpi-s]:!text-[9.5px] sm:[&_.kpi-s]:!text-[11.5px]">
        <Kpi
          label="Total subcontratos"
          value={totalSubs}
          sub="Empresas delegadas"
          color="brand"
          icon="diagram-project"
        />
        <Kpi
          label="Valor subcontratado"
          value={moneyM(sv).replace(/\s/g, '\u00A0')}
          sub={money(sv).replace(/\s/g, '\u00A0')}
          color="info"
          icon="wallet"
        />
        <Kpi
          label="% del contrato principal"
          value={pct(pctOfContract)}
          sub={pctOfContract > 50 ? 'Alerta: Tercerización > 50%' : 'Nivel autorizado'}
          color={pctOfContract > 50 ? 'warn' : 'ok'}
          icon="pie-chart"
        />
        <Kpi
          label="Subcontratos activos"
          value={activosSubs}
          sub={`${totalSubs - activosSubs} inactivos`}
          color="ok"
          icon="check-circle"
        />
        <Kpi
          label="Ejecución promedio"
          value={pct(ejecucionPromedio, 0)}
          sub="Avance de obras/servicios"
          color="info"
          icon="percent"
        />
      </div>

      {/* Árbol Jerárquico Visual */}
      <Surface className="panel mb-4 overflow-hidden">
        <div className="panel-h">
          <h3 className="font-semibold text-sm">Cadena de contratación y delegación</h3>
        </div>
        <div className="p-4" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
          <div className="tree">
            <ul className="space-y-2">
              <li>
                <span className="node co inline-flex items-center gap-2 p-2.5 rounded border bg-[var(--surface)] shadow-xs" style={{ borderColor: 'var(--line)' }}>
                  <Icon name="building" style={{ color: 'var(--brand)' }} />
                  <span>
                    <b className="text-[var(--ink)] block">{company?.razon || 'Empresa Contratante'}</b>
                    <span className="m text-xs text-[var(--muted)]">NIT {company?.nit || '—'} · Contratante principal</span>
                  </span>
                </span>
                <ul className="pl-6 mt-2 border-l-2 border-[var(--line)] space-y-2">
                  <li>
                    <span className="node inline-flex items-center gap-2 p-2.5 rounded border bg-[var(--surface)] shadow-xs" style={{ borderColor: 'var(--line)' }}>
                      <Icon name="file-contract" style={{ color: 'var(--brand-2)' }} />
                      <span>
                        <b className="text-[var(--ink)] block">{c.numero} · {c.contratista}</b>
                        <span className="m text-xs text-[var(--muted)]">
                          <span className="whitespace-nowrap font-medium">{moneyM(m.valorActual)}</span> · {m.estado} · {totalSubs} subcontrato(s) registrado(s)
                        </span>
                      </span>
                    </span>
                    {totalSubs > 0 && (
                      <ul className="pl-6 mt-2 border-l-2 border-[var(--line)] space-y-2">
                        {subcontracts.map((s) => (
                          <li key={s.id}>
                            <span className="node inline-flex items-center gap-2 p-2 rounded border bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors" style={{ borderColor: 'var(--line)' }}>
                              <Icon name="diagram-project" style={{ color: 'var(--brand-3)' }} />
                              <span>
                                <b className="text-[var(--ink)] text-xs block">{s.numero} · {s.contratista}</b>
                                <span className="m text-[11px] text-[var(--muted)]">
                                  <span className="whitespace-nowrap font-medium">{moneyM(s.valor)}</span> · <span className="font-medium">{s.estado}</span> · {pct(Number(s.ejecucion) || 0)} ejecutado · Vence {fdate(s.fechaFin)}
                                </span>
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
      </Surface>

      {/* Tabla detallada de Subcontratos */}
      <Surface className="panel">
        <div className="panel-h flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Registro detallado de subcontratistas</h3>
            <span className="sub text-xs text-[var(--muted)]">{totalSubs} subcontrato(s)</span>
          </div>
        </div>

        {subcontracts.length === 0 ? (
          <EmptyState
            title="Sin subcontratos registrados"
            description="El contrato principal no registra subcontratos ni cesiones parciales de actividades."
            action={
              <Button className="btn pri sm" onClick={() => setShowModal(true)}>
                <Icon name="plus" /> Registrar primer subcontrato
              </Button>
            }
          />
        ) : (
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
                  <th className="nw text-right" style={{ width: '120px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {subcontracts.map((s) => (
                  <tr key={s.id} className="hover:bg-[var(--surface-2)] transition-colors">
                    <td className="nw">
                      <b className="text-[var(--ink)]">{s.numero}</b>
                    </td>
                    <td className="clip" style={{ maxWidth: '200px' }} title={s.contratista}>
                      <span className="font-medium text-[var(--ink)]">{s.contratista}</span>
                    </td>
                    <td className="nw text-xs font-mono text-[var(--muted)]">{s.nit}</td>
                    <td className="clip" style={{ maxWidth: '240px' }} title={s.objeto}>
                      <span className="text-xs text-[var(--ink-2)] line-clamp-1">{s.objeto}</span>
                    </td>
                    <td className="nw num font-semibold text-[var(--ink)]">{money(s.valor)}</td>
                    <td className="nw text-xs text-[var(--muted)]">{fdate(s.fechaInicio)}</td>
                    <td className="nw text-xs text-[var(--muted)]">{fdate(s.fechaFin)}</td>
                    <td className="nw">
                      <PBar value={Number(s.ejecucion) || 0} />
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
                    <td className="text-xs text-[var(--ink-2)]">{s.responsable || '—'}</td>
                    <td className="nw text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <Button
                          className="btn ghost xs"
                          onClick={() => setEditingSub(s)}
                          title="Editar subcontrato"
                          aria-label={`Editar subcontrato ${s.numero}`}
                        >
                          <Icon name="pencil" size={13} />
                        </Button>
                        <Button
                          className="btn ghost xs text-[var(--crit)] hover:bg-[var(--crit-bg)]"
                          onClick={() => handleDelete(s)}
                          title="Eliminar subcontrato"
                          aria-label={`Eliminar subcontrato ${s.numero}`}
                        >
                          <Icon name="trash" size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableViewport>
        )}
      </Surface>

      {/* Modal Nuevo Subcontrato */}
      {showModal && (
        <Modal
          title="Nuevo subcontrato derivado"
          onClose={() => setShowModal(false)}
          size="lg"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button className="btn ghost" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleCreate}>
                <Icon name="check" /> Guardar Subcontrato
              </Button>
            </div>
          }
        >
          <FormGrid className="form-grid">
            <Field className="f">
              <label className="req font-medium text-xs">Número de subcontrato</label>
              <Input
                value={form.numero}
                placeholder="Ej. SC-001 o SUB-2026-01"
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
                required
              />
            </Field>
            <Field className="f">
              <label className="req font-medium text-xs">Nombre o Razón Social del subcontratista</label>
              <Input
                value={form.contratista}
                placeholder="Nombre de la empresa subcontratada"
                onChange={(e) => setForm({ ...form, contratista: e.target.value })}
                required
              />
            </Field>
            <Field className="f">
              <label className="req font-medium text-xs">NIT / Identificación tributaria</label>
              <Input
                value={form.nit}
                placeholder="900.000.000-0"
                onChange={(e) => setForm({ ...form, nit: e.target.value })}
                required
              />
            </Field>
            <Field className="f">
              <label className="req font-medium text-xs">Valor del subcontrato (COP)</label>
              <Input
                type="number"
                min="0"
                step="1000"
                value={form.valor || ''}
                onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })}
                required
              />
            </Field>
            <Field className="f">
              <label className="req font-medium text-xs">Fecha de inicio</label>
              <Input
                type="date"
                value={form.fechaInicio}
                onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
                required
              />
            </Field>
            <Field className="f">
              <label className="req font-medium text-xs">Fecha de terminación</label>
              <Input
                type="date"
                value={form.fechaFin}
                onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
                required
              />
            </Field>
            <Field className="f">
              <label className="font-medium text-xs">% Ejecución actual (0-100)</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={form.ejecucion || ''}
                onChange={(e) => setForm({ ...form, ejecucion: Number(e.target.value) })}
              />
            </Field>
            <Field className="f">
              <label className="font-medium text-xs">Estado operativo</label>
              <Select
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
              >
                <option value="Activo">Activo</option>
                <option value="Suspendido">Suspendido</option>
                <option value="Terminado">Terminado</option>
                <option value="Liquidado">Liquidado</option>
              </Select>
            </Field>
            <Field className="f span2">
              <label className="req font-medium text-xs">Objeto específico del subcontrato</label>
              <Textarea
                rows={2}
                value={form.objeto}
                placeholder="Alcance, labores o actividades delegadas formalmente..."
                onChange={(e) => setForm({ ...form, objeto: e.target.value })}
                required
              />
            </Field>
            <Field className="f span2">
              <label className="font-medium text-xs">Soportes, pólizas y documentos radicados</label>
              <Input
                value={form.documentos}
                placeholder="Ej. Contrato suscrito, ARL, póliza de cumplimiento..."
                onChange={(e) => setForm({ ...form, documentos: e.target.value })}
              />
            </Field>
          </FormGrid>
        </Modal>
      )}

      {/* Modal Editar Subcontrato */}
      {editingSub && (
        <Modal
          title={`Editar subcontrato · ${editingSub.numero}`}
          onClose={() => setEditingSub(null)}
          size="lg"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button className="btn ghost" onClick={() => setEditingSub(null)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleUpdate}>
                <Icon name="check" /> Guardar Cambios
              </Button>
            </div>
          }
        >
          <FormGrid className="form-grid">
            <Field className="f">
              <label className="req font-medium text-xs">Número de subcontrato</label>
              <Input
                value={editingSub.numero}
                onChange={(e) => setEditingSub({ ...editingSub, numero: e.target.value })}
                required
              />
            </Field>
            <Field className="f">
              <label className="req font-medium text-xs">Subcontratista</label>
              <Input
                value={editingSub.contratista}
                onChange={(e) => setEditingSub({ ...editingSub, contratista: e.target.value })}
                required
              />
            </Field>
            <Field className="f">
              <label className="req font-medium text-xs">NIT</label>
              <Input
                value={editingSub.nit}
                onChange={(e) => setEditingSub({ ...editingSub, nit: e.target.value })}
                required
              />
            </Field>
            <Field className="f">
              <label className="req font-medium text-xs">Valor (COP)</label>
              <Input
                type="number"
                min="0"
                step="1000"
                value={editingSub.valor || ''}
                onChange={(e) => setEditingSub({ ...editingSub, valor: Number(e.target.value) })}
                required
              />
            </Field>
            <Field className="f">
              <label className="req font-medium text-xs">Fecha inicio</label>
              <Input
                type="date"
                value={editingSub.fechaInicio}
                onChange={(e) => setEditingSub({ ...editingSub, fechaInicio: e.target.value })}
                required
              />
            </Field>
            <Field className="f">
              <label className="req font-medium text-xs">Fecha terminación</label>
              <Input
                type="date"
                value={editingSub.fechaFin}
                onChange={(e) => setEditingSub({ ...editingSub, fechaFin: e.target.value })}
                required
              />
            </Field>
            <Field className="f">
              <label className="font-medium text-xs">% Ejecución (0-100)</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={editingSub.ejecucion || ''}
                onChange={(e) => setEditingSub({ ...editingSub, ejecucion: Number(e.target.value) })}
              />
            </Field>
            <Field className="f">
              <label className="font-medium text-xs">Estado</label>
              <Select
                value={editingSub.estado}
                onChange={(e) => setEditingSub({ ...editingSub, estado: e.target.value })}
              >
                <option value="Activo">Activo</option>
                <option value="Suspendido">Suspendido</option>
                <option value="Terminado">Terminado</option>
                <option value="Liquidado">Liquidado</option>
              </Select>
            </Field>
            <Field className="f span2">
              <label className="req font-medium text-xs">Objeto</label>
              <Textarea
                rows={2}
                value={editingSub.objeto}
                onChange={(e) => setEditingSub({ ...editingSub, objeto: e.target.value })}
                required
              />
            </Field>
            <Field className="f span2">
              <label className="font-medium text-xs">Documentos de soporte</label>
              <Input
                value={editingSub.documentos || ''}
                onChange={(e) => setEditingSub({ ...editingSub, documentos: e.target.value })}
              />
            </Field>
          </FormGrid>
        </Modal>
      )}
    </div>
  );
};
