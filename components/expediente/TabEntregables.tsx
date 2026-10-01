'use client';
import { Input } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, FormGrid, Field } from '../ui/Workspace';
import { useState } from 'react';
import type { Deliverable } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { effDeliv } from '../../lib/metrics';
import { fdate, diffDays, todayIso, parseD, iso, addDays, clamp, monthLabel, monthKey, uid } from '../../lib/format';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const TabEntregables = ({ cid }: { cid: string }) => {
  const [showNewModal, setShowNewModal] = useState(false);
  const [newDeliv, setNewDeliv] = useState({
    nombre: '',
    descripcion: '',
    fechaInicio: todayIso(),
    fechaProg: addDays(todayIso(), 30),
    responsable: ''
  });

  const deliverables = Store.byContract('deliverables', cid) as Deliverable[];

  // Cálculo del Gantt
  let ganttComponent = null;
  if (deliverables.length > 0) {
    const startDates = deliverables.map((d) => d.fechaInicio || d.fechaProg).concat([todayIso()]).sort();
    const minDate = startDates[0];
    const endDates = deliverables
      .map((d) => (d.fechaReal && d.fechaReal > d.fechaProg ? d.fechaReal : d.fechaProg))
      .concat([todayIso()])
      .sort();
    const maxDate = endDates[endDates.length - 1];

    const span = Math.max(1, diffDays(minDate, maxDate) + 10);
    const getX = (dt: string) => clamp((diffDays(minDate, dt) / span) * 100, 0, 100);

    const ticks: string[] = [];
    const d0 = parseD(minDate) || new Date();
    d0.setDate(1);
    d0.setMonth(d0.getMonth() + 1);
    while (iso(d0) <= addDays(minDate, span)) {
      ticks.push(iso(d0));
      d0.setMonth(d0.getMonth() + 1);
    }

    const sorted = deliverables.slice().sort((p, q) =>
      (p.fechaInicio || p.fechaProg) < (q.fechaInicio || q.fechaProg) ? -1 : 1
    );

    const todayX = getX(todayIso());

    ganttComponent = (
      <div className="gantt-wrap mb-4 overflow-x-auto">
        <div className="gantt" style={{ minWidth: 640 }}>
          <div className="gh flex items-center border-b pb-2 mb-2 font-semibold text-xs text-muted-foreground">
            <div className="gl" style={{ width: '32%', minWidth: 180 }}>Entregable</div>
            <div className="gt relative flex-1 h-6">
              {ticks.map((t, idx) => (
                <span
                  key={idx}
                  className="absolute text-xs transform -translate-x-1/2 text-muted-foreground"
                  style={{ left: `${getX(t)}%` }}
                >
                  {monthLabel(monthKey(t))}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-3 relative">
            {sorted.map((d) => {
              const e = effDeliv(d);
              const col =
                e === 'Vencido' || e === 'Rechazado'
                  ? 'var(--crit)'
                  : e === 'Aprobado' || e === 'Entregado'
                  ? 'var(--ok)'
                  : e === 'Suspendido'
                  ? 'var(--na)'
                  : 'var(--brand)';
              const startX = getX(d.fechaInicio || d.fechaProg);
              const widthX = Math.max(2, getX(d.fechaProg) - startX);
              const realX = d.fechaReal ? getX(d.fechaReal) : null;

              return (
                <div key={d.id} className="gr flex items-center text-xs py-1 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded">
                  <div className="gl pr-2 truncate" style={{ width: '32%', minWidth: 180 }} title={d.nombre}>
                    <b className="text-neutral-800 dark:text-neutral-200">{d.nombre}</b>{' '}
                    <span className="text-muted-foreground">({e})</span>
                  </div>
                  <div className="gt relative flex-1 h-6 bg-neutral-100 dark:bg-neutral-900 rounded overflow-hidden">
                    {/* Línea de Hoy */}
                    <div
                      className="today absolute top-0 bottom-0 z-10"
                      style={{
                        left: `${todayX}%`,
                        width: 2,
                        background: 'var(--crit)',
                        boxShadow: '0 0 4px rgba(190,58,46,0.6)'
                      }}
                      title={`Hoy: ${fdate(todayIso())}`}
                    />

                    {/* Barra de entregable */}
                    <div
                      className="gb absolute top-1 bottom-1 rounded z-0 flex items-center overflow-hidden"
                      style={{
                        left: `${startX}%`,
                        width: `${widthX}%`,
                        background: col,
                        opacity: 0.85
                      }}
                      title={`${d.nombre} (${fdate(d.fechaInicio)} → ${fdate(d.fechaProg)}) Avance: ${d.avance || 0}%`}
                    >
                      <i
                        style={{
                          display: 'block',
                          width: `${clamp(Number(d.avance || 0), 0, 100)}%`,
                          height: '100%',
                          background: 'rgba(255,255,255,0.4)'
                        }}
                      />
                    </div>

                    {/* Marcador de entrega real */}
                    {realX != null && (
                      <div
                        className="gm absolute top-0 bottom-0 z-20"
                        style={{
                          left: `${realX}%`,
                          width: 4,
                          background: '#17262B',
                          borderRadius: 1
                        }}
                        title={`Entrega real: ${fdate(d.fechaReal)}`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="legend mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground items-center">
          <span className="flex items-center gap-1">
            <span className="sem" style={{ background: 'var(--brand)' }}></span> En curso
          </span>
          <span className="flex items-center gap-1">
            <span className="sem ok"></span> Entregado / aprobado
          </span>
          <span className="flex items-center gap-1">
            <span className="sem crit"></span> Vencido / rechazado
          </span>
          <span className="flex items-center gap-1 text-red-600 font-medium">
            <span style={{ color: 'var(--crit)', fontWeight: 'bold' }}>┆</span> Línea de hoy
          </span>
          <span className="flex items-center gap-1">
            <span style={{ display: 'inline-block', width: 6, height: 10, background: '#17262B' }}></span> Entrega real
          </span>
        </div>
      </div>
    );
  }

  const handleCreate = () => {
    if (!AuthService.guard('crear')) return;
    if (!newDeliv.nombre) return notify('Ingrese el nombre del entregable');

    const u = AuthService.currentUser();
    const dObj: Deliverable = {
      id: uid('EN'),
      contractId: cid,
      nombre: newDeliv.nombre,
      descripcion: newDeliv.descripcion,
      fechaInicio: newDeliv.fechaInicio,
      fechaProg: newDeliv.fechaProg,
      responsable: newDeliv.responsable || u.nombre,
      estado: 'Pendiente',
      avance: 0
    };

    Store.insert('deliverables', dObj);
    Audit.log({
      contractId: cid,
      modulo: 'Entregables',
      accion: 'Creación',
      campo: 'Entregable',
      nuevo: newDeliv.nombre
    });
    setShowNewModal(false);
  };

  return (
    <div>
      <div className="panel-h mb-3">
        <div>
          <h3>Entregables y Cronograma (Gantt)</h3>
          <span className="sub">{deliverables.length} entregables registrados</span>
        </div>
        <div className="row-flex">
          <Button className="btn sm pri" onClick={() => setShowNewModal(true)}>
            <Icon name="plus" /> Nuevo entregable
          </Button>
        </div>
      </div>

      <Surface className="panel mb-4">
        <div className="panel-h">
          <h3>Cronograma de Ejecución (Gantt)</h3>
        </div>
        <div className="panel-b">
          {ganttComponent || <div className="empty">No hay entregables para diagramar en el Gantt.</div>}
        </div>
      </Surface>

      <Surface className="panel">
        <TableViewport className="tbl-wrap">
          <DataTable className="tbl">
            <thead>
              <tr>
                <th>Entregable</th>
                <th>Inicio planificado</th>
                <th>Fecha programada</th>
                <th>Fecha real</th>
                <th>Estado</th>
                <th>% Avance</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>
              {deliverables.map((d) => {
                const eff = effDeliv(d);
                return (
                  <tr key={d.id}>
                    <td>
                      <b>{d.nombre}</b>
                      {d.descripcion && <div className="small muted">{d.descripcion}</div>}
                    </td>
                    <td>{fdate(d.fechaInicio)}</td>
                    <td>{fdate(d.fechaProg)}</td>
                    <td>{fdate(d.fechaReal) || '—'}</td>
                    <td>
                      <Badge text={eff} />
                    </td>
                    <td style={{ minWidth: 100 }}>
                      <div className="pbar">
                        <div className="bar">
                          <i
                            style={{
                              width: `${d.avance || 0}%`,
                              background: d.avance === 100 ? 'var(--ok)' : 'var(--brand)'
                            }}
                          />
                        </div>
                        <span className="small">{d.avance || 0}%</span>
                      </div>
                    </td>
                    <td>{d.responsable || '—'}</td>
                  </tr>
                );
              })}
              {deliverables.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    Sin entregables registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </TableViewport>
      </Surface>

      {showNewModal && (
        <Modal
          title="Nuevo entregable contractual"
          onClose={() => setShowNewModal(false)}
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button className="btn ghost" onClick={() => setShowNewModal(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleCreate}>
                Guardar Entregable
              </Button>
            </div>
          }
        >
          <FormGrid className="form-grid">
            <Field className="f span2">
              <label className="req">Nombre del entregable</label>
              <Input
                value={newDeliv.nombre}
                onChange={(e) => setNewDeliv({ ...newDeliv, nombre: e.target.value })}
                placeholder="Ej. Informe técnico de avance"
              />
            </Field>
            <Field className="f span2">
              <label>Descripción / Criterio de aceptación</label>
              <Input
                value={newDeliv.descripcion}
                onChange={(e) => setNewDeliv({ ...newDeliv, descripcion: e.target.value })}
              />
            </Field>
            <Field className="f">
              <label className="req">Fecha de inicio</label>
              <Input
                type="date"
                value={newDeliv.fechaInicio}
                onChange={(e) => setNewDeliv({ ...newDeliv, fechaInicio: e.target.value })}
              />
            </Field>
            <Field className="f">
              <label className="req">Fecha programada</label>
              <Input
                type="date"
                value={newDeliv.fechaProg}
                onChange={(e) => setNewDeliv({ ...newDeliv, fechaProg: e.target.value })}
              />
            </Field>
            <Field className="f span2">
              <label>Responsable</label>
              <Input
                value={newDeliv.responsable}
                onChange={(e) => setNewDeliv({ ...newDeliv, responsable: e.target.value })}
                placeholder="Nombre del responsable"
              />
            </Field>
          </FormGrid>
        </Modal>
      )}
    </div>
  );
};
