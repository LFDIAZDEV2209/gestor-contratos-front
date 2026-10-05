'use client';
import { useState } from 'react';
import { Input, Select, Textarea } from '../../ui/Controls';
import { notify } from '../../ui/Feedback';
import { FormGrid, Field } from '../../ui/Workspace';
import { Store, AuthService, Audit } from '../../../lib/store';
import { todayIso, uid } from '../../../lib/format';
import type { Breach, Contract, Obligation } from '../../../lib/types';
import { ExpedienteFormShell, createFieldValidation } from './ExpedienteFormShell';
import { guardExpedienteRecord } from './ExpedienteRoute';

type FormState = {
  tipo: string;
  fecha: string;
  obligationId: string;
  impacto: string;
  estado: string;
  descripcion: string;
  responsable: string;
  medida: string;
  multa: number;
  plan: string;
};

/**
 * VISTA dedicada del incumplimiento contractual (antes modales alta/gestión en TabIncumplimientos).
 * Alta: tipo, fecha, obligación asociada (opcional), impacto, descripción obligatoria, medida,
 * multa y plan; responsable usa el del contrato si no se indica; entra «Abierto».
 * Gestión (edición): cambia estado de trámite e impacto; el tipo NO se edita (trazabilidad).
 */
export const IncumplimientoForm = ({ cid, recordId, onDone }: { cid: string; recordId?: string; onDone: () => void }) => {
  const c = Store.get('contracts', cid) as Contract;
  const actual = recordId ? (Store.get('breaches', recordId) as Breach | undefined) : undefined;
  const isEdit = !!actual;
  const [form, setForm] = useState<FormState>({
    tipo: actual?.tipo || 'Retraso en cronograma',
    fecha: actual?.fecha || todayIso(),
    obligationId: actual?.obligationId || '',
    impacto: actual?.impacto || 'Medio',
    estado: actual?.estado || 'Abierto',
    descripcion: actual?.descripcion || '',
    responsable: actual?.responsable && actual.responsable !== 'Supervisor' ? actual.responsable : '',
    medida: actual?.medida || '',
    multa: Number(actual?.multa) || 0,
    plan: actual?.plan || ''
  });
  const [intentado, setIntentado] = useState(false);
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const obligations = Store.byContract('obligations', cid) as Obligation[];

  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!form.fecha) addError("fecha", 'La fecha de reporte formal es obligatoria.');
  if (!form.descripcion.trim()) addError("descripcion", 'La descripción detallada de los hechos es obligatoria.');
  if (form.multa < 0) addError("multa", 'La multa tasada no puede ser negativa.');

  const guardar = () => {
    setIntentado(true);
    if (recordId && !guardExpedienteRecord(cid, 'breaches', recordId)) {
      notify('El registro ya no pertenece a este expediente.');
      return;
    }
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }
    if (!AuthService.guard(isEdit ? 'editar' : 'crear')) return;

    if (isEdit) {
      Store.update('breaches', actual!.id, {
        descripcion: form.descripcion.trim(),
        impacto: form.impacto as Breach['impacto'],
        estado: form.estado,
        medida: form.medida.trim(),
        multa: Number(form.multa) || undefined,
        plan: form.plan.trim()
      });
      Audit.log({
        contractId: cid,
        modulo: 'Incumplimientos',
        accion: 'Edición',
        campo: 'Incumplimiento ' + actual!.id,
        nuevo: `Estado: ${form.estado} · Medida: ${form.medida.trim() || '—'}`
      });
      notify(`Incumplimiento ${actual!.id} actualizado`);
    } else {
      const newBreach: Breach = {
        id: uid('IN'),
        contractId: cid,
        fecha: form.fecha,
        obligationId: form.obligationId || undefined,
        tipo: form.tipo,
        descripcion: form.descripcion.trim(),
        responsable: form.responsable.trim() || c.responsable || 'Supervisor',
        impacto: form.impacto as Breach['impacto'],
        estado: 'Abierto',
        medida: form.medida.trim(),
        multa: Number(form.multa) || undefined,
        plan: form.plan.trim()
      };
      Store.insert('breaches', newBreach);
      Audit.log({
        contractId: cid,
        modulo: 'Incumplimientos',
        accion: 'Creación',
        campo: 'Nuevo incumplimiento ' + newBreach.id,
        nuevo: `${newBreach.tipo}: ${newBreach.descripcion.slice(0, 40)}`
      });
      notify('Incumplimiento registrado correctamente');
    }
    onDone();
  };

  return (
    <ExpedienteFormShell
      fieldErrors={fieldErrors}
      cid={cid}
      tab="incumplimientos"
      paso={isEdit ? `Gestionar ${actual!.id}` : 'Nuevo incumplimiento'}
      title={isEdit ? `Gestionar incumplimiento · ${actual!.id}` : 'Registrar incumplimiento contractual'}
      description={
        isEdit
          ? 'Ajusta el estado de trámite, la medida administrativa y la multa liquidada; el tipo de falta no se puede cambiar para conservar la trazabilidad.'
          : 'Deja constancia formal de la falta detectada, su obligación contractual asociada y la medida adoptada.'
      }
      errores={errores}
      intentado={intentado}
      onSubmit={guardar}
      submitLabel={isEdit ? 'Guardar estado' : 'Guardar incumplimiento'}
      submitIcon="check"
      onCancel={onDone}
      nota={
        <p className="small muted" style={{ margin: '0 0 12px' }}>
          {isEdit
            ? `Estado actual: ${actual!.estado}. El tipo de falta queda invariable para conservar la trazabilidad.`
            : 'El incumplimiento entra en estado «Abierto» y queda registrado en la auditoría del expediente.'}
        </p>
      }
    >
      <FormGrid className="form-grid">
        <Field className="f">
          <label className="req">Tipo de falta</label>
          <Select name="tipo" value={form.tipo} onChange={(e) => set({ tipo: e.target.value })} disabled={isEdit}>
            <option value="Retraso en cronograma">Retraso en cronograma</option>
            <option value="Calidad de entregable">Deficiencia en calidad de entregable</option>
            <option value="No aporte de pólizas">No aporte o no renovación de pólizas</option>
            <option value="Incumplimiento de pagos a personal">Incumplimiento pagos/seguridad social</option>
            <option value="Inobservancia técnica">Inobservancia técnica o ambiental</option>
            <option value="Otro">Otro incumplimiento</option>
          </Select>
        </Field>
        <Field className="f">
          <label className="req">Fecha de reporte formal</label>
          <Input name="fecha" type="date" value={form.fecha} onChange={(e) => set({ fecha: e.target.value })} required />
        </Field>
        <Field className="f">
          <label>Obligación contractual asociada</label>
          <Select name="obligationId" value={form.obligationId} onChange={(e) => set({ obligationId: e.target.value })}>
            <option value="">— Ninguna en particular —</option>
            {obligations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.id} · {o.descripcion.slice(0, 50)}
              </option>
            ))}
          </Select>
        </Field>
        <Field className="f">
          <label>Nivel de impacto</label>
          <Select name="impacto" value={form.impacto} onChange={(e) => set({ impacto: e.target.value })}>
            <option value="Bajo">Bajo</option>
            <option value="Medio">Medio</option>
            <option value="Alto">Alto</option>
          </Select>
        </Field>
        {isEdit && (
          <Field className="f">
            <label className="req">Estado de trámite</label>
            <Select name="estado" value={form.estado} onChange={(e) => set({ estado: e.target.value })}>
              <option value="Abierto">Abierto</option>
              <option value="En análisis">En análisis jurídico</option>
              <option value="En gestión">En gestión de descargos</option>
              <option value="Subsanado">Subsanado a conformidad</option>
              <option value="Cerrado">Cerrado con sanción</option>
            </Select>
          </Field>
        )}
        {!isEdit && (
          <Field className="f">
            <label>Responsable del seguimiento</label>
            <Input name="responsable"
              value={form.responsable}
              onChange={(e) => set({ responsable: e.target.value })}
              placeholder={c.responsable || 'Supervisor'}
            />
          </Field>
        )}
        <Field className="f span2">
          <label className="req">Descripción detallada de los hechos</label>
          <Textarea name="descripcion"
            rows={3}
            value={form.descripcion}
            placeholder="Detalle los hechos verificados, requerimientos desatendidos o evidencias recogidas..."
            onChange={(e) => set({ descripcion: e.target.value })}
            required
          />
        </Field>
        <Field className="f">
          <label>Medida administrativa {isEdit ? 'aplicada' : 'adoptada'}</label>
          <Input name="medida"
            value={form.medida}
            placeholder="Ej. Requerimiento formal con apercibimiento"
            onChange={(e) => set({ medida: e.target.value })}
          />
        </Field>
        <Field className="f">
          <label>Valor tasado de sanción/multa (COP)</label>
          <Input name="multa"
            type="number"
            min="0"
            value={form.multa || ''}
            placeholder="0"
            onChange={(e) => set({ multa: Number(e.target.value) })}
          />
        </Field>
        <Field className="f span2">
          <label>Plan de mitigación o acción de choque exigida</label>
          <Input name="plan"
            value={form.plan}
            placeholder="Ej. Radicación de cronograma acelerado en 5 días hábiles"
            onChange={(e) => set({ plan: e.target.value })}
          />
        </Field>
      </FormGrid>
    </ExpedienteFormShell>
  );
};
