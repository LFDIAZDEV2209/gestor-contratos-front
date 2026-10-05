'use client';

import { useState } from 'react';
import { useFormCancel } from './useFormCancel';
import { AccessibleForm, createFieldValidation } from './AccessibleForm';
import Link from 'next/link';
import { Input, Select } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, FormGrid, Field } from '../ui/Workspace';
import type { Alert, Task, User } from '../../lib/types';
import { Alerts } from '../../lib/alerts';
import { Store, AuthService, Audit } from '../../lib/store';
import { fdate, addDays, todayIso, nowStamp, uid, diffDays } from '../../lib/format';
import { contractHref } from '../app/routes';
import { Icon } from '../icons';

/**
 * Formulario de tarea derivada de alerta en VISTA dedicada (creación) — sin modal.
 * La alerta llega ya resuelta desde las claves estables de Alerts.compute(); el
 * guard de permisos se vuelve a exigir al guardar. Al crear la tarea la alerta
 * pasa a «Leída» (mismo comportamiento del modal original).
 */
export const TareaForm = ({ alert, onDone }: { alert: Alert; onDone: (id: string) => void }) => {
  const cancelar = useFormCancel("/alertas");
  const [form, setForm] = useState(() => ({
    titulo: `Gestionar: ${alert.tipo.toLowerCase()} ${alert.numero}`,
    asignado: alert.responsable || (Store.all('users')[0]?.nombre as string) || '',
    vence: addDays(todayIso(), 3)
  }));
  const [intentado, setIntentado] = useState(false);

  const db = Store.getDB();
  const users: User[] = Store.all('users');

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  // Validación en bloque (regla del handler original: título obligatorio trim)
  const titulo = (form.titulo || '').trim();
  const vence = form.vence || '';
  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!titulo) addError("titulo", 'El título de la tarea es obligatorio.');
  if (!vence) addError("vence", 'La fecha límite es obligatoria.');

  const guardar = () => {
    setIntentado(true);
    if (!AuthService.guard('crear')) return;
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }

    const asg = form.asignado || alert.responsable || (users[0] ? users[0].nombre : '');
    const newTask: Task = {
      id: uid('TK'),
      titulo,
      asignado: asg,
      vence: vence || todayIso(),
      contractId: alert.contractId || undefined,
      alertKey: alert.key,
      estado: 'Abierta',
      creada: nowStamp(),
      creadaPor: AuthService.currentUser().nombre
    };
    if (!db.tasks) db.tasks = [];
    db.tasks.push(newTask);
    // La alerta de origen pasa a leída solo si estaba nueva (comportamiento del modal)
    Alerts.setState(alert.key, { estado: alert.estado === 'Nueva' ? 'Leída' : alert.estado });
    Audit.log({
      contractId: alert.contractId || undefined,
      modulo: 'Alertas',
      accion: 'Creación de tarea',
      campo: alert.tipo,
      nuevo: newTask.titulo
    });
    Store.persist();
    notify(`Tarea «${titulo.slice(0, 60)}» creada y asignada a ${asg}.`);
    onDone(newTask.id);
  };

  return (
    <AccessibleForm errors={fieldErrors} attempted={intentado}>
      <PageHeader className="ph">
        <div>
          <nav aria-label="Ruta de navegación" className="crumb" style={{ width: '100%', marginBottom: 6 }}>
            <Link href="/alertas">Alertas</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <span aria-current="page">Crear tarea</span>
          </nav>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            Crear tarea desde alerta
          </h1>
          <p style={{ margin: '4px 0 0' }}>
            Compromiso de gestión derivado de la alerta; queda en el panel de tareas con su
            responsable y fecha límite.
          </p>
        </div>
      </PageHeader>

      {/* Contexto de la alerta origen (solo lectura) */}
      <Surface className="panel mb">
        <div className="panel-h">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="bell" size={16} /> Alerta de origen
          </h2>
          <span className="sub">Solo lectura</span>
        </div>
        <div style={{ display: 'grid', gap: 8, fontSize: 13.5 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <b>{alert.tipo}</b>
            {alert.contractId ? (
              <Link
                className="link mono"
                href={contractHref(alert.contractId)}
                title="Ver expediente digital"
                style={{ fontWeight: 700 }}
              >
                {alert.numero}
              </Link>
            ) : (
              <span className="mono">{alert.numero}</span>
            )}
          </div>
          <div className="small muted">{alert.descripcion}</div>
          <div className="small muted">
            {fdate(alert.fecha)} · Responsable de la alerta: <b>{alert.responsable || '—'}</b>
          </div>
        </div>
      </Surface>

      {/* Datos de la tarea */}
      <Surface className="panel mb">
        <div className="panel-h">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="list-check" size={16} /> Datos de la tarea
          </h2>
          <span className="sub">Los campos con * son obligatorios</span>
        </div>

        <FormGrid className="form-grid">
          <Field className="f span3">
            <label className="req">Título de la tarea</label>
            <Input name="titulo"
              value={form.titulo}
              placeholder="Descripción de la tarea"
              onChange={(e) => set({ titulo: e.target.value })}
            />
          </Field>

          <Field className="f">
            <label>Asignar a</label>
            <Select name="asignado" value={form.asignado} onChange={(e) => set({ asignado: e.target.value })}>
              {users.map((u) => (
                <option key={u.id} value={u.nombre}>
                  {u.nombre} ({u.rol})
                </option>
              ))}
            </Select>
            <small style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              Por defecto toma el responsable de la alerta.
            </small>
          </Field>

          <Field className="f">
            <label className="req">Fecha límite</label>
            <Input name="vence"
              type="date"
              value={vence}
              onChange={(e) => set({ vence: e.target.value })}
            />
            <small style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              {vence && diffDays(todayIso(), vence) < 0
                ? 'La fecha elegida ya está vencida.'
                : `Sugerida: ${fdate(addDays(todayIso(), 3))} (tres días).`}
            </small>
          </Field>
        </FormGrid>
      </Surface>



      <div className="form-foot">
        <Button className="btn ghost" onClick={cancelar}>
          <Icon name="chevron-left" /> Cancelar
        </Button>
        <Button className="btn pri" onClick={guardar}>
          <Icon name="check" /> Crear tarea
        </Button>
      </div>
    </AccessibleForm>
  );
};
