'use client';
import Link from 'next/link';
import { obligationHref } from '../app/routes';
import { Input, Select, Textarea } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, EmptyState, FormGrid, Field } from '../ui/Workspace';
import { useState } from 'react';
import type { Obligation } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { effOblig } from '../../lib/metrics';
import { fdate, pct, todayIso, sum, uid, diffDays } from '../../lib/format';
import { CAT } from '../../lib/catalog';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

type VistaRapida = 'todas' | 'vencidas' | 'porVencer' | 'sinVerificar';

export const TabObligaciones = ({ cid }: { cid: string }) => {
  const [selectedOb, setSelectedOb] = useState<Obligation | null>(null);
  const [vista, setVista] = useState<VistaRapida>('todas');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm] = useState({
    tipo: 'General',
    descripcion: '',
    responsable: '',
    fechaLimite: todayIso(),
    periodicidad: 'Mensual',
    evidencia: '',
    obs: ''
  });
  const [newComment, setNewComment] = useState('');
  const [newCheckText, setNewCheckText] = useState('');

  const obligations = Store.byContract('obligations', cid) as Obligation[];
  const hoy = todayIso();

  const esVencida = (o: Obligation) => {
    const e = effOblig(o);
    return e === 'Vencida' || e === 'Incumplida';
  };
  const cumplidas = obligations.filter((o) => o.estado === 'Cumplida').length;
  const vencidas = obligations.filter(esVencida).length;
  const porVencer = obligations.filter(
    (o) => !esVencida(o) && o.estado !== 'Cumplida' && o.fechaLimite && diffDays(hoy, o.fechaLimite) <= 15 && diffDays(hoy, o.fechaLimite) >= 0
  ).length;
  const sinVerificar = obligations.filter((o) => o.estado === 'Cumplida' && !o.verificadoPor).length;
  const avgCumpl = obligations.length ? sum(obligations, (o) => Number(o.cumplimiento || 0)) / obligations.length : 0;

  // Vista rápida del prototipo: vencidas/incumplidas · vencen en 15 días · cumplidas sin verificar
  const filtered = obligations.filter((o) => {
    if (vista === 'vencidas') return esVencida(o);
    if (vista === 'porVencer') return !esVencida(o) && o.estado !== 'Cumplida' && o.fechaLimite && diffDays(hoy, o.fechaLimite) <= 15 && diffDays(hoy, o.fechaLimite) >= 0;
    if (vista === 'sinVerificar') return o.estado === 'Cumplida' && !o.verificadoPor;
    return true;
  });

  const handleVerify = (ob: Obligation) => {
    if (!AuthService.guard('aprobar')) return;
    const u = AuthService.currentUser();
    Store.update('obligations', ob.id, {
      estado: 'Cumplida',
      cumplimiento: 100,
      verificadoPor: u.nombre,
      verificadoFecha: todayIso()
    });
    Audit.log({
      contractId: cid,
      modulo: 'Obligaciones',
      accion: 'Aprobación',
      campo: 'Verificación',
      nuevo: `Verificada por ${u.nombre}`
    });
    setSelectedOb(Store.get('obligations', ob.id));
  };

  const handleAddComment = () => {
    if (!selectedOb || !newComment.trim()) return;
    const u = AuthService.currentUser();
    const coms = selectedOb.comentarios || [];
    coms.push({
      id: uid('COM'),
      usuario: u.nombre,
      fecha: todayIso(),
      texto: newComment.trim()
    });
    Store.update('obligations', selectedOb.id, { comentarios: coms });
    setSelectedOb(Store.get('obligations', selectedOb.id));
    setNewComment('');
  };

  const handleAddCheck = () => {
    if (!selectedOb || !newCheckText.trim()) return;
    const chk = selectedOb.checklist || [];
    chk.push({
      id: uid('CHK'),
      texto: newCheckText.trim(),
      listo: false
    });
    Store.update('obligations', selectedOb.id, { checklist: chk });
    setSelectedOb(Store.get('obligations', selectedOb.id));
    setNewCheckText('');
  };

  const handleToggleCheck = (chkId: string) => {
    if (!selectedOb) return;
    const chk = (selectedOb.checklist || []).map((c) =>
      c.id === chkId ? { ...c, listo: !c.listo } : c
    );
    const completed = chk.filter((c) => c.listo).length;
    const newPct = chk.length ? Math.round((completed / chk.length) * 100) : selectedOb.cumplimiento;
    Store.update('obligations', selectedOb.id, { checklist: chk, cumplimiento: newPct });
    setSelectedOb(Store.get('obligations', selectedOb.id));
  };

  const handleCreate = () => {
    if (!AuthService.guard('crear')) return;
    if (!newForm.descripcion.trim()) return notify('Ingrese la descripción de la obligación');
    if (!newForm.responsable.trim()) return notify('Ingrese el responsable');
    if (!newForm.fechaLimite) return notify('Ingrese la fecha límite');

    const nueva: Obligation = {
      id: uid('OB'),
      contractId: cid,
      tipo: newForm.tipo,
      descripcion: newForm.descripcion.trim(),
      responsable: newForm.responsable.trim(),
      fechaLimite: newForm.fechaLimite,
      periodicidad: newForm.periodicidad,
      evidencia: newForm.evidencia,
      obs: newForm.obs,
      estado: 'Pendiente',
      cumplimiento: 0
    };

    Store.insert('obligations', nueva);
    Audit.log({
      contractId: cid,
      modulo: 'Obligaciones',
      accion: 'Creación',
      campo: 'Obligation ' + nueva.id,
      nuevo: nueva.descripcion.slice(0, 80)
    });
    notify('Obligación registrada');
    setShowNewModal(false);
    setNewForm({ tipo: 'General', descripcion: '', responsable: '', fechaLimite: todayIso(), periodicidad: 'Mensual', evidencia: '', obs: '' });
  };

  return (
    <div>
      <div className="panel-h mb-3">
        <div>
          <h3>Obligaciones contractuales</h3>
          <span className="sub">{obligations.length} obligaciones pactadas</span>
        </div>
        <div className="row-flex">
          <Button className="btn sm pri" onClick={() => setShowNewModal(true)}>
            <Icon name="plus" /> Nueva obligación
          </Button>
        </div>
      </div>

      <div className="kpis mb">
        <Kpi label="Total obligaciones" value={obligations.length} color="na" />
        <Kpi label="Cumplidas" value={cumplidas} sem="ok" color={cumplidas ? undefined : 'na'} />
        <Kpi label="Vencidas / incumplidas" value={vencidas} sem={vencidas ? 'crit' : 'ok'} color={vencidas ? undefined : 'na'} />
        <Kpi label="% Cumplimiento promedio" value={pct(avgCumpl)} color="na" />
      </div>

      {/* Vistas rápidas del prototipo */}
      <div className="row-flex px-4 py-2" style={{ gap: '6px', flexWrap: 'wrap' }}>
        <Button className={`btn sm ${vista === 'todas' ? 'pri' : 'ghost'}`} onClick={() => setVista('todas')}>
          Todas ({obligations.length})
        </Button>
        <Button className={`btn sm ${vista === 'vencidas' ? 'pri' : 'ghost'}`} onClick={() => setVista('vencidas')}>
          Vencidas / incumplidas ({vencidas})
        </Button>
        <Button className={`btn sm ${vista === 'porVencer' ? 'pri' : 'ghost'}`} onClick={() => setVista('porVencer')}>
          Vencen en 15 días ({porVencer})
        </Button>
        <Button className={`btn sm ${vista === 'sinVerificar' ? 'pri' : 'ghost'}`} onClick={() => setVista('sinVerificar')}>
          Cumplidas sin verificar ({sinVerificar})
        </Button>
      </div>

      <Surface className="panel" style={{ paddingTop: 0 }}>
        <TableViewport className="tbl-wrap">
          <DataTable className="tbl">
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Tipo</th>
                <th>Periodicidad</th>
                <th>Fecha límite</th>
                <th>Estado</th>
                <th>Cumplimiento</th>
                <th>Responsable</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const eff = effOblig(o);
                const compl = Number(o.cumplimiento || 0);
                return (
                  <tr key={o.id}>
                    <td>
                      <Link className="link font-medium cursor-pointer" href={obligationHref(o.id)}>
                        {o.descripcion}
                      </Link>
                      {o.evidencia && (
                        <div className="small muted flex items-center gap-1 mt-1">
                          <Icon name="file-text" /> {o.evidencia}
                        </div>
                      )}
                    </td>
                    <td><span className="badge b-info">{o.tipo}</span></td>
                    <td>{o.periodicidad || '—'}</td>
                    <td>{fdate(o.fechaLimite)}</td>
                    <td>
                      <Badge text={eff} />
                    </td>
                    <td style={{ minWidth: 120 }}>
                      <div className="pbar">
                        <div className="bar">
                          <i
                            style={{
                              width: `${compl}%`,
                              background: compl >= 100 ? 'var(--ok)' : compl >= 50 ? 'var(--warn)' : 'var(--crit)'
                            }}
                          />
                        </div>
                        <span className="small mono">{compl}%</span>
                      </div>
                    </td>
                    <td>{o.responsable}</td>
                    <td>
                      <div className="acts">
                        <Button
                          className="btn xs ghost"
                          onClick={() => setSelectedOb(o)}
                          title="Ver ficha de obligación"
                        >
                          <Icon name="eye" /> Ficha
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty">
                    {vista === 'todas'
                      ? 'No hay obligaciones registradas para este contrato.'
                      : 'No hay obligaciones que coincidan con esta vista rápida.'}
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </TableViewport>
      </Surface>

      {obligations.length === 0 && (
        <EmptyState
          title="Sin obligaciones registradas"
          description="Registra las obligaciones pactadas para hacer seguimiento de su cumplimiento."
          action={
            <Button className="btn sm pri" onClick={() => setShowNewModal(true)}>
              <Icon name="plus" /> Registrar primera obligación
            </Button>
          }
        />
      )}

      {/* Modal Nueva Obligación */}
      {showNewModal && (
        <Modal
          title="Nueva obligación contractual"
          onClose={() => setShowNewModal(false)}
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button className="btn ghost" onClick={() => setShowNewModal(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleCreate}>
                <Icon name="save" /> Registrar obligación
              </Button>
            </div>
          }
        >
          <FormGrid className="form-grid">
            <Field className="f span2">
              <label className="req">Descripción de la obligación</label>
              <Textarea
                rows={2}
                value={newForm.descripcion}
                onChange={(e) => setNewForm({ ...newForm, descripcion: e.target.value })}
                placeholder="Detalle pactado en el contrato..."
              />
            </Field>
            <Field className="f">
              <label>Tipo</label>
              <Select value={newForm.tipo} onChange={(e) => setNewForm({ ...newForm, tipo: e.target.value })}>
                {CAT('tiposObligacion').map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field className="f">
              <label>Periodicidad</label>
              <Select value={newForm.periodicidad} onChange={(e) => setNewForm({ ...newForm, periodicidad: e.target.value })}>
                {['Única', 'Semanal', 'Quincenal', 'Mensual', 'Trimestral', 'Semestral', 'Anual', 'Por entrega', 'Permanente'].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
            <Field className="f">
              <label className="req">Responsable</label>
              <Input
                value={newForm.responsable}
                onChange={(e) => setNewForm({ ...newForm, responsable: e.target.value })}
                placeholder="Nombre del responsable"
              />
            </Field>
            <Field className="f">
              <label className="req">Fecha límite</label>
              <Input
                type="date"
                value={newForm.fechaLimite}
                onChange={(e) => setNewForm({ ...newForm, fechaLimite: e.target.value })}
              />
            </Field>
            <Field className="f">
              <label>Evidencia requerida</label>
              <Input
                value={newForm.evidencia}
                onChange={(e) => setNewForm({ ...newForm, evidencia: e.target.value })}
                placeholder="Ej. Certificado de cumplimiento"
              />
            </Field>
            <Field className="f">
              <label>Observaciones</label>
              <Input
                value={newForm.obs}
                onChange={(e) => setNewForm({ ...newForm, obs: e.target.value })}
                placeholder="Notas adicionales..."
              />
            </Field>
          </FormGrid>
        </Modal>
      )}

      {/* Modal Ficha de Obligación */}
      {selectedOb && (
        <Modal
          title={`Ficha de obligación · ${selectedOb.id}`}
          size="lg"
          onClose={() => setSelectedOb(null)}
          footer={
            <div className="flex gap-2 justify-between w-full items-center">
              <div>
                {selectedOb.verificadoPor && (
                  <span className="text-xs text-green-700 dark:text-green-400 font-medium">
                    ✓ Verificada por {selectedOb.verificadoPor} el {fdate(selectedOb.verificadoFecha)}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button className="btn ghost" onClick={() => setSelectedOb(null)}>
                  Cerrar
                </Button>
                {selectedOb.estado !== 'Cumplida' && (
                  <Button className="btn pri" onClick={() => handleVerify(selectedOb)}>
                    <Icon name="check" /> Aprobar y Verificar
                  </Button>
                )}
              </div>
            </div>
          }
        >
          <div className="mb-4">
            <h4 className="font-semibold text-base mb-1">{selectedOb.descripcion}</h4>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
              <span>Tipo: <b>{selectedOb.tipo}</b></span>
              <span>·</span>
              <span>Periodicidad: <b>{selectedOb.periodicidad}</b></span>
              <span>·</span>
              <span>Fecha límite: <b>{fdate(selectedOb.fechaLimite)}</b></span>
              <span>·</span>
              <span>Responsable: <b>{selectedOb.responsable}</b></span>
            </div>
            <div className="pbar mb-4">
              <div className="bar lg">
                <i style={{ width: `${selectedOb.cumplimiento || 0}%`, background: 'var(--brand)' }} />
              </div>
              <span className="mono">{selectedOb.cumplimiento || 0}% completado</span>
            </div>
          </div>

          <div className="grid g2 mb-4">
            {/* Checklist */}
            <Surface className="panel">
              <div className="panel-h">
                <h3>Checklist de cumplimiento</h3>
              </div>
              <div className="panel-b">
                <div className="flex gap-2 mb-3">
                  <Input
                    type="text"
                    value={newCheckText}
                    onChange={(e) => setNewCheckText(e.target.value)}
                    placeholder="Nuevo ítem de verificación..."
                    aria-label="Nuevo ítem de verificación de la obligación"
                    className="flex-1"
                  />
                  <Button className="btn sm pri" onClick={handleAddCheck}>
                    Agregar
                  </Button>
                </div>
                <div className="space-y-2">
                  {(selectedOb.checklist || []).map((item) => (
                    <label
                      key={item.id}
                      className="chk flex items-center gap-2 text-sm p-1 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded cursor-pointer"
                    >
                      <Input
                        type="checkbox"
                        checked={item.listo}
                        onChange={() => handleToggleCheck(item.id)}
                      />
                      <span className={item.listo ? 'line-through text-muted-foreground' : ''}>{item.texto}</span>
                    </label>
                  ))}
                  {(!selectedOb.checklist || selectedOb.checklist.length === 0) && (
                    <div className="empty">No hay ítems en la lista de chequeo.</div>
                  )}
                </div>
              </div>
            </Surface>

            {/* Comentarios y seguimiento */}
            <Surface className="panel">
              <div className="panel-h">
                <h3>Bitácora y Comentarios</h3>
              </div>
              <div className="panel-b">
                <div className="flex gap-2 mb-3">
                  <Input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Registrar observación..."
                    aria-label="Nueva observación de la obligación"
                    className="flex-1"
                  />
                  <Button className="btn sm pri" onClick={handleAddComment}>
                    Comentar
                  </Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(selectedOb.comentarios || []).map((c) => (
                    <div key={c.id} className="p-2 rounded text-xs" style={{ background: 'var(--bg-sub)', border: '1px solid var(--line)' }}>
                      <div className="flex justify-between font-semibold text-muted-foreground mb-1">
                        <span>{c.usuario}</span>
                        <span>{fdate(c.fecha)}</span>
                      </div>
                      <div>{c.texto}</div>
                    </div>
                  ))}
                  {(!selectedOb.comentarios || selectedOb.comentarios.length === 0) && (
                    <div className="empty">Sin comentarios registrados.</div>
                  )}
                </div>
              </div>
            </Surface>
          </div>
        </Modal>
      )}
    </div>
  );
};
