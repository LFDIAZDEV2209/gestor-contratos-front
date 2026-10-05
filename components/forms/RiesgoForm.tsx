'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input, Select, Textarea } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, FormGrid, Field } from '../ui/Workspace';
import type { Risk, Contract } from '../../lib/types';
import { Store, Audit, AuthService } from '../../lib/store';
import { activeContracts } from '../../lib/metrics';
import { CAT } from '../../lib/catalog';
import { Icon } from '../icons';

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
 * Reproduce la anatomía de referencia (breadcrumb, Surface + FormGrid, validación
 * en bloque y footer con acciones). El nivel sigue siendo probabilidad × impacto.
 */
export const RiesgoForm = ({
  initial,
  onDone
}: {
  initial?: Partial<Risk>;
  onDone: (savedId: string) => void;
}) => {
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
  const errores: string[] = [];
  if (!contractId) {
    errCampo.contractId = 'Selecciona el contrato al que se vincula el riesgo.';
    errores.push('Seleccione el contrato al que se vincula el riesgo.');
  } else if (!contrato) {
    errCampo.contractId = 'El contrato seleccionado ya no existe en el portafolio.';
    errores.push('El contrato seleccionado ya no existe en el portafolio.');
  }
  if (!descripcion) {
    errCampo.descripcion = 'La descripción del riesgo es obligatoria.';
    errores.push('La descripción del riesgo es obligatoria.');
  }
  if (probabilidad < 1 || probabilidad > 5) {
    errCampo.probabilidad = 'La probabilidad debe estar entre 1 y 5.';
    errores.push('La probabilidad debe estar entre 1 y 5.');
  }
  if (impacto < 1 || impacto > 5) {
    errCampo.impacto = 'El impacto debe estar entre 1 y 5.';
    errores.push('El impacto debe estar entre 1 y 5.');
  }

  const err = (campo: string) => (intentado ? errCampo[campo] : undefined);
  // Nivel calculado en vivo (probabilidad × impacto) con su severidad institucional
  const nivelCalc = probabilidad * impacto;
  const nivelSev = nivelCalc >= 15 ? 'Extremo' : nivelCalc >= 10 ? 'Alto' : nivelCalc >= 5 ? 'Moderado' : 'Bajo';

  const guardar = () => {
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
      onDone(id);
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
    onDone(nuevo.id);
  };

  return (
    <>
      <PageHeader className="ph">
        <div>
          <div className="crumb" style={{ width: '100%', marginBottom: 6 }}>
            <Link href="/riesgos">Riesgos</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <span>{isEdit ? 'Editar riesgo' : 'Nuevo riesgo'}</span>
          </div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
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
        <div className="panel-h">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="file-contract" size={16} /> Vínculo contractual
          </h3>
          <span className="sub">{contracts.length} contratos vigentes en el portafolio</span>
        </div>

        <FormGrid className="form-grid">
          <Field className={`f span3${err('contractId') ? ' err' : ''}`}>
            <label className="req">Contrato</label>
            <Select
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
              <span className="emsg" id="err-rcontrato">
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
        </FormGrid>
      </Surface>

      {/* Evaluación del riesgo */}
      <Surface className="panel mb">
        <div className="panel-h">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="triangle-exclamation" size={16} /> Evaluación del riesgo
          </h3>
          <span className="sub">Los campos con * son obligatorios</span>
        </div>

        <FormGrid className="form-grid">
          <Field className="f">
            <label className="req">Categoría</label>
            <Select
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
            <Select value={form.estado || 'Abierto'} onChange={(e) => set({ estado: e.target.value })}>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
          </Field>

          <Field className={`f${err('probabilidad') ? ' err' : ''}`}>
            <label className="req">Probabilidad (1 a 5)</label>
            <Input
              type="number"
              min={1}
              max={5}
              value={probabilidad}
              aria-invalid={err('probabilidad') ? true : undefined}
              aria-describedby={err('probabilidad') ? 'err-rprob' : undefined}
              onChange={(e) => set({ probabilidad: Number(e.target.value) })}
            />
            {err('probabilidad') ? (
              <span className="emsg" id="err-rprob">
                {err('probabilidad')}
              </span>
            ) : (
              <small style={{ fontSize: 11.5, color: 'var(--muted)' }}>1 = remota · 5 = casi segura</small>
            )}
          </Field>

          <Field className={`f${err('impacto') ? ' err' : ''}`}>
            <label className="req">Impacto (1 a 5)</label>
            <Input
              type="number"
              min={1}
              max={5}
              value={impacto}
              aria-invalid={err('impacto') ? true : undefined}
              aria-describedby={err('impacto') ? 'err-rimp' : undefined}
              onChange={(e) => set({ impacto: Number(e.target.value) })}
            />
            {err('impacto') ? (
              <span className="emsg" id="err-rimp">
                {err('impacto')}
              </span>
            ) : (
              <small style={{ fontSize: 11.5, color: 'var(--muted)' }}>1 = menor · 5 = crítico</small>
            )}
          </Field>

          <Field className={`f${err('descripcion') ? ' err' : ''}`}>
            <label className="req">Descripción del riesgo</label>
            <Textarea
              rows={3}
              value={form.descripcion || ''}
              aria-invalid={err('descripcion') ? true : undefined}
              aria-describedby={err('descripcion') ? 'err-rdesc' : undefined}
              placeholder="Identificación del evento o riesgo contractual"
              onChange={(e) => set({ descripcion: e.target.value })}
            />
            {err('descripcion') && (
              <span className="emsg" id="err-rdesc">
                {err('descripcion')}
              </span>
            )}
          </Field>
        </FormGrid>
      </Surface>

      {/* Mitigación y seguimiento */}
      <Surface className="panel mb">
        <div className="panel-h">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="shield-check" size={16} /> Mitigación y seguimiento
          </h3>
          <span className="sub">
            Nivel calculado: P{probabilidad || '—'} × I{impacto || '—'} ={' '}
            <b style={{ color: 'var(--ink-2)' }}>{nivelCalc}</b> ({nivelSev})
          </span>
        </div>

        <FormGrid className="form-grid">
          <Field className="f span3">
            <label>Medidas de mitigación</label>
            <Textarea
              rows={3}
              value={form.mitigacion || ''}
              placeholder="Acciones preventivas o correctivas implementadas"
              onChange={(e) => set({ mitigacion: e.target.value })}
            />
          </Field>

          <Field className="f span3">
            <label>Responsable del monitoreo</label>
            <Input
              value={form.responsable || ''}
              placeholder="Nombre del responsable"
              onChange={(e) => set({ responsable: e.target.value })}
            />
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
          <Icon name="check" /> {isEdit ? 'Guardar Cambios' : 'Guardar Riesgo'}
        </Button>
      </div>
    </>
  );
};
