'use client';

import { useState } from 'react';
import { Input, Select, Textarea } from '../ui/Controls';
import { notify, confirmAction } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, FormGrid, Field, EmptyState } from '../ui/Workspace';
import type { Deliverable } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { effDeliv } from '../../lib/metrics';
import { fdate, diffDays, todayIso, parseD, iso, addDays, clamp, monthLabel, monthKey, uid, pct } from '../../lib/format';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const TabEntregables = ({ cid }: { cid: string }) => {
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingDeliv, setEditingDeliv] = useState<Deliverable | null>(null);
  const [deliveryModal, setDeliveryModal] = useState<Deliverable | null>(null);

  const [newDeliv, setNewDeliv] = useState({
    nombre: '',
    descripcion: '',
    fechaInicio: todayIso(),
    fechaProg: addDays(todayIso(), 30),
    responsable: ''
  });

  const [deliveryForm, setDeliveryForm] = useState({
    estado: 'Entregado',
    avance: 100,
    fechaReal: todayIso(),
    evidencia: '',
    obs: ''
  });

  const c = Store.get('contracts', cid);
  if (!c) {
    return (
      <EmptyState
        title="Contrato no encontrado"
        description="No se encontró el contrato especificado para consultar sus entregables."
      />
    );
  }

  const deliverables = (Store.byContract('deliverables', cid) as Deliverable[]).sort((a, b) =>
    (a.fechaProg || '') < (b.fechaProg || '') ? -1 : 1
  );

  // Estadísticas KPI de entregables
  const total = deliverables.length;
  const aprobados = deliverables.filter((d) => ['Aprobado', 'Entregado'].includes(effDeliv(d))).length;
  const enCurso = deliverables.filter((d) => ['En proceso', 'Pendiente'].includes(effDeliv(d))).length;
  const vencidos = deliverables.filter((d) => ['Vencido', 'Rechazado'].includes(effDeliv(d))).length;
  const avancePromedio = total > 0
    ? deliverables.reduce((acc, d) => acc + (Number(d.avance) || 0), 0) / total
    : 0;

  // Cálculo del diagrama de Gantt
  let ganttComponent = null;
  if (deliverables.length > 0) {
    const startDates = deliverables.map((d) => d.fechaInicio || d.fechaProg).concat([todayIso()]).sort();
    const minDate = startDates[0];
    const endDates = deliverables
      .map((d) => (d.fechaReal && d.fechaReal > d.fechaProg ? d.fechaReal : d.fechaProg))
      .concat([todayIso()])
      .sort();
    const maxDate = endDates[endDates.length - 1];

    const span = Math.max(1, diffDays(minDate, maxDate) + 12);
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
      <div className="gantt-wrap mb-2 overflow-x-auto">
        <div className="gantt" style={{ minWidth: 680 }}>
          {/* Cabecera del Gantt con meses */}
          <div
            className="gh flex items-center border-b pb-2 mb-3 text-xs font-semibold"
            style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
          >
            <div className="gl font-medium" style={{ width: '32%', minWidth: 200 }}>
              Hito / Entregable
            </div>
            <div className="gt relative flex-1 h-6">
              {ticks.map((t, idx) => (
                <span
                  key={idx}
                  className="absolute text-xs transform -translate-x-1/2"
                  style={{ left: `${getX(t)}%`, color: 'var(--muted)' }}
                >
                  {monthLabel(monthKey(t))}
                </span>
              ))}
            </div>
          </div>

          {/* Filas del Gantt */}
          <div className="space-y-2.5 relative">
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
              const widthX = Math.max(3, getX(d.fechaProg) - startX);
              const realX = d.fechaReal ? getX(d.fechaReal) : null;

              return (
                <div
                  key={d.id}
                  className="gr flex items-center text-xs py-1.5 px-2 rounded hover:bg-[var(--surface-2)] transition-colors"
                >
                  <div className="gl pr-3 truncate" style={{ width: '32%', minWidth: 200 }} title={d.nombre}>
                    <b className="text-[var(--ink)]">{d.nombre}</b>{' '}
                    <span className="text-[var(--muted)] text-[11px]">({e})</span>
                  </div>
                  <div
                    className="gt relative flex-1 h-6 rounded overflow-hidden"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
                  >
                    {/* Línea vertical de Hoy */}
                    <div
                      className="today absolute top-0 bottom-0 z-10"
                      style={{
                        left: `${todayX}%`,
                        width: 2,
                        background: 'var(--crit)',
                        boxShadow: '0 0 5px rgba(220,38,38,0.6)'
                      }}
                      title={`Hoy: ${fdate(todayIso())}`}
                    />

                    {/* Barra de entregable planificado */}
                    <div
                      className="gb absolute top-1 bottom-1 rounded z-0 flex items-center overflow-hidden"
                      style={{
                        left: `${startX}%`,
                        width: `${widthX}%`,
                        background: col,
                        opacity: 0.9
                      }}
                      title={`${d.nombre} (${fdate(d.fechaInicio)} → ${fdate(d.fechaProg)}) · Avance: ${d.avance || 0}%`}
                    >
                      <i
                        style={{
                          display: 'block',
                          width: `${clamp(Number(d.avance || 0), 0, 100)}%`,
                          height: '100%',
                          background: 'rgba(255,255,255,0.45)'
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
                          background: 'var(--ink)',
                          borderRadius: 2
                        }}
                        title={`Fecha de entrega real: ${fdate(d.fechaReal)}`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leyenda interactiva */}
        <div
          className="legend mt-3 pt-2 border-t flex flex-wrap gap-4 text-xs items-center"
          style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="sem" style={{ background: 'var(--brand)' }}></span> En curso
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="sem" style={{ background: 'var(--ok)' }}></span> Aprobado / Entregado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="sem" style={{ background: 'var(--crit)' }}></span> Vencido / Rechazado
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: 'var(--crit-text)' }}>
            <span style={{ color: 'var(--crit)', fontWeight: 'bold' }}>┆</span> Línea del día actual
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span style={{ display: 'inline-block', width: 6, height: 10, background: 'var(--ink)', borderRadius: 1 }}></span> Radicación real
          </span>
        </div>
      </div>
    );
  }

  const handleCreate = () => {
    if (!AuthService.guard('crear')) return;
    if (!newDeliv.nombre.trim()) return notify('Ingrese el nombre del entregable');
    if (!newDeliv.fechaProg) return notify('Ingrese la fecha programada');

    const u = AuthService.currentUser();
    const dObj: Deliverable = {
      id: uid('EN'),
      contractId: cid,
      nombre: newDeliv.nombre.trim(),
      descripcion: newDeliv.descripcion.trim(),
      fechaInicio: newDeliv.fechaInicio,
      fechaProg: newDeliv.fechaProg,
      responsable: newDeliv.responsable.trim() || c.supervisor || u.nombre,
      estado: 'Pendiente',
      avance: 0
    };

    Store.insert('deliverables', dObj);
    Audit.log({
      contractId: cid,
      modulo: 'Entregables',
      accion: 'Creación',
      campo: 'Entregable ' + dObj.id,
      nuevo: dObj.nombre
    });

    notify(`Entregable "${dObj.nombre}" creado exitosamente`);
    setShowNewModal(false);
    setNewDeliv({
      nombre: '',
      descripcion: '',
      fechaInicio: todayIso(),
      fechaProg: addDays(todayIso(), 30),
      responsable: ''
    });
  };

  const handleOpenDelivery = (d: Deliverable) => {
    setDeliveryModal(d);
    setDeliveryForm({
      estado: d.estado === 'Pendiente' ? 'Entregado' : d.estado,
      avance: Number(d.avance) || (d.estado === 'Aprobado' || d.estado === 'Entregado' ? 100 : 50),
      fechaReal: d.fechaReal || todayIso(),
      evidencia: d.evidencia || '',
      obs: d.obs || ''
    });
  };

  const handleSaveDelivery = () => {
    if (!AuthService.guard('editar')) return;
    if (!deliveryModal) return;

    Store.update('deliverables', deliveryModal.id, {
      estado: deliveryForm.estado,
      avance: Number(deliveryForm.avance) || 0,
      fechaReal: deliveryForm.fechaReal,
      evidencia: deliveryForm.evidencia,
      obs: deliveryForm.obs
    });

    Audit.log({
      contractId: cid,
      modulo: 'Entregables',
      accion: 'Edición',
      campo: 'Estado entregable ' + deliveryModal.nombre,
      anterior: deliveryModal.estado,
      nuevo: `${deliveryForm.estado} (${deliveryForm.avance}%)`
    });

    notify(`Entregable "${deliveryModal.nombre}" actualizado correctamente`);
    setDeliveryModal(null);
  };

  const handleUpdate = () => {
    if (!AuthService.guard('editar')) return;
    if (!editingDeliv) return;
    if (!editingDeliv.nombre.trim()) return notify('El nombre del entregable es requerido');

    Store.update('deliverables', editingDeliv.id, {
      nombre: editingDeliv.nombre.trim(),
      descripcion: editingDeliv.descripcion?.trim(),
      fechaInicio: editingDeliv.fechaInicio,
      fechaProg: editingDeliv.fechaProg,
      responsable: editingDeliv.responsable?.trim()
    });

    Audit.log({
      contractId: cid,
      modulo: 'Entregables',
      accion: 'Edición',
      campo: 'Datos entregable ' + editingDeliv.id,
      nuevo: editingDeliv.nombre
    });

    notify(`Entregable "${editingDeliv.nombre}" actualizado`);
    setEditingDeliv(null);
  };

  const handleDelete = async (d: Deliverable) => {
    if (!AuthService.guard('editar')) return;
    const ok = await confirmAction(`¿Está seguro de eliminar el entregable "${d.nombre}"? Esta acción no se puede deshacer.`);
    if (!ok) return;

    const db = Store.getDB();
    db.deliverables = (db.deliverables || []).filter((item) => item.id !== d.id);
    Store.persist();
    Audit.log({
      contractId: cid,
      modulo: 'Entregables',
      accion: 'Eliminación',
      campo: 'Entregable',
      anterior: d.nombre
    });
    notify(`Entregable "${d.nombre}" eliminado`);
  };

  return (
    <div className="tab-entregables-container">
      {/* Encabezado */}
      <div className="panel-h mb-3 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-[var(--ink)]">Cronograma y entregables del contrato</h3>
          <span className="sub text-xs text-[var(--muted)]">
            Hitos contractuales, seguimiento de fechas límite y radicación de productos
          </span>
        </div>
        <div className="row-flex">
          <Button
            className="btn sm pri"
            onClick={() => setShowNewModal(true)}
            aria-label="Registrar nuevo entregable"
          >
            <Icon name="plus" /> Nuevo entregable
          </Button>
        </div>
      </div>

      {/* KPI Cards con jerarquía y tokens canónicos */}
      <div className="kpis mb [&_.kpi]:!p-2 sm:[&_.kpi]:!p-[14px_16px] [&_.kpi-ic]:!w-7 [&_.kpi-ic]:!h-7 sm:[&_.kpi-ic]:!w-[34px] sm:[&_.kpi-ic]:!h-[34px] [&_.kpi.kpi-v2]:!gap-2 sm:[&_.kpi.kpi-v2]:!gap-3 [&_.kpi-v]:!whitespace-nowrap [&_.kpi-v]:!text-[13.5px] sm:[&_.kpi-v]:!text-[23px] [&_.kpi-s]:!whitespace-nowrap [&_.kpi-s]:!text-[9.5px] sm:[&_.kpi-s]:!text-[11.5px]">
        <Kpi
          label="Total entregables"
          value={total}
          sub="Hitos programados"
          color="brand"
          icon="package"
        />
        <Kpi
          label="Aprobados / Entregados"
          value={aprobados}
          sub={`${total > 0 ? Math.round((aprobados / total) * 100) : 0}% de cumplimiento`}
          color="ok"
          icon="check-circle"
        />
        <Kpi
          label="En curso / Pendientes"
          value={enCurso}
          sub="En proceso de elaboración"
          color="info"
          icon="clock"
        />
        <Kpi
          label="Vencidos / Rechazados"
          value={vencidos}
          sub={vencidos > 0 ? 'Requiere seguimiento' : 'Sin demoras'}
          color={vencidos > 0 ? 'crit' : 'ok'}
          icon="alert-circle"
        />
        <Kpi
          label="Avance ponderado"
          value={pct(avancePromedio, 0)}
          sub="Promedio de entregables"
          color="info"
          icon="percent"
        />
      </div>

      {/* Panel del Gantt */}
      <Surface className="panel mb-4">
        <div className="panel-h">
          <h3 className="font-semibold text-sm">Cronograma de Ejecución y Hitos (Gantt)</h3>
        </div>
        <div className="panel-b">
          {ganttComponent || (
            <EmptyState
              title="Sin cronograma disponible"
              description="No hay entregables registrados para graficar en la línea de tiempo."
            />
          )}
        </div>
      </Surface>

      {/* Tabla detallada de entregables */}
      <Surface className="panel">
        <div className="panel-h flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Matriz de entregables y productos esperados</h3>
            <span className="sub text-xs text-[var(--muted)]">{total} entregable(s) en seguimiento</span>
          </div>
        </div>

        {deliverables.length === 0 ? (
          <EmptyState
            title="Sin entregables registrados"
            description="El expediente no registra hitos ni productos contractuales aún."
            action={
              <Button className="btn pri sm" onClick={() => setShowNewModal(true)}>
                <Icon name="plus" /> Crear primer entregable
              </Button>
            }
          />
        ) : (
          <TableViewport className="tbl-wrap">
            <DataTable className="tbl">
              <thead>
                <tr>
                  <th>Entregable / Criterio</th>
                  <th className="nw">Inicio</th>
                  <th className="nw">Fecha programada</th>
                  <th className="nw">Radicación real</th>
                  <th className="nw">Estado</th>
                  <th className="nw" style={{ minWidth: 120 }}>% Avance</th>
                  <th>Responsable</th>
                  <th className="nw text-right" style={{ width: '130px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {deliverables.map((d) => {
                  const eff = effDeliv(d);
                  return (
                    <tr key={d.id} className="hover:bg-[var(--surface-2)] transition-colors">
                      <td>
                        <b className="text-[var(--ink)] block">{d.nombre}</b>
                        {d.descripcion && <div className="small text-[var(--muted)] line-clamp-1">{d.descripcion}</div>}
                      </td>
                      <td className="nw text-[var(--muted)]">{fdate(d.fechaInicio)}</td>
                      <td className="nw font-medium">{fdate(d.fechaProg)}</td>
                      <td className="nw">
                        {d.fechaReal ? (
                          <span className="text-[var(--ink)] font-medium">{fdate(d.fechaReal)}</span>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="nw">
                        <Badge
                          text={eff}
                          color={
                            eff === 'Aprobado' || eff === 'Entregado'
                              ? 'ok'
                              : eff === 'Vencido' || eff === 'Rechazado'
                              ? 'crit'
                              : eff === 'En proceso'
                              ? 'info'
                              : 'warn'
                          }
                        />
                      </td>
                      <td className="nw">
                        <div className="pbar flex items-center gap-2">
                          <div className="bar flex-1 h-2 rounded bg-[var(--line-2)] overflow-hidden">
                            <i
                              style={{
                                display: 'block',
                                height: '100%',
                                width: `${d.avance || 0}%`,
                                background: d.avance === 100 ? 'var(--ok)' : 'var(--brand)'
                              }}
                            />
                          </div>
                          <span className="small font-mono text-xs">{d.avance || 0}%</span>
                        </div>
                      </td>
                      <td className="text-xs text-[var(--ink-2)]">{d.responsable || '—'}</td>
                      <td className="nw text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          <Button
                            className="btn ghost xs"
                            onClick={() => handleOpenDelivery(d)}
                            title="Registrar avance o radicación"
                            aria-label={`Actualizar avance de ${d.nombre}`}
                          >
                            <Icon name="check-circle" size={13} />
                          </Button>
                          <Button
                            className="btn ghost xs"
                            onClick={() => setEditingDeliv(d)}
                            title="Editar entregable"
                            aria-label={`Editar entregable ${d.nombre}`}
                          >
                            <Icon name="pencil" size={13} />
                          </Button>
                          <Button
                            className="btn ghost xs text-[var(--crit)] hover:bg-[var(--crit-bg)]"
                            onClick={() => handleDelete(d)}
                            title="Eliminar entregable"
                            aria-label={`Eliminar entregable ${d.nombre}`}
                          >
                            <Icon name="trash" size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </TableViewport>
        )}
      </Surface>

      {/* Modal Crear Entregable */}
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
                <Icon name="check" /> Guardar Entregable
              </Button>
            </div>
          }
        >
          <FormGrid className="form-grid">
            <Field className="f span2">
              <label className="req font-medium text-xs">Nombre del entregable / producto</label>
              <Input
                value={newDeliv.nombre}
                onChange={(e) => setNewDeliv({ ...newDeliv, nombre: e.target.value })}
                placeholder="Ej. Informe técnico de interventoría o acta de avance..."
                required
              />
            </Field>
            <Field className="f span2">
              <label className="font-medium text-xs">Descripción / Criterio de aceptación</label>
              <Textarea
                rows={2}
                value={newDeliv.descripcion}
                onChange={(e) => setNewDeliv({ ...newDeliv, descripcion: e.target.value })}
                placeholder="Detalle de condiciones técnicas y formales para aprobación..."
              />
            </Field>
            <Field className="f">
              <label className="req font-medium text-xs">Fecha planificada de inicio</label>
              <Input
                type="date"
                value={newDeliv.fechaInicio}
                onChange={(e) => setNewDeliv({ ...newDeliv, fechaInicio: e.target.value })}
                required
              />
            </Field>
            <Field className="f">
              <label className="req font-medium text-xs">Fecha programada de entrega</label>
              <Input
                type="date"
                value={newDeliv.fechaProg}
                onChange={(e) => setNewDeliv({ ...newDeliv, fechaProg: e.target.value })}
                required
              />
            </Field>
            <Field className="f span2">
              <label className="font-medium text-xs">Responsable de entrega o revisión</label>
              <Input
                value={newDeliv.responsable}
                onChange={(e) => setNewDeliv({ ...newDeliv, responsable: e.target.value })}
                placeholder={c.contratista || 'Nombre del responsable asignado'}
              />
            </Field>
          </FormGrid>
        </Modal>
      )}

      {/* Modal Registrar Avance / Entrega */}
      {deliveryModal && (
        <Modal
          title={`Gestionar entrega · ${deliveryModal.nombre}`}
          onClose={() => setDeliveryModal(null)}
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button className="btn ghost" onClick={() => setDeliveryModal(null)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleSaveDelivery}>
                <Icon name="check" /> Guardar Estado
              </Button>
            </div>
          }
        >
          <FormGrid className="form-grid">
            <Field className="f">
              <label className="req font-medium text-xs">Estado de entrega</label>
              <Select
                value={deliveryForm.estado}
                onChange={(e) => {
                  const est = e.target.value;
                  setDeliveryForm({
                    ...deliveryForm,
                    estado: est,
                    avance: est === 'Aprobado' || est === 'Entregado' ? 100 : deliveryForm.avance
                  });
                }}
              >
                <option value="Pendiente">Pendiente</option>
                <option value="En proceso">En proceso</option>
                <option value="Entregado">Entregado (en revisión)</option>
                <option value="Aprobado">Aprobado a satisfacción</option>
                <option value="Rechazado">Rechazado con observaciones</option>
                <option value="Suspendido">Suspendido</option>
              </Select>
            </Field>
            <Field className="f">
              <label className="req font-medium text-xs">% Avance actual (0-100)</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={deliveryForm.avance}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, avance: Number(e.target.value) })}
                required
              />
            </Field>
            <Field className="f span2">
              <label className="font-medium text-xs">Fecha real de radicación o entrega</label>
              <Input
                type="date"
                value={deliveryForm.fechaReal}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, fechaReal: e.target.value })}
              />
            </Field>
            <Field className="f span2">
              <label className="font-medium text-xs">Radicado / Soporte documental</label>
              <Input
                value={deliveryForm.evidencia}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, evidencia: e.target.value })}
                placeholder="Ej. Radicado interno No. 2026-0982 o enlace a carpeta"
              />
            </Field>
            <Field className="f span2">
              <label className="font-medium text-xs">Observaciones de supervisión</label>
              <Textarea
                rows={2}
                value={deliveryForm.obs}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, obs: e.target.value })}
                placeholder="Observaciones de revisión o condiciones de subsanación..."
              />
            </Field>
          </FormGrid>
        </Modal>
      )}

      {/* Modal Editar Información Básica */}
      {editingDeliv && (
        <Modal
          title={`Editar entregable · ${editingDeliv.nombre}`}
          onClose={() => setEditingDeliv(null)}
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button className="btn ghost" onClick={() => setEditingDeliv(null)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleUpdate}>
                <Icon name="check" /> Guardar Cambios
              </Button>
            </div>
          }
        >
          <FormGrid className="form-grid">
            <Field className="f span2">
              <label className="req font-medium text-xs">Nombre del entregable</label>
              <Input
                value={editingDeliv.nombre}
                onChange={(e) => setEditingDeliv({ ...editingDeliv, nombre: e.target.value })}
                required
              />
            </Field>
            <Field className="f span2">
              <label className="font-medium text-xs">Descripción / Criterio de aceptación</label>
              <Textarea
                rows={2}
                value={editingDeliv.descripcion || ''}
                onChange={(e) => setEditingDeliv({ ...editingDeliv, descripcion: e.target.value })}
              />
            </Field>
            <Field className="f">
              <label className="req font-medium text-xs">Fecha inicio</label>
              <Input
                type="date"
                value={editingDeliv.fechaInicio || ''}
                onChange={(e) => setEditingDeliv({ ...editingDeliv, fechaInicio: e.target.value })}
                required
              />
            </Field>
            <Field className="f">
              <label className="req font-medium text-xs">Fecha programada</label>
              <Input
                type="date"
                value={editingDeliv.fechaProg || ''}
                onChange={(e) => setEditingDeliv({ ...editingDeliv, fechaProg: e.target.value })}
                required
              />
            </Field>
            <Field className="f span2">
              <label className="font-medium text-xs">Responsable</label>
              <Input
                value={editingDeliv.responsable || ''}
                onChange={(e) => setEditingDeliv({ ...editingDeliv, responsable: e.target.value })}
              />
            </Field>
          </FormGrid>
        </Modal>
      )}
    </div>
  );
};
