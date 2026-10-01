'use client';
import { Input } from '../ui/Controls';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable } from '../ui/Workspace';
import { useState } from 'react';
import type { Obligation } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { effOblig } from '../../lib/metrics';
import { fdate, pct, todayIso, sum, uid } from '../../lib/format';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const TabObligaciones = ({ cid }: { cid: string }) => {
  const [selectedOb, setSelectedOb] = useState<Obligation | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newCheckText, setNewCheckText] = useState('');

  const obligations = Store.byContract('obligations', cid) as Obligation[];
  const cumplidas = obligations.filter((o) => o.estado === 'Cumplida').length;
  const vencidas = obligations.filter((o) => {
    const e = effOblig(o);
    return e === 'Vencida' || e === 'Incumplida';
  }).length;
  const avgCumpl = obligations.length ? sum(obligations, (o) => Number(o.cumplimiento || 0)) / obligations.length : 0;

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

  return (
    <div>
      <div className="panel-h mb-3">
        <div>
          <h3>Obligaciones contractuales</h3>
          <span className="sub">{obligations.length} obligaciones pactadas</span>
        </div>
      </div>

      <div className="kpis mb">
        <Kpi label="Total obligaciones" value={obligations.length} />
        <Kpi label="Cumplidas" value={cumplidas} sem="ok" />
        <Kpi label="Vencidas / incumplidas" value={vencidas} sem={vencidas ? 'crit' : 'ok'} />
        <Kpi label="% Cumplimiento promedio" value={pct(avgCumpl)} />
      </div>

      <Surface className="panel">
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
              {obligations.map((o) => {
                const eff = effOblig(o);
                const compl = Number(o.cumplimiento || 0);
                return (
                  <tr key={o.id}>
                    <td>
                      <a className="link font-medium cursor-pointer" onClick={() => setSelectedOb(o)}>
                        {o.descripcion}
                      </a>
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
                        <span className="small">{compl}%</span>
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
              {obligations.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty">
                    No hay obligaciones registradas para este contrato.
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </TableViewport>
      </Surface>

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
              <span>{selectedOb.cumplimiento || 0}% completado</span>
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
                    className="flex-1"
                  />
                  <Button className="btn sm pri" onClick={handleAddComment}>
                    Comentar
                  </Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(selectedOb.comentarios || []).map((c) => (
                    <div key={c.id} className="p-2 rounded bg-neutral-50 dark:bg-neutral-900 border text-xs">
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
