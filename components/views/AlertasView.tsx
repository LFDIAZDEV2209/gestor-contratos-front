'use client';
import { Select, Input, Textarea } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, FormGrid } from '../ui/Workspace';

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

export const AlertasView: React.FC<AlertasViewProps> = ({ onSelectContract, initialNivel = '' }) => {
  const [nivelFilter, setNivelFilter] = useState<string>(initialNivel);
  const [estadoFilter, setEstadoFilter] = useState<string>('abiertas');
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
      {/* Encabezado */}
      <PageHeader className="ph">
        <div>
          <h1>Centro de alertas</h1>
          <p>Alertas automáticas derivadas de plazos, garantías, obligaciones, pagos, ejecución y documentos.</p>
        </div>
        <div className="ph-actions">
          <Button className="btn sm" onClick={markAllRead}>
            <Icon name="check" /> Marcar todas como leídas
          </Button>
          <Button className="btn sm" onClick={() => handleExport('xlsx')} title="Exportar Excel">
            <Icon name="file-excel" /> Excel
          </Button>
          <Button className="btn sm" onClick={() => handleExport('pdf')} title="Exportar PDF">
            <Icon name="file-pdf" /> PDF
          </Button>
          <Button className="btn sm" onClick={() => handleExport('csv')} title="Exportar CSV">
            <Icon name="file-text" /> CSV
          </Button>
        </div>
      </PageHeader>

      {/* Franja de 6 KPIs */}
      <div className="kpis mb">
        <Kpi
          icon="alert-circle"
          label="Críticas"
          value={openAlerts.filter((a) => a.nivel === 'critica').length}
          sub="Atención inmediata"
          sem="crit"
          onClick={() => setNivelFilter(nivelFilter === 'critica' ? '' : 'critica')}
        />
        <Kpi
          icon="shield-alert"
          label="Riesgo"
          value={openAlerts.filter((a) => a.nivel === 'riesgo').length}
          sub="Impacto alto"
          sem="risk"
          onClick={() => setNivelFilter(nivelFilter === 'riesgo' ? '' : 'riesgo')}
        />
        <Kpi
          icon="clock"
          label="Próximas"
          value={openAlerts.filter((a) => a.nivel === 'proxima').length}
          sub="Vencimientos cercanos"
          sem="warn"
          onClick={() => setNivelFilter(nivelFilter === 'proxima' ? '' : 'proxima')}
        />
        <Kpi
          icon="info"
          label="Informativas"
          value={openAlerts.filter((a) => a.nivel === 'info').length}
          sub="Para seguimiento"
          sem="ok"
          onClick={() => setNivelFilter(nivelFilter === 'info' ? '' : 'info')}
        />
        <Kpi
          icon="check-circle"
          label="Resueltas"
          value={allAlerts.length - openAlerts.length}
          sub="Histórico gestionado"
        />
        <Kpi
          icon="list-check"
          label="Tareas abiertas"
          value={tasks.filter((t) => t.estado !== 'Cerrada').length}
          sub="Creadas desde alertas"
          color="info"
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
                onClick={() => setNivelFilter(t.id)}
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
              onChange={(e) => setEstadoFilter(e.target.value)}
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
              <div className="empty-state" style={{ padding: '32px 16px', textAlign: 'center' }}>
                <p className="muted">No hay alertas con estos filtros.</p>
              </div>
            ) : (
              filteredAlerts.map((a) => (
                <div
                  key={a.key}
                  className={`alert-line lv-${a.nivel} ${a.estado !== 'Nueva' ? 'read' : ''}`}
                >
                  <div className="alert-ic">
                    <Icon name={a.nivel === 'critica' ? 'alert-triangle' : a.nivel === 'riesgo' ? 'alert-circle' : a.nivel === 'proxima' ? 'clock' : 'info'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t">
                      {a.tipo} ·{' '}
                      {a.contractId ? (
                        <span
                          className="link"
                          style={{ cursor: 'pointer', color: 'var(--brand-2)', fontWeight: 600 }}
                          onClick={() => {
                            const sub = a.act?.includes(':') ? a.act.split(':')[2] : undefined;
                            onSelectContract?.(a.contractId!, sub);
                          }}
                        >
                          {a.numero}
                        </span>
                      ) : (
                        <span>{a.numero}</span>
                      )}{' '}
                      <Badge state={a.estado} />{' '}
                      <span className="badge" style={{ marginLeft: 4 }}>
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
                        onClick={() => handleRead(a)}
                      >
                        <Icon name="mail" />
                      </Button>
                    )}
                    {a.estado !== 'Resuelta' ? (
                      <>
                        <Button
                          className="icon-btn"
                          title="Resolver alerta"
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
                          onClick={() => {
                            setDelegateAlert(a);
                            setDelegateUser(users[0]?.nombre || '');
                          }}
                        >
                          <Icon name="share" />
                        </Button>
                        <Button
                          className="icon-btn"
                          title="Crear tarea"
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
                        onClick={() => handleReopen(a)}
                      >
                        <Icon name="rotate-ccw" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Surface>

        {/* Panel derecho: Tareas de seguimiento */}
        <Surface className="panel">
          <div className="panel-h">
            <h3>Tareas</h3>
            <span className="sub">Seguimiento de acciones</span>
          </div>
          <div style={{ padding: '12px' }}>
            {tasks.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 8px', textAlign: 'center' }}>
                <p className="muted small">Crea tareas desde cualquier alerta.</p>
              </div>
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
                      <div className="d" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {c ? `${c.numero} · ` : ''}
                        {t.asignado} · vence {fdate(t.vence)}
                        {isOverdue && <b style={{ color: 'var(--crit)', marginLeft: 4 }}>(vencida)</b>}
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
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Gestión realizada / soporte de resolución *</label>
            <Textarea
              className="inp"
              rows={3}
              placeholder="Ej.: se radicó la prórroga No. 2 / se aportó soporte de pago"
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              autoFocus
            />
          </div>
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
          <FormGrid className="form-grid" style={{ gridTemplateColumns: '1fr', gap: 12, marginTop: 12 }}>
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
