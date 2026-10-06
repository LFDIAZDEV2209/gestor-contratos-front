'use client';

import { useState } from 'react';
import { useFormCancel } from './useFormCancel';
import { AccessibleForm, createFieldValidation } from './AccessibleForm';
import Link from 'next/link';
import { Input, Select, Textarea } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, Field } from '../ui/Workspace';
import { FormSection } from '../ui/FormSection';
import { PBar } from '../ui/PBar';
import type { Plan, Contract } from '../../lib/types';
import { Store, Audit, AuthService } from '../../lib/store';
import { activeContracts } from '../../lib/metrics';
import { todayIso } from '../../lib/format';
import { Icon } from '../icons';
import { useSoportes } from '../ui/Soportes';

/** Valores de partida del formulario (mismos defaults que tenía el modal original). */
const FORM_DEFAULT: Partial<Plan> = {
  contractId: '',
  accion: '',
  responsable: '',
  fechaInicio: todayIso(),
  fechaFin: todayIso(),
  avance: 0,
  estado: 'En curso'
};

const ESTADOS = ['En curso', 'Cumplido', 'Incumplido', 'Cerrado'];

/**
 * Formulario de plan de mejoramiento en VISTA dedicada (creación y edición) — sin modal.
 * Reglas del handler original: acción obligatoria; avance acotado 0–100 (salvaguarda,
 * el modal original solo la declaraba en el input). Los campos del tab de expediente
 * (hallazgo, causa, fecha) se conservan intactos al guardar.
 */
export const PlanForm = ({
  initial,
  onDone
}: {
  initial?: Partial<Plan>;
  onDone: (savedId: string) => void;
}) => {
  const cancelar = useFormCancel("/incumplimientos");
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState<Partial<Plan>>(() =>
    initial ? { ...initial } : { ...FORM_DEFAULT }
  );
  const [intentado, setIntentado] = useState(false);

  const contractId = form.contractId || '';
  const contracts: Contract[] = activeContracts();
  // Al editar, el contrato de origen puede haberse anulado: se conserva en el select
  // para no perder la vinculación del registro.
  const contratoOrigen = contractId ? (Store.get('contracts', contractId) as Contract | null) : null;
  const opciones =
    contratoOrigen && !contracts.some((c) => c.id === contractId)
      ? [contratoOrigen, ...contracts]
      : contracts;
  const contrato: Contract | null = contratoOrigen;

  const set = (patch: Partial<Plan>) => setForm((f) => ({ ...f, ...patch }));

  // Validación en bloque (regla del handler original + salvaguardas de rango)
  const accion = (form.accion || '').trim();
  const avance = Number(form.avance) || 0;
  const fechaInicio = form.fechaInicio || '';
  const fechaFin = form.fechaFin || '';

  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!contractId) addError("contractId", 'Seleccione el contrato al que se vincula el plan.');
  else if (!contrato) addError("contractId", 'El contrato seleccionado ya no existe en el portafolio.');
  if (!accion) addError("accion", 'La acción o compromiso del plan es obligatoria.');
  if (avance < 0 || avance > 100) addError("avance", 'El avance debe estar entre 0 y 100.');
  if (fechaFin && fechaInicio && fechaFin < fechaInicio)
    addError("fechaFin", 'La fecha límite no puede ser anterior a la fecha de inicio.');

  // El estado del tab puede ser un valor de trámite distinto («Abierto» / «En ejecución»):
  // se ofrece como opción extra para no perderlo al editar desde el módulo global.
  const estados = new Set<string>(ESTADOS);
  if (form.estado && !estados.has(form.estado)) estados.add(form.estado);

  const sop = useSoportes(() => contractId, '/incumplimientos');

  const guardar = async () => {
    if (sop.bloqueado()) return;
    setIntentado(true);
    if (!AuthService.guard(isEdit ? 'editar' : 'crear')) return;
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }

    const patch: Partial<Plan> = {
      ...form,
      contractId,
      accion,
      avance,
      fechaInicio,
      fechaFin,
      estado: form.estado || 'En curso'
    };

    if (isEdit) {
      const id = form.id as string;
      // Snapshot previo: Store.update muta en sitio y falsearía el diff de auditoría
      const before = { ...(Store.get('plans', id) || {}) };
      Store.update('plans', id, patch);
      Audit.diff('Incumplimientos', contractId, before, patch, {
        accion: 'Acción del plan de mejoramiento',
        responsable: 'Responsable del plan',
        avance: '% de avance del plan',
        fechaInicio: 'Fecha de inicio del plan',
        fechaFin: 'Fecha fin del plan',
        estado: 'Estado del plan'
      });
      notify(`Plan «${accion.slice(0, 60)}» actualizado.`);
      await sop.finalizar(() => onDone(id));
      return;
    }

    // Store.insert asigna el id con el prefijo propio de la colección (como el modal original)
    const nuevo: Plan = { ...patch } as Plan;
    Store.insert('plans', nuevo);
    Audit.log({
      contractId,
      modulo: 'Incumplimientos',
      accion: 'Creación',
      campo: 'Plan de mejoramiento',
      nuevo: accion
    });
    notify(`Plan de mejoramiento registrado en el contrato ${contrato?.numero || contractId}.`);
    await sop.finalizar(() => onDone(nuevo.id));
  };

  return (
    <AccessibleForm errors={fieldErrors} attempted={intentado}>
      <PageHeader className="ph">
        <div>
          <nav aria-label="Ruta de navegación" className="crumb" style={{ width: '100%', marginBottom: 6 }}>
            <Link href="/incumplimientos">Incumplimientos</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <span aria-current="page">{isEdit ? 'Editar plan' : 'Nuevo plan de mejoramiento'}</span>
          </nav>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <span className="form-shell-icon" aria-hidden="true"><Icon name="list-check" size={22} /></span>
            {isEdit ? 'Editar Plan de Mejoramiento' : 'Nuevo Plan de Mejoramiento'}
          </h1>
          <p style={{ margin: '4px 0 0' }}>
            {isEdit
              ? 'Actualiza el compromiso, el responsable y el avance; cada cambio queda en la auditoría del sistema.'
              : 'Compromisos de mejora con responsable, fechas de vigencia y porcentaje de avance verificable.'}
          </p>
        </div>
      </PageHeader>

      {/* Vínculo contractual */}
      <Surface className="panel mb">

        <FormSection title={<>Vínculo contractual</>} icon="file-contract" description={<>{contracts.length} contratos vigentes en el portafolio</>} accent>
          <Field className="f span3">
            <label className="req">Contrato</label>
            <Select name="contractId" value={contractId} onChange={(e) => set({ contractId: e.target.value })}>
              <option value="">— Seleccione contrato —</option>
              {opciones.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} — {c.contratista}
                </option>
              ))}
            </Select>
            {contrato && (
              <small style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                {contrato.objeto || contrato.obj || 'Sin objeto registrado'}.
              </small>
            )}
          </Field>
        </FormSection>
      </Surface>

      {/* Compromiso */}
      <Surface className="panel mb">

        <FormSection title={<>Compromiso de mejora</>} icon="clipboard-check" description={<>Los campos con * son obligatorios</>} accent>
          <Field className="f span3">
            <label className="req">Acción / Compromiso</label>
            <Textarea name="accion"
              rows={3}
              value={form.accion || ''}
              placeholder="Descripción del compromiso de mejora o plan de choque"
              onChange={(e) => set({ accion: e.target.value })}
            />
          </Field>

          <Field className="f">
            <label className="req">Responsable</label>
            <Input name="responsable"
              value={form.responsable || ''}
              placeholder="Nombre del responsable"
              onChange={(e) => set({ responsable: e.target.value })}
            />
          </Field>

          <Field className="f">
            <label>Fecha de inicio</label>
            <Input name="fechaInicio"
              type="date"
              value={fechaInicio}
              onChange={(e) => set({ fechaInicio: e.target.value })}
            />
          </Field>

          <Field className="f">
            <label>Fecha límite / compromiso</label>
            <Input name="fechaFin"
              type="date"
              value={fechaFin}
              onChange={(e) => set({ fechaFin: e.target.value })}
            />
          </Field>
        </FormSection>
      </Surface>

      {/* Avance y estado */}
      <Surface className="panel mb">

        <FormSection title={<>Avance y estado</>} icon="chart-pie" description={<>Seguimiento de implementación</>} accent>
          <Field className="f">
            <label>% de Avance (0 a 100)</label>
            <Input name="avance"
              type="number"
              min={0}
              max={100}
              value={avance}
              onChange={(e) => set({ avance: Number(e.target.value) })}
            />
            <small style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              Valor entre 0 y 100; el detalle del avance se respalda en la pestaña de auditoría.
            </small>
          </Field>

          <Field className="f">
            <label>Estado</label>
            <Select name="estado" value={form.estado || 'En curso'} onChange={(e) => set({ estado: e.target.value })}>
              {Array.from(estados).map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
          </Field>

          <Field className="f span3">
            <label>Gráfico de avance</label>
            <PBar value={avance} max={100} />
          </Field>
        </FormSection>
      </Surface>

      {sop.node}

      <div className="form-foot">
        <Button className="btn ghost" onClick={cancelar}>
          <Icon name="chevron-left" /> Cancelar
        </Button>
        <Button className="btn pri" onClick={guardar} loading={sop.subiendo}>
          <Icon name="check" /> {isEdit ? 'Guardar Cambios' : 'Guardar Plan'}
        </Button>
      </div>
    </AccessibleForm>
  );
};
