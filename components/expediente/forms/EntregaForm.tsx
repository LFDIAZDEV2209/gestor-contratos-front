'use client';
import { useState } from 'react';
import { Input, Select, Textarea } from '../../ui/Controls';
import { notify } from '../../ui/Feedback';
import { FormGrid, Field } from '../../ui/Workspace';
import { Store, AuthService, Audit } from '../../../lib/store';
import { todayIso, clamp } from '../../../lib/format';
import type { Deliverable } from '../../../lib/types';
import { ExpedienteFormShell, createFieldValidation } from './ExpedienteFormShell';
import { guardExpedienteRecord } from './ExpedienteRoute';

type FormState = { estado: string; avance: number; fechaReal: string; evidencia: string; obs: string };

/**
 * VISTA dedicada de «Gestionar entrega» (antes modal de seguimiento en TabEntregables).
 * Cinco campos de seguimiento del entregable; al pasar a Aprobado/Entregado el avance se
 * fuerza a 100 % (regla del modal original). Endurecimiento acordado: avance acotado 0–100
 * y la fecha real pasa a ser válida o vacía (sin fechas de texto).
 */
export const EntregaForm = ({ cid, recordId, onDone }: { cid: string; recordId: string; onDone: () => void }) => {
  const d = Store.get('deliverables', recordId) as Deliverable | undefined;
  const [form, setForm] = useState<FormState>({
    estado: d ? (d.estado === 'Pendiente' ? 'Entregado' : d.estado) : 'En proceso',
    avance: d ? Number(d.avance) || (d.estado === 'Aprobado' || d.estado === 'Entregado' ? 100 : 50) : 0,
    fechaReal: d?.fechaReal || todayIso(),
    evidencia: d?.evidencia || '',
    obs: d?.obs || ''
  });
  const [intentado, setIntentado] = useState(false);
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const { errores, fieldErrors, addError } = createFieldValidation();
  if (form.avance < 0 || form.avance > 100) addError("avance", 'El avance debe estar entre 0 y 100.');

  const guardar = () => {
    setIntentado(true);
    if (recordId && !guardExpedienteRecord(cid, 'deliverables', recordId)) {
      notify('El registro ya no pertenece a este expediente.');
      return;
    }
    if (!d) return;
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }
    if (!AuthService.guard('editar')) return;

    const avance = clamp(Number(form.avance) || 0, 0, 100);
    Store.update('deliverables', d.id, {
      estado: form.estado,
      avance,
      fechaReal: form.fechaReal,
      evidencia: form.evidencia,
      obs: form.obs
    });

    Audit.log({
      contractId: cid,
      modulo: 'Entregables',
      accion: 'Edición',
      campo: 'Estado entregable ' + d.nombre,
      anterior: d.estado,
      nuevo: `${form.estado} (${avance}%)`
    });

    notify(`Entregable "${d.nombre}" actualizado correctamente`);
    onDone();
  };

  if (!d) return null;

  return (
    <ExpedienteFormShell
      fieldErrors={fieldErrors}
      cid={cid}
      tab="entregables"
      paso="Gestionar entrega"
      title={`Gestionar entrega · ${d.nombre}`}
      description="Registra el estado de la entrega, su avance, radicado real y las observaciones de supervisión."
      errores={errores}
      intentado={intentado}
      onSubmit={guardar}
      submitLabel="Guardar estado"
      submitIcon="check"
      onCancel={onDone}
      nota={
        <p className="small muted" style={{ margin: '0 0 12px' }}>
          «Aprobado» o «Entregado» fijan el avance en 100 %. El estado registral queda en la auditoría del
          expediente con el valor anterior y el nuevo.
        </p>
      }
    >
      <FormGrid className="form-grid">
        <Field className="f">
          <label className="req">Estado de entrega</label>
          <Select name="estado"
            value={form.estado}
            onChange={(e) => {
              const est = e.target.value;
              set({
                estado: est,
                avance: est === 'Aprobado' || est === 'Entregado' ? 100 : form.avance
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
          <label className="req">% Avance actual (0–100)</label>
          <Input name="avance"
            type="number"
            min="0"
            max="100"
            value={form.avance}
            onChange={(e) => set({ avance: Number(e.target.value) })}
            required
          />
        </Field>
        <Field className="f span2">
          <label>Fecha real de radicación o entrega</label>
          <Input name="fechaReal" type="date" value={form.fechaReal} onChange={(e) => set({ fechaReal: e.target.value })} />
        </Field>
        <Field className="f span2">
          <label>Radicado / Soporte documental</label>
          <Input name="evidencia"
            value={form.evidencia}
            onChange={(e) => set({ evidencia: e.target.value })}
            placeholder="Ej. Radicado interno No. 2026-0982 o enlace a carpeta"
          />
        </Field>
        <Field className="f span2">
          <label>Observaciones de supervisión</label>
          <Textarea name="obs"
            rows={2}
            value={form.obs}
            onChange={(e) => set({ obs: e.target.value })}
            placeholder="Observaciones de revisión o condiciones de subsanación..."
          />
        </Field>
      </FormGrid>
    </ExpedienteFormShell>
  );
};
