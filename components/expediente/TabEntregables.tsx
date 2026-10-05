'use client';

import { useState } from 'react';
import { notify, confirmAction } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, EmptyState } from '../ui/Workspace';
import type { Deliverable } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { effDeliv } from '../../lib/metrics';
import { fdate, diffDays, todayIso, parseD, iso, addDays, clamp, monthLabel, monthKey, pct } from '../../lib/format';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Icon } from '../icons';
import Link from 'next/link';
import { nuevoHref, editarHref, editarEnHref } from './routes';

export const TabEntregables = ({ cid }: { cid: string }) => {
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
          <Link
            className="btn sm pri"
            href={nuevoHref(cid, 'entregables')}
            aria-label="Registrar nuevo entregable"
          >
            <Icon name="plus" /> Nuevo entregable
          </Link>
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
              action={
                <Link className="btn pri sm" href={nuevoHref(cid, 'entregables')}>
                  <Icon name="plus" /> Crear primer entregable
                </Link>
              }
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
              <Link className="btn pri sm" href={nuevoHref(cid, 'entregables')}>
                <Icon name="plus" /> Crear primer entregable
              </Link>
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
                          <Link
                            className="btn ghost xs"
                            href={editarEnHref(cid, 'entregables', d.id, 'entrega/editar')}
                            title="Registrar avance o radicación"
                            aria-label={`Actualizar avance de ${d.nombre}`}
                          >
                            <Icon name="check-circle" size={13} />
                          </Link>
                          <Link
                            className="btn ghost xs"
                            href={editarHref(cid, 'entregables', d.id)}
                            title="Editar entregable"
                            aria-label={`Editar entregable ${d.nombre}`}
                          >
                            <Icon name="pencil" size={13} />
                          </Link>
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

    </div>
  );
};
