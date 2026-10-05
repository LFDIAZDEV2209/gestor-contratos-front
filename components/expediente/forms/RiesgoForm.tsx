'use client';
import { useState } from 'react';
import { Input, Select, Textarea } from '../../ui/Controls';
import { notify } from '../../ui/Feedback';
import { FormGrid, Field } from '../../ui/Workspace';
import { Store, AuthService, Audit } from '../../../lib/store';
import { todayIso, uid } from '../../../lib/format';
import { CAT } from '../../../lib/catalog';
import type { Contract, Risk } from '../../../lib/types';
import { ExpedienteFormShell, createFieldValidation } from './ExpedienteFormShell';
import { guardExpedienteRecord } from './ExpedienteRoute';

type FormState = {
  riesgo: string;
  categoria: string;
  responsable: string;
  prob: number;
  impacto: number;
  tratamiento: string;
  estado: string;
  mitigacion: string;
  evidencia: string;
};

/**
 * VISTA dedicada del riesgo contractual en contexto de expediente (antes modales alta/edición
 * en TabRiesgos). Mantiene la semántica del tab: campo `riesgo`, estados Abierto/Controlado/
 * Cerrado y nivel = probabilidad × impacto. El estado rápido se sigue cambiando desde la tabla
 * (acción breve); aquí se evalúa el riesgo completo.
 */
export const RiesgoForm = ({ cid, recordId, onDone }: { cid: string; recordId?: string; onDone: () => void }) => {
  const c = Store.get('contracts', cid) as Contract;
  const actual = recordId ? (Store.get('risks', recordId) as Risk | undefined) : undefined;
  const isEdit = !!actual;
  const [form, setForm] = useState<FormState>({
    riesgo: actual?.riesgo || '',
    categoria: actual?.categoria || 'Operativo',
    responsable: actual?.responsable || '',
    prob: Number(actual?.prob) || 3,
    impacto: Number(actual?.impacto) || 3,
    tratamiento: actual?.tratamiento || 'Mitigar',
    estado: actual?.estado || 'Abierto',
    mitigacion: actual?.mitigacion || '',
    evidencia: actual?.evidencia || ''
  });
  const [intentado, setIntentado] = useState(false);
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const nivel = (Number(form.prob) || 0) * (Number(form.impacto) || 0);
  const nivelTxt = nivel >= 15 ? 'Extremo' : nivel >= 10 ? 'Alto' : nivel >= 5 ? 'Moderado' : 'Bajo';

  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!form.riesgo.trim()) addError("riesgo", 'La descripción del evento de riesgo es obligatoria.');
  if (Number(form.prob) < 1 || Number(form.prob) > 5) addError("prob", 'La probabilidad debe estar entre 1 y 5.');
  if (Number(form.impacto) < 1 || Number(form.impacto) > 5)
    addError("impacto", 'El impacto debe estar entre 1 y 5.');

  const guardar = () => {
    setIntentado(true);
    if (recordId && !guardExpedienteRecord(cid, 'risks', recordId)) {
      notify('El registro ya no pertenece a este expediente.');
      return;
    }
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }
    if (!AuthService.guard(isEdit ? 'editar' : 'crear')) return;

    if (isEdit) {
      Store.update('risks', actual!.id, {
        riesgo: form.riesgo.trim(),
        categoria: form.categoria,
        prob: Number(form.prob),
        impacto: Number(form.impacto),
        responsable: form.responsable.trim() || (actual!.responsable as string),
        tratamiento: form.tratamiento,
        mitigacion: form.mitigacion.trim(),
        estado: form.estado
      });
      Audit.log({
        contractId: cid,
        modulo: 'Riesgos',
        accion: 'Edición',
        campo: 'Riesgo ' + actual!.id,
        nuevo: `P${form.prob}xI${form.impacto} (${form.estado})`
      });
      notify(`Riesgo ${actual!.id} actualizado`);
    } else {
      const newRisk: Risk = {
        id: uid('RG'),
        contractId: cid,
        categoria: form.categoria,
        riesgo: form.riesgo.trim(),
        prob: Number(form.prob),
        impacto: Number(form.impacto),
        responsable: form.responsable.trim() || c.responsable || 'Supervisor',
        tratamiento: form.tratamiento,
        mitigacion: form.mitigacion.trim(),
        fecha: todayIso(),
        estado: form.estado,
        evidencia: form.evidencia.trim()
      };
      Store.insert('risks', newRisk);
      Audit.log({
        contractId: cid,
        modulo: 'Riesgos',
        accion: 'Creación',
        campo: 'Nuevo riesgo ' + newRisk.id,
        nuevo: `${newRisk.categoria}: ${(newRisk.riesgo || '').slice(0, 40)} (P${newRisk.prob}xI${newRisk.impacto})`
      });
      notify('Riesgo registrado en la matriz');
    }
    onDone();
  };

  return (
    <ExpedienteFormShell
      fieldErrors={fieldErrors}
      cid={cid}
      tab="riesgos"
      paso={isEdit ? `Editar riesgo · ${actual!.id}` : 'Nuevo riesgo'}
      title={isEdit ? `Editar riesgo · ${actual!.id}` : 'Nuevo riesgo contractual'}
      description={
        isEdit
          ? 'Ajusta la evaluación (probabilidad × impacto), el tratamiento y el plan de mitigación; la matriz se reubica automáticamente.'
          : 'Evento que podría impactar el contrato; entra en la matriz de riesgos de la pestaña con su nivel calculado.'
      }
      errores={errores}
      intentado={intentado}
      onSubmit={guardar}
      submitLabel={isEdit ? 'Guardar cambios' : 'Registrar riesgo'}
      submitIcon="check"
      onCancel={onDone}
      nota={
        <div className="alert-box" role="status">
          <p>
            Nivel calculado: <b className="mono">P{form.prob} × I{form.impacto} = {nivel}</b> (
            <b style={{ color: nivel >= 15 ? 'var(--crit)' : nivel >= 10 ? 'var(--warn)' : 'var(--ok)' }}>{nivelTxt}</b>
            ). El cambio rápido de estado sigue disponible desde la tabla de la pestaña.
          </p>
        </div>
      }
    >
      <FormGrid className="form-grid">
        <Field className="f span2">
          <label className="req">Descripción del evento de riesgo</label>
          <Textarea name="riesgo"
            rows={2}
            value={form.riesgo}
            placeholder="Descripción concisa de la amenaza o evento que podría impactar el contrato..."
            onChange={(e) => set({ riesgo: e.target.value })}
            required
          />
        </Field>
        <Field className="f">
          <label className="req">Categoría de riesgo</label>
          <Select name="categoria" value={form.categoria} onChange={(e) => set({ categoria: e.target.value })}>
            {CAT('categoriasRiesgo').map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </Select>
        </Field>
        <Field className="f">
          <label className="req">Responsable del monitoreo</label>
          <Input name="responsable"
            value={form.responsable}
            placeholder={c.responsable || 'Supervisor designado'}
            onChange={(e) => set({ responsable: e.target.value })}
          />
        </Field>
        <Field className="f">
          <label className="req">Probabilidad (1 a 5)</label>
          <Select name="prob" value={form.prob} onChange={(e) => set({ prob: Number(e.target.value) })}>
            <option value={1}>1 - Muy baja (Raro)</option>
            <option value={2}>2 - Baja (Poco probable)</option>
            <option value={3}>3 - Media (Posible)</option>
            <option value={4}>4 - Alta (Probable)</option>
            <option value={5}>5 - Muy alta (Casi seguro)</option>
          </Select>
        </Field>
        <Field className="f">
          <label className="req">Impacto (1 a 5)</label>
          <Select name="impacto" value={form.impacto} onChange={(e) => set({ impacto: Number(e.target.value) })}>
            <option value={1}>1 - Leve (Insignificante)</option>
            <option value={2}>2 - Menor</option>
            <option value={3}>3 - Moderado</option>
            <option value={4}>4 - Mayor</option>
            <option value={5}>5 - Catastrófico</option>
          </Select>
        </Field>
        <Field className="f">
          <label>Estrategia de tratamiento</label>
          <Select name="tratamiento" value={form.tratamiento} onChange={(e) => set({ tratamiento: e.target.value })}>
            <option value="Mitigar">Mitigar (Reducir probabilidad o impacto)</option>
            <option value="Transferir">Transferir (Pólizas / Subcontratos)</option>
            <option value="Aceptar">Aceptar (Asumir riesgo residual)</option>
            <option value="Evitar">Evitar (Modificar términos)</option>
          </Select>
        </Field>
        <Field className="f">
          <label>Estado</label>
          <Select name="estado" value={form.estado} onChange={(e) => set({ estado: e.target.value })}>
            <option value="Abierto">Abierto</option>
            <option value="Controlado">Controlado</option>
            <option value="Cerrado">Cerrado</option>
          </Select>
        </Field>
        <Field className="f span2">
          <label>Plan de mitigación / Controles preventivos</label>
          <Textarea name="mitigacion"
            rows={3}
            value={form.mitigacion}
            placeholder="Acciones preventivas, controles operacionales y protocolos de contingencia..."
            onChange={(e) => set({ mitigacion: e.target.value })}
          />
        </Field>
        {!isEdit && (
          <Field className="f span2">
            <label>Evidencia / Referencia documental</label>
            <Input name="evidencia"
              value={form.evidencia}
              placeholder="Ej. Informe de supervisión 2026-04"
              onChange={(e) => set({ evidencia: e.target.value })}
            />
          </Field>
        )}
      </FormGrid>
    </ExpedienteFormShell>
  );
};
