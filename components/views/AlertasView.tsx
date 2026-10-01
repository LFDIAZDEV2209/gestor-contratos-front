'use client';
import { Select, Input, Textarea } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, FormGrid, EmptyState, Field } from '../ui/Workspace';
import Link from 'next/link';
import { contractHref } from '../app/routes';

import React, { useState } from 'react';
import { Alerts, NotificationService } from '@/lib/alerts';
import { Store, AuthService, Audit } from '@/lib/store';
import { fdate, diffDays, todayIso, addDays, nowStamp, uid } from '@/lib/format';
import { exportRows } from '@/lib/export';
import { ALV } from '@/lib/catalog';
import { Icon } from '../icons';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import type { Alert, Task, User } from '@/lib/types';

interface AlertasViewProps {
  onSelectContract?: (contractId: string, tab?: string) => void;
  initialNivel?: string;
}

/* ---------- Presentación local (2ª pasada): badges pill con tokens y pop al montar ---------- */
const badgePop = { animation: 'pop 250ms var(--ease)' } as const;
const countPill = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  padding: '2px 8px',
  borderRadius: 'var(--r-pill)',
  background: 'rgba(255, 255, 255, 0.18)',
  color: 'var(--surface)',
  whiteSpace: 'nowrap' as const
};

// Desplazamiento suave a un panel de la vista (respeta prefers-reduced-motion)
const scrollToPanel = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
};

export const AlertasView: React.FC<AlertasViewProps> = ({ onSelectContract, initialNivel = '' }) => {
  const [nivelFilter, setNivelFilter] = useState<string>(initialNivel);
  const [estadoFilter, setEstadoFilter] = useState<string>('abiertas');
  const [visibleCount, setVisibleCount] = useState(20);
  const [tick, setTick] = useState(0);

  // Modales
  const [resolveAlert, setResolveAlert] = useState<Alert | null>(null);
  const [resolveNote, setResolveNote] = useState('');

  const [delegateAlert, setDelegateAlert] = useState<Alert | null>(null);
  const [delegateUser, setDelegateUser] = useState('');

  const [taskAlert, setTaskAlert] = useState<Alert | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');

  const refresh = () => setTick((t) => t + 1);

  const allAlerts = Alerts.compute();
  const openAlerts = allAlerts.filter((a) => a.estado !== 'Resuelta');
  const nuevasCount = allAlerts.filter((a) => a.estado === 'Nueva').length;
  const users: User[] = Store.all('users');
  const db = Store.getDB();
  const tasks: Task[] = (db.tasks || []).slice().sort((a, b) => {
    return (a.estado === 'Cerrada' ? 1 : 0) - (b.estado === 'Cerrada' ? 1 : 0) || (a.vence < b.vence ? -1 : 1);
  });

  // Filtrado de alertas
  const filteredAlerts = allAlerts.filter((a) => {
    if (nivelFilter && a.nivel !== nivelFilter) return false;
    if (estadoFilter === 'abiertas') return a.estado !== 'Resuelta';
    if (estadoFilter !== 'todas') return a.estado === estadoFilter;
    return true;
  });

  // Paginación incremental de la lista (densidad legible)
  const visibleAlerts = filteredAlerts.slice(0, visibleCount);
  const hiddenCount = filteredAlerts.length - visibleAlerts.length;

  const hasFilters = Boolean(nivelFilter || estadoFilter !== 'abiertas');

  const clearFilters = () => {
    setNivelFilter('');
    setEstadoFilter('abiertas');
    setVisibleCount(20);
  };

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv' | 'print') => {
    const cols = [
      { l: 'Fecha', x: (a: Alert) => fdate(a.fecha) },
      { l: 'Prioridad', x: (a: Alert) => ALV[a.nivel]?.t || a.nivel },
      { l: 'Tipo', k: 'tipo' },
      { l: 'Contrato', k: 'numero' },
      { l: 'Descripción', k: 'descripcion' },
      { l: 'Estado', k: 'estado' },
      { l: 'Responsable', k: 'responsable' }
    ];
    exportRows('Centro de alertas', cols, filteredAlerts, format);
  };

  const markAllRead = () => {
    allAlerts.forEach((a) => {
      if (a.estado === 'Nueva') {
        Alerts.setState(a.key, { estado: 'Leída' });
      }
    });
    refresh();
  };

  const handleRead = (a: Alert) => {
    Alerts.setState(a.key, { estado: 'Leída' });
    refresh();
  };

  const handleReopen = (a: Alert) => {
    Alerts.setState(a.key, { estado: 'Leída' });
    Audit.log({
      contractId: a.contractId || undefined,
      modulo: 'Alertas',
      accion: 'Reapertura de alerta',
      campo: a.tipo,
      nuevo: a.descripcion.slice(0, 120)
    });
    refresh();
  };

  const submitResolve = () => {
    if (!resolveAlert) return;
    if (!AuthService.guard('editar')) return;
    Alerts.setState(resolveAlert.key, { estado: 'Resuelta', nota: resolveNote });
    Audit.log({
      contractId: resolveAlert.contractId || undefined,
      modulo: 'Alertas',
      accion: 'Resolución de alerta',
      campo: resolveAlert.tipo,
      nuevo: resolveAlert.descripcion.slice(0, 120),
      obs: resolveNote
    });
    setResolveAlert(null);
    setResolveNote('');
    refresh();
  };

  const submitDelegate = () => {
    if (!delegateAlert) return;
    if (!AuthService.guard('editar')) return;
    const targetUser = delegateUser || (users[0] ? users[0].nombre : '');
    Alerts.setState(delegateAlert.key, { estado: 'Delegada', delegadoA: targetUser });
    const u = users.find((x) => x.nombre === targetUser);
    NotificationService.email(u ? u.email : targetUser, `Alerta delegada: ${delegateAlert.tipo}`, delegateAlert.descripcion);
    Audit.log({
      contractId: delegateAlert.contractId || undefined,
      modulo: 'Alertas',
      accion: 'Delegación de alerta',
      campo: delegateAlert.tipo,
      nuevo: `Delegada a ${targetUser}`
    });
    setDelegateAlert(null);
    setDelegateUser('');
    refresh();
  };

  const submitCreateTask = () => {
    if (!taskAlert) return;
    if (!AuthService.guard('crear')) return;
    if (!taskTitle.trim()) {
      notify('Escribe el título de la tarea.');
      return;
    }
    const asg = taskAssignee || taskAlert.responsable || (users[0] ? users[0].nombre : '');
    const newTask: Task = {
      id: uid('TK'),
      titulo: taskTitle.trim(),
      asignado: asg,
      vence: taskDueDate || todayIso(),
      contractId: taskAlert.contractId || undefined,
      alertKey: taskAlert.key,
      estado: 'Abierta',
      creada: nowStamp(),
      creadaPor: AuthService.currentUser().nombre
    };
    if (!db.tasks) db.tasks = [];
    db.tasks.push(newTask);
    Alerts.setState(taskAlert.key, { estado: taskAlert.estado === 'Nueva' ? 'Leída' : taskAlert.estado });
    Audit.log({
      contractId: taskAlert.contractId || undefined,
      modulo: 'Alertas',
      accion: 'Creación de tarea',
      campo: taskAlert.tipo,
      nuevo: newTask.titulo
    });
    Store.persist();
    setTaskAlert(null);
    setTaskTitle('');
    setTaskAssignee('');
    setTaskDueDate('');
    refresh();
  };

  const toggleTask = (taskId: string) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    t.estado = t.estado === 'Cerrada' ? 'Abierta' : 'Cerrada';
    Store.persist();
    refresh();
  };

  return (
    <div className="anim-fade-rise">
      {/* Banner de cabecera con gradiente de marca institucional */}
      <PageHeader variant="hero" className="ph">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--r)',
                background: 'rgba(255, 255, 255, 0.16)',
                color: 'var(--surface)',
                display: 'grid',
                placeItems: 'center',
                backdropFilter: 'blur(8px)',
                flexShrink: 0
              }}
            >
              <Icon name="bell" size={24} />
            </span>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                Centro de alertas
                <span style={countPill}>{openAlerts.length} abiertas</span>
              </h1>
              <p style={{ margin: '4px 0 0' }}>
                Alertas automáticas de plazos, garantías, obligaciones, pagos, ejecución y documentos
              </p>
            </div>
          </div>

          {/* Leyenda institucional de niveles, dentro del hero */}
          <div className="legend" style={{ marginTop: 16 }}>
            <span><span className="sem crit" /> Crítica</span>
            <span><span className="sem risk" /> Riesgo</span>
            <span><span className="sem warn" /> Próxima</span>
            <span><span className="sem info" /> Informativa</span>
            <span><span className="sem na" /> Resuelta</span>
          </div>
        </div>

        <div className="ph-actions">
          <Button
            className="btn sm"
            onClick={markAllRead}
            disabled={nuevasCount === 0}
            title={nuevasCount === 0 ? 'No hay alertas nuevas por marcar' : `Marcar ${nuevasCount} alertas nuevas como leídas`}
          >
            <Icon name="check" /> Marcar todas como leídas
          </Button>
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
      </PageHeader>

      {/* KPIs canónicos con entrada escalonada; clic filtra por nivel */}
      <div className="kpis mb">
        <Kpi
          icon="alert-circle"
          label="Críticas"
          value={openAlerts.filter((a) => a.nivel === 'critica').length}
          sub="Atención inmediata"
          sem="crit"
          className="anim-fade-rise stagger-1 click"
          onClick={() => {
            setNivelFilter(nivelFilter === 'critica' ? '' : 'critica');
            setVisibleCount(20);
          }}
        />
        <Kpi
          icon="shield-alert"
          label="Riesgo"
          value={openAlerts.filter((a) => a.nivel === 'riesgo').length}
          sub="Impacto alto"
          sem="risk"
          className="anim-fade-rise stagger-2 click"
          onClick={() => {
            setNivelFilter(nivelFilter === 'riesgo' ? '' : 'riesgo');
            setVisibleCount(20);
          }}
        />
        <Kpi
          icon="clock"
          label="Próximas"
          value={openAlerts.filter((a) => a.nivel === 'proxima').length}
          sub="Vencimientos cercanos"
          sem="warn"
          className="anim-fade-rise stagger-3 click"
          onClick={() => {
            setNivelFilter(nivelFilter === 'proxima' ? '' : 'proxima');
            setVisibleCount(20);
          }}
        />
        <Kpi
          icon="info"
          label="Informativas"
          value={openAlerts.filter((a) => a.nivel === 'info').length}
          sub="Para seguimiento"
          sem="info"
          className="anim-fade-rise stagger-4 click"
          onClick={() => {
            setNivelFilter(nivelFilter === 'info' ? '' : 'info');
            setVisibleCount(20);
          }}
        />
        <Kpi
          icon="check-circle"
          label="Resueltas"
          value={allAlerts.length - openAlerts.length}
          sub="Histórico gestionado"
          color="ok"
          className="anim-fade-rise stagger-5 click"
          onClick={() => {
            setEstadoFilter(estadoFilter === 'Resuelta' ? 'abiertas' : 'Resuelta');
            setVisibleCount(20);
          }}
        />
        <Kpi
          icon="list-check"
          label="Tareas abiertas"
          value={tasks.filter((t) => t.estado !== 'Cerrada').length}
          sub="Creadas desde alertas"
          color="info"
          className="anim-fade-rise stagger-6 click"
          onClick={() => scrollToPanel('panel-tareas')}
        />
      </div>

      {/* Grid de 2 columnas: Alertas (66%) y Tareas (33%) */}
      <div className="grid g-21">
        {/* Panel izquierdo: Lista de alertas */}
        <Surface className="panel">
          <div className="tabs" style={{ padding: '0 8px', display: 'flex', alignItems: 'center' }}>
            {[
              { id: '', label: 'Todas', count: openAlerts.length },
              { id: 'critica', label: 'Críticas', count: openAlerts.filter((a) => a.nivel === 'critica').length },
              { id: 'riesgo', label: 'Riesgo', count: openAlerts.filter((a) => a.nivel === 'riesgo').length },
              { id: 'proxima', label: 'Próximas', count: openAlerts.filter((a) => a.nivel === 'proxima').length },
              { id: 'info', label: 'Informativas', count: openAlerts.filter((a) => a.nivel === 'info').length }
            ].map((t) => (
              <Button
                key={t.id}
                className={`tab ${nivelFilter === t.id ? 'on' : ''}`}
                onClick={() => {
                  setNivelFilter(t.id);
                  setVisibleCount(20);
                }}
                aria-pressed={nivelFilter === t.id}
              >
                {t.label}
                <span className="n">{t.count}</span>
              </Button>
            ))}
            <span className="sp" style={{ flex: 1 }} />
            <Select
              className="inp"
              style={{ margin: '6px', width: 'auto', padding: '4px 8px', fontSize: '12px' }}
              value={estadoFilter}
              onChange={(e) => {
                setEstadoFilter(e.target.value);
                setVisibleCount(20);
              }}
              aria-label="Filtrar por estado de alerta"
            >
              <option value="abiertas">Abiertas</option>
              <option value="Nueva">Nuevas</option>
              <option value="Leída">Leídas</option>
              <option value="Delegada">Delegadas</option>
              <option value="Resuelta">Resueltas</option>
              <option value="todas">Todas</option>
            </Select>
          </div>

          <div style={{ padding: '12px' }}>
            {filteredAlerts.length === 0 ? (
              <EmptyState
                title="No hay alertas con estos filtros"
                description="Las alertas se generan automáticamente por vencimientos, garantías, obligaciones, pagos y documentos."
                action={
                  hasFilters ? (
                    <Button className="btn sm" onClick={clearFilters} style={{ marginTop: 8 }}>
                      Restablecer filtros
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                {visibleAlerts.map((a, idx) => (
                  <div
                    key={a.key}
                    className={`alert-line lv-${a.nivel} ${a.estado !== 'Nueva' ? 'read' : ''} anim-fade-rise`}
                    style={{ animationDelay: `${Math.min(idx, 12) * 25}ms` }}
                  >
                    <div className="alert-ic">
                      <Icon name={ALV[a.nivel]?.ic || 'info'} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="t">
                        {a.tipo} ·{' '}
                        {a.contractId ? (
                          <Link
                            className="link mono"
                            href={contractHref(a.contractId, a.act?.includes(':') ? a.act.split(':')[2] : undefined)}
                            title="Ver expediente digital"
                            style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--brand-2)', whiteSpace: 'nowrap' }}
                          >
                            {a.numero}
                          </Link>
                        ) : (
                          <span>{a.numero}</span>
                        )}{' '}
                        <Badge state={a.estado} style={badgePop} />{' '}
                        <span className={`badge b-${ALV[a.nivel]?.c || 'na'}`} style={{ ...badgePop, marginLeft: 4 }}>
                          {ALV[a.nivel]?.t || a.nivel}
                        </span>
                      </div>
                      <div className="d" style={{ marginTop: 2 }}>{a.descripcion}</div>
                      <div className="d" style={{ marginTop: 2, fontSize: '11px', color: 'var(--muted)' }}>
                        {fdate(a.fecha)} · Responsable: <b>{a.responsable || '—'}</b>
                        {a.gestion && a.gestion.usuario && (
                          <span> · Última gestión: {a.gestion.usuario} {a.gestion.fechaGestion}</span>
                        )}
                        {a.gestion && a.gestion.nota && (
                          <span> · «{a.gestion.nota}»</span>
                        )}
                      </div>
                    </div>

                    <div className="acts" style={{ flexShrink: 0, display: 'flex', gap: 4 }}>
                      {a.estado === 'Nueva' && (
                        <Button
                          className="icon-btn"
                          title="Marcar como leída"
                          aria-label={`Marcar como leída la alerta ${a.tipo} ${a.numero}`}
                          onClick={() => handleRead(a)}
                        >
                          <Icon name="eye" />
                        </Button>
                      )}
                      {a.estado !== 'Resuelta' ? (
                        <>
                          <Button
                            className="icon-btn"
                            title="Resolver alerta"
                            aria-label={`Resolver la alerta ${a.tipo} ${a.numero}`}
                            onClick={() => {
                              setResolveAlert(a);
                              setResolveNote('');
                            }}
                          >
                            <Icon name="check-circle" />
                          </Button>
                          <Button
                            className="icon-btn"
                            title="Delegar"
                            aria-label={`Delegar la alerta ${a.tipo} ${a.numero}`}
                            onClick={() => {
                              setDelegateAlert(a);
                              setDelegateUser(users[0]?.nombre || '');
                            }}
                          >
                            <Icon name="user" />
                          </Button>
                          <Button
                            className="icon-btn"
                            title="Crear tarea"
                            aria-label={`Crear tarea desde la alerta ${a.tipo} ${a.numero}`}
                            onClick={() => {
                              setTaskAlert(a);
                              setTaskTitle(`Gestionar: ${a.tipo.toLowerCase()} ${a.numero}`);
                              setTaskAssignee(a.responsable || (users[0]?.nombre || ''));
                              setTaskDueDate(addDays(todayIso(), 3));
                            }}
                          >
                            <Icon name="plus" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          className="icon-btn"
                          title="Reabrir alerta"
                          aria-label={`Reabrir la alerta ${a.tipo} ${a.numero}`}
                          onClick={() => handleReopen(a)}
                        >
                          <Icon name="play" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Paginación incremental real de la lista */}
                {hiddenCount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 6px' }}>
                    <Button className="btn sm ghost" onClick={() => setVisibleCount((v) => v + 20)}>
                      Mostrar más ({hiddenCount} restantes)
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </Surface>

        {/* Panel derecho: Tareas de seguimiento */}
        <Surface className="panel" id="panel-tareas">
          <div className="panel-h">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="list-check" size={14} /> Tareas
            </h3>
            <span className="sub">Seguimiento de acciones</span>
          </div>
          <div style={{ padding: '12px' }}>
            {tasks.length === 0 ? (
              <EmptyState
                title="Sin tareas de seguimiento"
                description="Crea tareas desde cualquier alerta con la acción «Crear tarea» para dejar registro del compromiso."
              />
            ) : (
              tasks.map((t) => {
                const c = t.contractId ? Store.get('contracts', t.contractId) : null;
                const d = diffDays(todayIso(), t.vence);
                const isOverdue = t.estado !== 'Cerrada' && d < 0;
                return (
                  <div
                    key={t.id}
                    className={`alert-line ${t.estado === 'Cerrada' ? 'read' : ''}`}
                    style={{ alignItems: 'flex-start', padding: '8px 10px', marginBottom: 6 }}
                  >
                    <label style={{ marginRight: 8, cursor: 'pointer', marginTop: 2 }}>
                      <Input
                        type="checkbox"
                        checked={t.estado === 'Cerrada'}
                        onChange={() => toggleTask(t.id)}
                        aria-label={`Marcar la tarea «${t.titulo}» como ${t.estado === 'Cerrada' ? 'abierta' : 'cerrada'}`}
                      />
                    </label>
                    <div style={{ flex: 1 }}>
                      <div
                        className="t"
                        style={{
                          fontSize: '12.5px',
                          textDecoration: t.estado === 'Cerrada' ? 'line-through' : 'none',
                          color: t.estado === 'Cerrada' ? 'var(--muted)' : 'inherit'
                        }}
                      >
                        {t.titulo}
                      </div>
                      <div className="d" style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        {c ? `${c.numero} · ` : ''}
                        {t.asignado} · vence {fdate(t.vence)}
                        {isOverdue && <span className="badge b-crit">Vencida</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Surface>
      </div>

      {/* Modal Resolver */}
      {resolveAlert && (
        <Modal
          title="Resolver alerta"
          onClose={() => setResolveAlert(null)}
          footer={
            <>
              <Button className="btn" onClick={() => setResolveAlert(null)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={submitResolve}>
                Resolver
              </Button>
            </>
          }
        >
          <p className="small muted" style={{ marginTop: 0 }}>
            {resolveAlert.tipo} · {resolveAlert.numero}: {resolveAlert.descripcion}
          </p>
          <Field className="f" style={{ marginTop: 12 }}>
            <label>Gestión realizada / soporte de resolución *</label>
            <Textarea
              className="inp"
              rows={3}
              placeholder="Ej.: se radicó la prórroga No. 2 / se aportó soporte de pago"
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              autoFocus
            />
          </Field>
        </Modal>
      )}

      {/* Modal Delegar */}
      {delegateAlert && (
        <Modal
          title="Delegar alerta"
          onClose={() => setDelegateAlert(null)}
          footer={
            <>
              <Button className="btn" onClick={() => setDelegateAlert(null)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={submitDelegate}>
                Delegar
              </Button>
            </>
          }
        >
          <p className="small muted" style={{ marginTop: 0 }}>
            {delegateAlert.tipo} · {delegateAlert.numero}: {delegateAlert.descripcion}
          </p>
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Delegar a usuario responsable *</label>
            <Select
              className="inp"
              value={delegateUser}
              onChange={(e) => setDelegateUser(e.target.value)}
              aria-label="Usuario responsable de la alerta"
            >
              {users.map((u) => (
                <option key={u.id} value={u.nombre}>
                  {u.nombre} ({u.rol})
                </option>
              ))}
            </Select>
          </div>
        </Modal>
      )}

      {/* Modal Crear Tarea */}
      {taskAlert && (
        <Modal
          title="Crear tarea desde alerta"
          onClose={() => setTaskAlert(null)}
          footer={
            <>
              <Button className="btn" onClick={() => setTaskAlert(null)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={submitCreateTask}>
                Crear tarea
              </Button>
            </>
          }
        >
          <p className="small muted" style={{ marginTop: 0 }}>
            {taskAlert.tipo} · {taskAlert.numero}: {taskAlert.descripcion}
          </p>
          <FormGrid className="form-grid" style={{ gap: 12, marginTop: 12 }}>
            <div>
              <label className="form-label">Título de la tarea *</label>
              <Input
                className="inp"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Descripción de la tarea"
              />
            </div>
            <div>
              <label className="form-label">Asignar a</label>
              <Select
                className="inp"
                value={taskAssignee}
                onChange={(e) => setTaskAssignee(e.target.value)}
                aria-label="Asignar tarea a usuario"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.nombre}>
                    {u.nombre} ({u.rol})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="form-label">Fecha límite</label>
              <Input
                type="date"
                className="inp"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
              />
            </div>
          </FormGrid>
        </Modal>
      )}
    </div>
  );
};
