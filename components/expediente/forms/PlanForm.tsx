'use client';
import { useState } from 'react';
import { Input, Select, Textarea } from '../../ui/Controls';
import { notify } from '../../ui/Feedback';
import { FormGrid, Field } from '../../ui/Workspace';
import { Store, AuthService, Audit } from '../../../lib/store';
import { todayIso, uid, clamp } from '../../../lib/format';
import type { Plan } from '../../../lib/types';
import { ExpedienteFormShell, createFieldValidation } from './ExpedienteFormShell';
import { guardExpedienteRecord } from './ExpedienteRoute';

type FormState = {
  hallazgo: string;
  causa: string;
  accion: string;
  fecha: string;
  responsable: string;
  estado: string;
  avance: number;
};

/**
 * VISTA dedicada de planes de mejoramiento (antes modales alta/gestión en TabIncumplimientos).
 * Alta: hallazgo, causa, acción correctiva obligatoria, fecha límite y responsable (fallback
 * al supervisor); entra «Abierto» con 0 %. Gestión: estado, avance (0–100) y responsable;
 * hallazgo/causa/fecha se conservan tal como se registraron.
 */
export const PlanForm = ({ cid, recordId, onDone }: { cid: string; recordId?: string; onDone: () => void }) => {
  const actual = recordId ? (Store.get('plans', recordId) as Plan | undefined) : undefined;
  const isEdit = !!actual;
  const [form, setForm] = useState<FormState>({
    hallazgo: actual?.hallazgo || '',
    causa: actual?.causa || '',
    accion: actual?.accion || '',
    fecha: actual?.fecha || todayIso(),
    responsable: actual?.responsable || '',
    estado: actual?.estado || 'Abierto',
    avance: actual ? Number(actual.avance) || 0 : 0
  });
  const [intentado, setIntentado] = useState(false);
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!isEdit && !form.hallazgo.trim()) addError("hallazgo", 'El hallazgo o hecho observado es obligatorio.');
  if (!form.accion.trim()) addError("accion", 'La acción correctiva comprometida es obligatoria.');
  if (!form.fecha) addError("fecha", 'La fecha límite de cumplimiento es obligatoria.');
  if (form.avance < 0 || form.avance > 100) addError("avance", 'El avance debe estar entre 0 y 100.');

  const guardar = () => {
    setIntentado(true);
    if (recordId && !guardExpedienteRecord(cid, 'plans', recordId)) {
      notify('El registro ya no pertenece a este expediente.');
      return;
    }
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }
    if (!AuthService.guard(isEdit ? 'editar' : 'crear')) return;

    if (isEdit) {
      const avance = clamp(Number(form.avance) || 0, 0, 100);
      Store.update('plans', actual!.id, {
        accion: form.accion.trim(),
        responsable: form.responsable.trim(),
        avance,
        estado: form.estado
      });
      Audit.log({
        contractId: cid,
        modulo: 'Planes',
        accion: 'Edición',
        campo: 'Plan ' + actual!.id,
        nuevo: `Avance: ${avance}% (${form.estado})`
      });
      notify('Plan de mejoramiento actualizado');
    } else {
      const c = Store.get('contracts', cid) as { supervisor?: string };
      const newPlan: Plan = {
        id: uid('PM'),
        contractId: cid,
        fecha: form.fecha,
        hallazgo: form.hallazgo.trim(),
        causa: form.causa.trim(),
        accion: form.accion.trim(),
        responsable: form.responsable.trim() || c.supervisor || 'Supervisor',
        estado: 'Abierto',
        avance: 0
      };
      Store.insert('plans', newPlan);
      Audit.log({
        contractId: cid,
        modulo: 'Planes',
        accion: 'Creación',
        campo: 'Nuevo plan de mejoramiento ' + newPlan.id,
        nuevo: (newPlan.hallazgo || newPlan.accion || '').slice(0, 40)
      });
      notify('Plan de mejoramiento registrado');
    }
    onDone();
  };

  return (
    <ExpedienteFormShell
      fieldErrors={fieldErrors}
      cid={cid}
      tab="incumplimientos"
      paso={isEdit ? `Avance de plan · ${actual!.id}` : 'Nuevo plan'}
      title={isEdit ? `Gestionar avance de plan · ${actual!.id}` : 'Nuevo plan de mejoramiento'}
      description={
        isEdit
          ? 'Actualiza el estado de implementación y el porcentaje de avance; hallazgo, causa y fecha límite se conservan de la radicación.'
          : 'Plan correctivo derivado de un hallazgo de supervisión o auditoría; su avance se mide en la pestaña Incumplimientos.'
      }
      errores={errores}
      intentado={intentado}
      onSubmit={guardar}
      submitLabel={isEdit ? 'Guardar avance' : 'Registrar plan'}
      submitIcon="check"
      onCancel={onDone}
      nota={
        isEdit ? (
          <p className="small muted" style={{ margin: '0 0 12px' }}>
            Hallazgo original: «{actual!.hallazgo}» · Fecha límite: <b>{actual!.fecha}</b>.
          </p>
        ) : null
      }
    >
      <FormGrid className="form-grid">
        {!isEdit && (
          <>
            <Field className="f span2">
              <label className="req">Hallazgo o hecho observado</label>
              <Textarea name="hallazgo"
                rows={2}
                value={form.hallazgo}
                placeholder="Hallazgo documentado en informe de supervisión o auditoría..."
                onChange={(e) => set({ hallazgo: e.target.value })}
                required
              />
            </Field>
            <Field className="f span2">
              <label>Causa raíz identificada</label>
              <Textarea name="causa"
                rows={2}
                value={form.causa}
                placeholder="Causa técnica, logística o administrativa que originó la desviación..."
                onChange={(e) => set({ causa: e.target.value })}
              />
            </Field>
            <Field className="f span2">
              <label className="req">Acción correctiva comprometida</label>
              <Textarea name="accion"
                rows={2}
                value={form.accion}
                placeholder="Acciones verificables para corregir el hallazgo y prevenir su recurrencia..."
                onChange={(e) => set({ accion: e.target.value })}
                required
              />
            </Field>
            <Field className="f">
              <label className="req">Fecha límite de cumplimiento</label>
              <Input name="fecha" type="date" value={form.fecha} onChange={(e) => set({ fecha: e.target.value })} required />
            </Field>
            <Field className="f">
              <label>Responsable asignado</label>
              <Input name="responsable"
                value={form.responsable}
                placeholder="Supervisor / Contratista"
                onChange={(e) => set({ responsable: e.target.value })}
              />
            </Field>
          </>
        )}
        {isEdit && (
          <>
            <Field className="f">
              <label className="req">Estado de implementación</label>
              <Select name="estado" value={form.estado} onChange={(e) => set({ estado: e.target.value })}>
                <option value="Abierto">Abierto</option>
                <option value="En ejecución">En ejecución</option>
                <option value="Cumplido">Cumplido a satisfacción</option>
                <option value="Incumplido">Incumplido</option>
                <option value="Cerrado">Cerrado formalmente</option>
              </Select>
            </Field>
            <Field className="f">
              <label className="req">% Avance implementado (0–100)</label>
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
              <label className="req">Acción correctiva en curso</label>
              <Textarea name="accion"
                rows={2}
                value={form.accion}
                onChange={(e) => set({ accion: e.target.value })}
                required
              />
            </Field>
            <Field className="f span2">
              <label>Responsable del seguimiento</label>
              <Input name="responsable"
                value={form.responsable}
                onChange={(e) => set({ responsable: e.target.value })}
                placeholder={actual?.responsable || 'Supervisor'}
              />
            </Field>
          </>
        )}
      </FormGrid>
    </ExpedienteFormShell>
  );
};
