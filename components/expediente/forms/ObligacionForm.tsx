'use client';
import { useState } from 'react';
import { Input, Select, Textarea } from '../../ui/Controls';
import { notify } from '../../ui/Feedback';
import { FormGrid, Field } from '../../ui/Workspace';
import { Store, AuthService, Audit } from '../../../lib/store';
import { todayIso, uid } from '../../../lib/format';
import { CAT } from '../../../lib/catalog';
import type { Obligation } from '../../../lib/types';
import { ExpedienteFormShell, createFieldValidation } from './ExpedienteFormShell';

/**
 * VISTA dedicada de alta de obligación contractual (antes modal en TabObligaciones).
 * Conserva las reglas del handler original: descripción, responsable y fecha límite
 * obligatorios; registro con estado «Pendiente» y cumplimiento 0 %.
 */
export const ObligacionForm = ({ cid, onDone }: { cid: string; onDone: () => void }) => {
  const [form, setForm] = useState({
    tipo: 'General',
    descripcion: '',
    responsable: '',
    fechaLimite: todayIso(),
    periodicidad: 'Mensual',
    evidencia: '',
    obs: ''
  });
  const [intentado, setIntentado] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!form.descripcion.trim()) addError("descripcion", 'La descripción de la obligación es obligatoria.');
  if (!form.responsable.trim()) addError("responsable", 'El responsable es obligatorio.');
  if (!form.fechaLimite) addError("fechaLimite", 'La fecha límite es obligatoria.');

  const guardar = () => {
    setIntentado(true);
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }
    if (!AuthService.guard('crear')) return;

    const nueva: Obligation = {
      id: uid('OB'),
      contractId: cid,
      tipo: form.tipo,
      descripcion: form.descripcion.trim(),
      responsable: form.responsable.trim(),
      fechaLimite: form.fechaLimite,
      periodicidad: form.periodicidad,
      evidencia: form.evidencia,
      obs: form.obs,
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
    onDone();
  };

  return (
    <ExpedienteFormShell
      fieldErrors={fieldErrors}
      cid={cid}
      tab="obligaciones"
      paso="Nueva obligación"
      title="Nueva obligación contractual"
      description="Registra el compromiso pactado en el contrato; quedará en estado «Pendiente» con 0 % de cumplimiento hasta su verificación."
      errores={errores}
      intentado={intentado}
      onSubmit={guardar}
      submitLabel="Registrar obligación"
      submitIcon="save"
      onCancel={onDone}
      nota={
        <p className="small muted" style={{ margin: '0 0 12px' }}>
          El cumplimiento se calcula con la lista de chequeo de la ficha de la obligación; la
          verificación final la aprueba un responsable con permiso de aprobación.
        </p>
      }
    >
      <FormGrid className="form-grid">
        <Field className="f span2">
          <label className="req">Descripción de la obligación</label>
          <Textarea name="descripcion"
            rows={2}
            value={form.descripcion}
            onChange={(e) => set({ descripcion: e.target.value })}
            placeholder="Detalle pactado en el contrato..."
          />
        </Field>
        <Field className="f">
          <label>Tipo</label>
          <Select name="tipo" value={form.tipo} onChange={(e) => set({ tipo: e.target.value })}>
            {CAT('tiposObligacion').map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field className="f">
          <label>Periodicidad</label>
          <Select name="periodicidad" value={form.periodicidad} onChange={(e) => set({ periodicidad: e.target.value })}>
            {['Única', 'Semanal', 'Quincenal', 'Mensual', 'Trimestral', 'Semestral', 'Anual', 'Por entrega', 'Permanente'].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field className="f">
          <label className="req">Responsable</label>
          <Input name="responsable"
            value={form.responsable}
            onChange={(e) => set({ responsable: e.target.value })}
            placeholder="Nombre del responsable"
          />
        </Field>
        <Field className="f">
          <label className="req">Fecha límite</label>
          <Input name="fechaLimite"
            type="date"
            value={form.fechaLimite}
            onChange={(e) => set({ fechaLimite: e.target.value })}
          />
        </Field>
        <Field className="f">
          <label>Evidencia requerida</label>
          <Input name="evidencia"
            value={form.evidencia}
            onChange={(e) => set({ evidencia: e.target.value })}
            placeholder="Ej. Certificado de cumplimiento"
          />
        </Field>
        <Field className="f">
          <label>Observaciones</label>
          <Input name="obs"
            value={form.obs}
            onChange={(e) => set({ obs: e.target.value })}
            placeholder="Notas adicionales..."
          />
        </Field>
      </FormGrid>
    </ExpedienteFormShell>
  );
};
