'use client';
import { useState } from 'react';
import { useSoportes } from '../../ui/Soportes';
import { contractHref } from '../../app/routes';
import { Input } from '../../ui/Controls';
import { notify } from '../../ui/Feedback';
import { FormGrid, Field } from '../../ui/Workspace';
import { Store, AuthService, Audit } from '../../../lib/store';
import { money, monthLabel, uid } from '../../../lib/format';
import { M } from '../../../lib/metrics';
import type { Contract, Exec } from '../../../lib/types';
import { ExpedienteFormShell, createFieldValidation } from './ExpedienteFormShell';
import { guardExpedienteRecord } from './ExpedienteRoute';

type FormState = { periodo: string; valor: number; avanceFisico: number; obs: string };

/**
 * VISTA dedicada de ejecución mensual (antes modales alta/edición en TabEjecucion).
 * Reglas del handler original: periodo AAAA-MM obligatorio y valor > 0; observación
 * con valor por defecto «Informe de ejecución {mes}». Endurecimiento acordado:
 * rango 0–100 del avance físico y control de periodo duplicado por contrato.
 */
export const EjecucionForm = ({ cid, recordId, onDone }: { cid: string; recordId?: string; onDone: () => void }) => {
  const sop = useSoportes(cid, contractHref(cid, 'ejecucion'));
  const c = Store.get('contracts', cid) as Contract;
  const actual = recordId ? (Store.get('execs', recordId) as Exec | undefined) : undefined;
  const m = M(c);
  const [form, setForm] = useState<FormState>({
    periodo: actual?.periodo || '',
    valor: actual ? Number(actual.valor) : 0,
    avanceFisico: actual ? Number(actual.avanceFisico) || 0 : Number(c.avanceFisico) || 0,
    obs: actual?.obs || ''
  });
  const [intentado, setIntentado] = useState(false);
  const isEdit = !!actual;
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const duplicado = (Store.byContract('execs', cid) as Exec[]).some(
    (ex) => ex.periodo === form.periodo && ex.id !== actual?.id
  );
  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!form.periodo) addError("periodo", 'Selecciona el periodo del informe (AAAA-MM).');
  if (!form.valor || form.valor <= 0) addError("valor", 'El valor ejecutado debe ser mayor a cero.');
  if (form.avanceFisico < 0 || form.avanceFisico > 100)
    addError("avanceFisico", 'El avance físico acumulado debe estar entre 0 y 100.');
  if (duplicado) addError("periodo", 'Ya existe un informe registrado para ese periodo: edítalo en lugar de duplicarlo.');

  const guardar = async () => {
    if (sop.bloqueado()) return;
    setIntentado(true);
    if (recordId && !guardExpedienteRecord(cid, 'execs', recordId)) {
      notify('El registro ya no pertenece a este expediente.');
      return;
    }
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }
    if (!AuthService.guard(isEdit ? 'editar' : 'crear')) return;

    if (isEdit) {
      Store.update('execs', actual!.id, {
        periodo: form.periodo,
        valor: Number(form.valor),
        avanceFisico: Number(form.avanceFisico) || 0,
        obs: form.obs
      });
      Audit.log({
        contractId: cid,
        modulo: 'Ejecución',
        accion: 'Edición',
        campo: 'Periodo ' + form.periodo,
        nuevo: money(Number(form.valor))
      });
      notify(`Registro del periodo ${monthLabel(form.periodo)} actualizado`);
    } else {
      Store.insert('execs', {
        id: uid('EX'),
        contractId: cid,
        periodo: form.periodo,
        valor: Number(form.valor),
        avanceFisico: Number(form.avanceFisico) || 0,
        obs: form.obs.trim() || `Informe de ejecución ${monthLabel(form.periodo)}`
      });
      Audit.log({
        contractId: cid,
        modulo: 'Ejecución',
        accion: 'Creación',
        campo: 'Periodo ' + form.periodo,
        nuevo: money(Number(form.valor))
      });
      notify(`Avance para ${monthLabel(form.periodo)} registrado correctamente`);
    }
    await sop.finalizar(onDone);
  };

  return (
    <ExpedienteFormShell
      fieldErrors={fieldErrors}
      cid={cid}
      tab="ejecucion"
      paso={isEdit ? `Editar ejecución · ${actual!.periodo}` : 'Registrar ejecución'}
      title={isEdit ? `Editar ejecución · ${monthLabel(actual!.periodo)}` : 'Registrar avance de ejecución mensual'}
      description={
        isEdit
          ? 'Ajusta el valor ejecutado y el avance físico del periodo; los saldos y gráficas se recalculan al guardar.'
          : 'Informe mensual de avance financiero y físico; alimenta las curvas de ejecución y la proyección de agotamiento.'
      }
      errores={errores}
      intentado={intentado}
      onSubmit={guardar}
      submitting={sop.subiendo}
      soportes={sop.node}
      submitLabel={isEdit ? 'Guardar cambios' : 'Guardar registro'}
      submitIcon="check"
      onCancel={onDone}
      nota={
        <p className="small muted" style={{ margin: '0 0 12px' }}>
          Valor actualizado del contrato: <b className="mono">{money(m.valorActual)}</b>. El avance físico es el
          acumulado del contrato al cierre del periodo (0–100).
        </p>
      }
    >
      <FormGrid className="form-grid">
        <Field className="f">
          <label className="req">Periodo (AAAA-MM)</label>
          <Input name="periodo" type="month" value={form.periodo} onChange={(e) => set({ periodo: e.target.value })} required />
        </Field>
        <Field className="f">
          <label className="req">Valor ejecutado del periodo (COP)</label>
          <Input name="valor"
            type="number"
            min="0"
            step="1000"
            value={form.valor || ''}
            onChange={(e) => set({ valor: Number(e.target.value) })}
            placeholder="Valor en pesos"
            required
          />
        </Field>
        <Field className="f">
          <label className="req">% Avance físico acumulado (0–100)</label>
          <Input name="avanceFisico"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={form.avanceFisico || ''}
            onChange={(e) => set({ avanceFisico: Number(e.target.value) })}
            placeholder="Porcentaje de avance"
            required
          />
        </Field>
        <Field className="f span2">
          <label>Observaciones / Acta de soporte</label>
          <Input name="obs"
            value={form.obs}
            onChange={(e) => set({ obs: e.target.value })}
            placeholder="Informe de supervisión o radicado de soporte..."
          />
        </Field>
      </FormGrid>
    </ExpedienteFormShell>
  );
};
