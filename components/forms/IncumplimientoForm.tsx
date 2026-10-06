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
import type { Breach, Contract } from '../../lib/types';
import { Store, Audit, AuthService } from '../../lib/store';
import { activeContracts } from '../../lib/metrics';
import { money, todayIso } from '../../lib/format';
import { Icon } from '../icons';
import { useSoportes } from '../ui/Soportes';

/** Valores de partida del formulario (mismos defaults que tenía el modal original). */
const FORM_DEFAULT: Partial<Breach> = {
  contractId: '',
  fecha: todayIso(),
  tipo: 'Retraso en cronograma',
  descripcion: '',
  impacto: 'Medio',
  multa: 0,
  planAccion: '',
  responsable: '',
  estado: 'Abierto'
};

const TIPOS = [
  'Retraso en cronograma',
  'Calidad del entregable',
  'Incumplimiento de obligación',
  'No renovación de garantía',
  'Falta de personal',
  'Otro'
];

const ESTADOS = ['Abierto', 'En descargos', 'Sancionado', 'Subsanado', 'Cerrado'];
const IMPACTOS = ['Bajo', 'Medio', 'Alto'];

/**
 * Formulario de incumplimiento en VISTA dedicada (creación y edición) — sin modal.
 * Reglas del handler original: descripción obligatoria; multa y fechas con
 * salvaguardas de rango. Los campos del tab de expediente (obligationId, medida,
 * plan) que el modal global no mostraba se conservan intactos al guardar.
 */
export const IncumplimientoForm = ({
  initial,
  onDone
}: {
  initial?: Partial<Breach>;
  onDone: (savedId: string) => void;
}) => {
  const cancelar = useFormCancel("/incumplimientos");
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState<Partial<Breach>>(() =>
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

  const set = (patch: Partial<Breach>) => setForm((f) => ({ ...f, ...patch }));

  // Validación en bloque (regla del handler original + salvaguardas de rango)
  const descripcion = (form.descripcion || '').trim();
  const multa = Number(form.multa) || 0;
  const fecha = form.fecha || '';

  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!contractId) addError("contractId", 'Seleccione el contrato al que se imputa el incumplimiento.');
  else if (!contrato) addError("contractId", 'El contrato seleccionado ya no existe en el portafolio.');
  if (!fecha) addError("fecha", 'La fecha del hecho es obligatoria.');
  if (!descripcion) addError("descripcion", 'La descripción del incumplimiento es obligatoria.');
  if (multa < 0) addError("multa", 'La multa no puede ser negativa.');

  // El estado del tab puede ser un valor de trámite distinto (En análisis / En gestión):
  // se ofrezca como opción extra para no perderlo al editar desde el módulo global.
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

    // El nivel de impacto se normaliza a mayúscula inicial; el resto de campos del
    // registro (obligationId, medida, plan, evidencia) se preservan tal cual.
    const impacto =
      IMPACTOS.find((i) => i.toLowerCase() === String(form.impacto || '').toLowerCase()) ||
      form.impacto ||
      'Medio';
    const patch: Partial<Breach> = {
      ...form,
      contractId,
      fecha,
      tipo: form.tipo || 'Retraso en cronograma',
      descripcion,
      impacto,
      multa,
      estado: form.estado || 'Abierto'
    };

    if (isEdit) {
      const id = form.id as string;
      // Snapshot previo: Store.update muta en sitio y falsearía el diff de auditoría
      const before = { ...(Store.get('breaches', id) || {}) };
      Store.update('breaches', id, patch);
      Audit.diff('Incumplimientos', contractId, before, patch, {
        fecha: 'Fecha del incumplimiento',
        tipo: 'Tipo de incumplimiento',
        descripcion: 'Descripción del incumplimiento',
        impacto: 'Impacto del incumplimiento',
        multa: 'Multa / sanción',
        planAccion: 'Plan de acción del incumplimiento',
        responsable: 'Responsable del seguimiento',
        estado: 'Estado del incumplimiento'
      });
      notify(`Incumplimiento «${descripcion.slice(0, 60)}» actualizado.`);
      await sop.finalizar(() => onDone(id));
      return;
    }

    // Store.insert asigna el id con el prefijo propio de la colección (como el modal original)
    const nuevo: Breach = { ...patch } as Breach;
    Store.insert('breaches', nuevo);
    Audit.log({
      contractId,
      modulo: 'Incumplimientos',
      accion: 'Creación',
      campo: 'Incumplimiento',
      nuevo: descripcion
    });
    notify(`Incumplimiento registrado en el contrato ${contrato?.numero || contractId}.`);
    await sop.finalizar(() => onDone(nuevo.id));
  };

  return (
    <AccessibleForm errors={fieldErrors} attempted={intentado}>
      <PageHeader className="ph">
        <div>
          <nav aria-label="Ruta de navegación" className="crumb" style={{ width: '100%', marginBottom: 6 }}>
            <Link href="/incumplimientos">Incumplimientos</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <span aria-current="page">{isEdit ? 'Editar incumplimiento' : 'Registrar incumplimiento'}</span>
          </nav>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <span className="form-shell-icon" aria-hidden="true"><Icon name="alert-circle" size={22} /></span>
            {isEdit ? 'Editar Incumplimiento' : 'Registrar Incumplimiento'}
          </h1>
          <p style={{ margin: '4px 0 0' }}>
            {isEdit
              ? 'Ajusta el hecho, el impacto y el plan exigido; cada cambio queda en la auditoría del sistema.'
              : 'Deja constancia formal del hecho incumplido, su impacto, la multa y el plan de acción exigido al contratista.'}
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

      {/* Hecho incumplido */}
      <Surface className="panel mb">

        <FormSection title={<>Hecho incumplido</>} icon="triangle-exclamation" description={<>Los campos con * son obligatorios</>} accent>
          <Field className="f">
            <label className="req">Fecha del hecho</label>
            <Input name="fecha" type="date" value={fecha} onChange={(e) => set({ fecha: e.target.value })} />
          </Field>

          <Field className="f">
            <label className="req">Tipo de incumplimiento</label>
            <Select name="tipo" value={form.tipo || ''} onChange={(e) => set({ tipo: e.target.value })}>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>

          <Field className="f">
            <label className="req">Nivel de impacto</label>
            <Select name="impacto"
              value={String(form.impacto || 'Medio')}
              onChange={(e) => set({ impacto: e.target.value })}
            >
              {IMPACTOS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </Select>
          </Field>

          <Field className="f span3">
            <label className="req">Descripción detallada</label>
            <Textarea name="descripcion"
              rows={3}
              value={form.descripcion || ''}
              placeholder="Hechos que configuran el presunto incumplimiento"
              onChange={(e) => set({ descripcion: e.target.value })}
            />
          </Field>
        </FormSection>
      </Surface>

      {/* Consecuencias y seguimiento */}
      <Surface className="panel mb">

        <FormSection title={<>Consecuencias y seguimiento</>} icon="scale-balanced" description={<>Multas en pesos colombianos (COP)</>} accent>
          <Field className="f">
            <label>Multa / sanción económica</label>
            <Input name="multa"
              type="number"
              min={0}
              value={multa || ''}
              placeholder="0"
              onChange={(e) => set({ multa: Number(e.target.value) })}
            />
            <small style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              {multa > 0 ? money(multa) : '0 COP si no hay sanción monetaria.'}
            </small>
          </Field>

          <Field className="f">
            <label>Responsable del seguimiento</label>
            <Input name="responsable"
              value={form.responsable || ''}
              placeholder="Nombre del responsable"
              onChange={(e) => set({ responsable: e.target.value })}
            />
          </Field>

          <Field className="f">
            <label>Estado</label>
            <Select name="estado" value={form.estado || 'Abierto'} onChange={(e) => set({ estado: e.target.value })}>
              {Array.from(estados).map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
          </Field>

          <Field className="f span3">
            <label>Plan de acción requerido</label>
            <Textarea name="planAccion"
              rows={3}
              value={form.planAccion || ''}
              placeholder="Medidas de mitigación o plan exigido al contratista"
              onChange={(e) => set({ planAccion: e.target.value })}
            />
            <small style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              Se asocia al plan de mejoramiento en la pestaña contratista posterior.
            </small>
          </Field>
        </FormSection>
      </Surface>

      {sop.node}

      <div className="form-foot">
        <Button className="btn ghost" onClick={cancelar}>
          <Icon name="chevron-left" /> Cancelar
        </Button>
        <Button className="btn pri" onClick={guardar} loading={sop.subiendo}>
          <Icon name="check" /> {isEdit ? 'Guardar Cambios' : 'Guardar Incumplimiento'}
        </Button>
      </div>
    </AccessibleForm>
  );
};
