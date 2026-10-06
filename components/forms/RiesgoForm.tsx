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
import type { Risk, Contract } from '../../lib/types';
import { Store, Audit, AuthService } from '../../lib/store';
import { activeContracts } from '../../lib/metrics';
import { CAT } from '../../lib/catalog';
import { Icon } from '../icons';
import { useSoportes } from '../ui/Soportes';

/** Valores de partida del formulario (mismos defaults que tenía el modal original). */
const FORM_DEFAULT: Partial<Risk> = {
  contractId: '',
  categoria: '',
  descripcion: '',
  probabilidad: 3,
  impacto: 3,
  mitigacion: '',
  responsable: '',
  estado: 'Abierto'
};

const ESTADOS = ['Abierto', 'Mitigado', 'Cerrado'];

/**
 * Formulario de riesgo en VISTA dedicada (creación y edición) — sin modal.
 * Reproduce la anatomía de referencia (breadcrumb, Surface + validación
 * en bloque y footer con acciones). El nivel sigue siendo probabilidad × impacto.
 */
export const RiesgoForm = ({
  initial,
  onDone
}: {
  initial?: Partial<Risk>;
  onDone: (savedId: string) => void;
}) => {
  const cancelar = useFormCancel("/riesgos");
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState<Partial<Risk>>(() =>
    initial ? { ...initial } : { ...FORM_DEFAULT }
  );
  const [intentado, setIntentado] = useState(false);

  const categories = CAT('categoriasRiesgo');
  const contractId = form.contractId || '';
  const contracts: Contract[] = activeContracts();
  // Al editar, el contrato de origen puede haberse anulado: se conserva en el select
  // para no perder la vinculación del registro.
  const contratoOrigen = contractId ? Store.get('contracts', contractId) : null;
  const opciones = contratoOrigen && !contracts.some((c) => c.id === contractId)
    ? [{ ...(contratoOrigen as Contract) }, ...contracts]
    : contracts;
  const contrato: Contract | null = contratoOrigen ? (contratoOrigen as Contract) : null;

  const set = (patch: Partial<Risk>) => setForm((f) => ({ ...f, ...patch }));

  // Validación en bloque (reglas del handler original + salvaguardas de rango)
  const descripcion = (form.descripcion || '').trim();
  const probabilidad = Number(form.probabilidad) || 0;
  const impacto = Number(form.impacto) || 0;

  const errCampo: Record<string, string> = {};
  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!contractId) {
    errCampo.contractId = 'Selecciona el contrato al que se vincula el riesgo.';
    addError("contractId", 'Seleccione el contrato al que se vincula el riesgo.');
  } else if (!contrato) {
    errCampo.contractId = 'El contrato seleccionado ya no existe en el portafolio.';
    addError("contractId", 'El contrato seleccionado ya no existe en el portafolio.');
  }
  if (!descripcion) {
    errCampo.descripcion = 'La descripción del riesgo es obligatoria.';
    addError("descripcion", 'La descripción del riesgo es obligatoria.');
  }
  if (probabilidad < 1 || probabilidad > 5) {
    errCampo.probabilidad = 'La probabilidad debe estar entre 1 y 5.';
    addError("probabilidad", 'La probabilidad debe estar entre 1 y 5.');
  }
  if (impacto < 1 || impacto > 5) {
    errCampo.impacto = 'El impacto debe estar entre 1 y 5.';
    addError("impacto", 'El impacto debe estar entre 1 y 5.');
  }

  const err = (campo: string) => (intentado ? errCampo[campo] : undefined);
  // Nivel calculado en vivo (probabilidad × impacto) con su severidad institucional
  const nivelCalc = probabilidad * impacto;
  const nivelSev = nivelCalc >= 15 ? 'Extremo' : nivelCalc >= 10 ? 'Alto' : nivelCalc >= 5 ? 'Moderado' : 'Bajo';

  const sop = useSoportes(() => contractId, '/riesgos');

  const guardar = async () => {
    if (sop.bloqueado()) return;
    setIntentado(true);
    if (!AuthService.guard(isEdit ? 'editar' : 'crear')) return;
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }

    const nivel = probabilidad * impacto;
    const patch: Partial<Risk> = {
      ...form,
      contractId,
      categoria: form.categoria || categories[0] || 'Operativo',
      descripcion,
      probabilidad,
      impacto,
      estado: form.estado || 'Abierto',
      nivel
    };

    if (isEdit) {
      const id = form.id as string;
      // Snapshot previo: Store.update muta en sitio y falsearía el diff de auditoría
      const before = { ...(Store.get('risks', id) || {}) };
      Store.update('risks', id, patch);
      Audit.diff('Riesgos', contractId, before, patch, {
        categoria: 'Categoría del riesgo',
        descripcion: 'Descripción del riesgo',
        probabilidad: 'Probabilidad del riesgo',
        impacto: 'Impacto del riesgo',
        nivel: 'Nivel del riesgo',
        mitigacion: 'Mitigación del riesgo',
        responsable: 'Responsable del riesgo',
        estado: 'Estado del riesgo'
      });
      notify(`Riesgo «${descripcion.slice(0, 60)}» actualizado.`);
      await sop.finalizar(() => onDone(id));
      return;
    }

    // Store.insert asigna el id con el prefijo propio de la colección (como el modal original)
    const nuevo: Risk = { ...patch } as Risk;
    Store.insert('risks', nuevo);
    Audit.log({
      contractId,
      modulo: 'Riesgos',
      accion: 'Creación',
      campo: 'Riesgo',
      nuevo: descripcion
    });
    notify(`Riesgo «${descripcion.slice(0, 60)}» registrado en el contrato ${contrato?.numero || contractId}.`);
    await sop.finalizar(() => onDone(nuevo.id));
  };

  return (
    <AccessibleForm errors={fieldErrors} attempted={intentado}>
      <PageHeader className="ph">
        <div>
          <nav aria-label="Ruta de navegación" className="crumb" style={{ width: '100%', marginBottom: 6 }}>
            <Link href="/riesgos">Riesgos</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <span aria-current="page">{isEdit ? 'Editar riesgo' : 'Nuevo riesgo'}</span>
          </nav>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <span className="form-shell-icon" aria-hidden="true"><Icon name="shield" size={22} /></span>
            {isEdit ? 'Editar Riesgo' : 'Nuevo Riesgo'}
          </h1>
          <p style={{ margin: '4px 0 0' }}>
            {isEdit
              ? 'Actualiza la evaluación y el plan de mitigación; cada cambio queda en la auditoría del sistema.'
              : 'Registra un evento de riesgo contractual, su probabilidad × impacto y el responsable del monitoreo.'}
          </p>
        </div>
      </PageHeader>

      {/* Vínculo contractual */}
      <Surface className="panel mb">

        <FormSection title={<>Vínculo contractual</>} icon="file-contract" description={<>{contracts.length} contratos vigentes en el portafolio</>} accent>
          <Field className={`f span3${err('contractId') ? ' err' : ''}`}>
            <label className="req">Contrato</label>
            <Select name="contractId"
              value={contractId}
              aria-invalid={err('contractId') ? true : undefined}
              aria-describedby={err('contractId') ? 'err-rcontrato' : undefined}
              onChange={(e) => set({ contractId: e.target.value })}
            >
              <option value="">— Seleccione contrato —</option>
              {opciones.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} — {c.contratista}
                </option>
              ))}
            </Select>
            {err('contractId') ? (
              <span className="emsg" id="err-rcontrato"><span aria-hidden="true"><Icon name="alert-circle" size={13} /></span>
                {err('contractId')}
              </span>
            ) : (
              contrato && (
                <small style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                  {contrato.objeto || contrato.obj || 'Sin objeto registrado'}.
                </small>
              )
            )}
          </Field>
        </FormSection>
      </Surface>

      {/* Evaluación del riesgo */}
      <Surface className="panel mb">

        <FormSection title={<>Evaluación del riesgo</>} icon="triangle-exclamation" description={<>Los campos con * son obligatorios</>} accent>
          <Field className="f">
            <label className="req">Categoría</label>
            <Select name="categoria"
              value={form.categoria || ''}
              onChange={(e) => set({ categoria: e.target.value })}
            >
              {!form.categoria && <option value="">— Seleccione categoría —</option>}
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Select>
          </Field>

          <Field className="f">
            <label>Estado</label>
            <Select name="estado" value={form.estado || 'Abierto'} onChange={(e) => set({ estado: e.target.value })}>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
          </Field>

          <Field className={`f${err('probabilidad') ? ' err' : ''}`}>
            <label className="req">Probabilidad (1 a 5)</label>
            <Input name="probabilidad"
              type="number"
              min={1}
              max={5}
              value={probabilidad}
              aria-invalid={err('probabilidad') ? true : undefined}
              aria-describedby={err('probabilidad') ? 'err-rprob' : undefined}
              onChange={(e) => set({ probabilidad: Number(e.target.value) })}
            />
            {err('probabilidad') ? (
              <span className="emsg" id="err-rprob"><span aria-hidden="true"><Icon name="alert-circle" size={13} /></span>
                {err('probabilidad')}
              </span>
            ) : (
              <small style={{ fontSize: 11.5, color: 'var(--muted)' }}>1 = remota · 5 = casi segura</small>
            )}
          </Field>

          <Field className={`f${err('impacto') ? ' err' : ''}`}>
            <label className="req">Impacto (1 a 5)</label>
            <Input name="impacto"
              type="number"
              min={1}
              max={5}
              value={impacto}
              aria-invalid={err('impacto') ? true : undefined}
              aria-describedby={err('impacto') ? 'err-rimp' : undefined}
              onChange={(e) => set({ impacto: Number(e.target.value) })}
            />
            {err('impacto') ? (
              <span className="emsg" id="err-rimp"><span aria-hidden="true"><Icon name="alert-circle" size={13} /></span>
                {err('impacto')}
              </span>
            ) : (
              <small style={{ fontSize: 11.5, color: 'var(--muted)' }}>1 = menor · 5 = crítico</small>
            )}
          </Field>

          <Field className={`f${err('descripcion') ? ' err' : ''}`}>
            <label className="req">Descripción del riesgo</label>
            <Textarea name="descripcion"
              rows={3}
              value={form.descripcion || ''}
              aria-invalid={err('descripcion') ? true : undefined}
              aria-describedby={err('descripcion') ? 'err-rdesc' : undefined}
              placeholder="Identificación del evento o riesgo contractual"
              onChange={(e) => set({ descripcion: e.target.value })}
            />
            {err('descripcion') && (
              <span className="emsg" id="err-rdesc"><span aria-hidden="true"><Icon name="alert-circle" size={13} /></span>
                {err('descripcion')}
              </span>
            )}
          </Field>
        </FormSection>
      </Surface>

      {/* Mitigación y seguimiento */}
      <Surface className="panel mb">

        <FormSection title={<>Mitigación y seguimiento</>} icon="shield-check" description={<>Nivel calculado: P{probabilidad || '—'} × I{impacto || '—'} ={' '}
            <b style={{ color: 'var(--ink-2)' }}>{nivelCalc}</b> ({nivelSev})</>} accent>
          <Field className="f span3">
            <label>Medidas de mitigación</label>
            <Textarea name="mitigacion"
              rows={3}
              value={form.mitigacion || ''}
              placeholder="Acciones preventivas o correctivas implementadas"
              onChange={(e) => set({ mitigacion: e.target.value })}
            />
          </Field>

          <Field className="f span3">
            <label>Responsable del monitoreo</label>
            <Input name="responsable"
              value={form.responsable || ''}
              placeholder="Nombre del responsable"
              onChange={(e) => set({ responsable: e.target.value })}
            />
          </Field>
        </FormSection>
      </Surface>

      {sop.node}

      <div className="form-foot">
        <Button className="btn ghost" onClick={cancelar}>
          <Icon name="chevron-left" /> Cancelar
        </Button>
        <Button className="btn pri" onClick={guardar} loading={sop.subiendo}>
          <Icon name="check" /> {isEdit ? 'Guardar Cambios' : 'Guardar Riesgo'}
        </Button>
      </div>
    </AccessibleForm>
  );
};
