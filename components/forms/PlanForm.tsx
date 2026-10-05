'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input, Select, Textarea } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, FormGrid, Field } from '../ui/Workspace';
import { PBar } from '../ui/PBar';
import type { Plan, Contract } from '../../lib/types';
import { Store, Audit, AuthService } from '../../lib/store';
import { activeContracts } from '../../lib/metrics';
import { todayIso } from '../../lib/format';
import { Icon } from '../icons';

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

  const errores: string[] = [];
  if (!contractId) errores.push('Seleccione el contrato al que se vincula el plan.');
  else if (!contrato) errores.push('El contrato seleccionado ya no existe en el portafolio.');
  if (!accion) errores.push('La acción o compromiso del plan es obligatoria.');
  if (avance < 0 || avance > 100) errores.push('El avance debe estar entre 0 y 100.');
  if (fechaFin && fechaInicio && fechaFin < fechaInicio)
    errores.push('La fecha límite no puede ser anterior a la fecha de inicio.');

  // El estado del tab puede ser un valor de trámite distinto («Abierto» / «En ejecución»):
  // se ofrece como opción extra para no perderlo al editar desde el módulo global.
  const estados = new Set<string>(ESTADOS);
  if (form.estado && !estados.has(form.estado)) estados.add(form.estado);

  const guardar = () => {
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
      onDone(id);
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
    onDone(nuevo.id);
  };

  return (
    <>
      <PageHeader className="ph">
        <div>
          <div className="crumb" style={{ width: '100%', marginBottom: 6 }}>
            <Link href="/incumplimientos">Incumplimientos</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <span>{isEdit ? 'Editar plan' : 'Nuevo plan de mejoramiento'}</span>
          </div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
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
        <div className="panel-h">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="file-contract" size={16} /> Vínculo contractual
          </h3>
          <span className="sub">{contracts.length} contratos vigentes en el portafolio</span>
        </div>

        <FormGrid className="form-grid">
          <Field className="f span3">
            <label className="req">Contrato</label>
            <Select value={contractId} onChange={(e) => set({ contractId: e.target.value })}>
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
        </FormGrid>
      </Surface>

      {/* Compromiso */}
      <Surface className="panel mb">
        <div className="panel-h">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="clipboard-check" size={16} /> Compromiso de mejora
          </h3>
          <span className="sub">Los campos con * son obligatorios</span>
        </div>

        <FormGrid className="form-grid">
          <Field className="f span3">
            <label className="req">Acción / Compromiso</label>
            <Textarea
              rows={3}
              value={form.accion || ''}
              placeholder="Descripción del compromiso de mejora o plan de choque"
              onChange={(e) => set({ accion: e.target.value })}
            />
          </Field>

          <Field className="f">
            <label className="req">Responsable</label>
            <Input
              value={form.responsable || ''}
              placeholder="Nombre del responsable"
              onChange={(e) => set({ responsable: e.target.value })}
            />
          </Field>

          <Field className="f">
            <label>Fecha de inicio</label>
            <Input
              type="date"
              value={fechaInicio}
              onChange={(e) => set({ fechaInicio: e.target.value })}
            />
          </Field>

          <Field className="f">
            <label>Fecha límite / compromiso</label>
            <Input
              type="date"
              value={fechaFin}
              onChange={(e) => set({ fechaFin: e.target.value })}
            />
          </Field>
        </FormGrid>
      </Surface>

      {/* Avance y estado */}
      <Surface className="panel mb">
        <div className="panel-h">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="chart-pie" size={16} /> Avance y estado
          </h3>
          <span className="sub">Seguimiento de implementación</span>
        </div>

        <FormGrid className="form-grid">
          <Field className="f">
            <label>% de Avance (0 a 100)</label>
            <Input
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
            <Select value={form.estado || 'En curso'} onChange={(e) => set({ estado: e.target.value })}>
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
        </FormGrid>
      </Surface>

      {intentado && errores.length > 0 && (
        <Surface className="panel mb" role="alert" style={{ borderColor: 'var(--crit, #c0392b)' }}>
          <b>Atención: corrige antes de guardar</b>
          <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
            {errores.map((e) => (
              <li key={e} style={{ fontSize: 13 }}>
                {e}
              </li>
            ))}
          </ul>
        </Surface>
      )}

      <div className="form-foot">
        <Button className="btn ghost" onClick={() => window.history.back()}>
          <Icon name="chevron-left" /> Cancelar
        </Button>
        <Button className="btn pri" onClick={guardar}>
          <Icon name="check" /> {isEdit ? 'Guardar Cambios' : 'Guardar Plan'}
        </Button>
      </div>
    </>
  );
};
