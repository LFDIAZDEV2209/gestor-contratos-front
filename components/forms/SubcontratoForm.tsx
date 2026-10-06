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
import type { Subcontract, Contract } from '../../lib/types';
import { Store, Audit, AuthService } from '../../lib/store';
import { M, companyName } from '../../lib/metrics';
import { money, moneyM, fdate, todayIso, addDays, sum, uid } from '../../lib/format';
import { Icon } from '../icons';

/** Valores de partida del formulario (mismos defaults que tenía el modal original). */
const FORM_DEFAULT: Partial<Subcontract> = {
  contractId: '',
  numero: '',
  contratista: '',
  nit: '',
  objeto: '',
  valor: 0,
  fechaInicio: todayIso(),
  fechaFin: addDays(todayIso(), 30),
  ejecucion: 0,
  estado: 'Activo',
  responsable: '',
  documentos: '',
  riesgos: '',
  obligaciones: ''
};

const ESTADOS = ['Activo', 'Suspendido', 'Terminado', 'Liquidado'];

/** Dato de contexto del contrato principal (resumen en vivo del panel superior). */
const Dato = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) => (
  <div>
    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>
      {label}
    </div>
    <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: tone || 'var(--ink)', marginTop: 2 }}>
      {value}
    </div>
    {sub && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>{sub}</div>}
  </div>
);

/**
 * Formulario de subcontrato en VISTA dedicada (creación y edición) — sin modal.
 * Reproduce la anatomía de referencia (breadcrumb, Surface + resumen de
 * validación en bloque y footer con acciones) y hace explícitas las dos reglas de
 * negocio del expediente: la suma de subcontratos no supera el valor del contrato
 * principal y ninguno termina después de él.
 */
export const SubcontratoForm = ({
  initial,
  onDone
}: {
  initial?: Partial<Subcontract>;
  onDone: (savedId: string) => void;
}) => {
  const cancelar = useFormCancel("/subcontratos");
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState<Partial<Subcontract>>(() =>
    initial ? { ...initial } : { ...FORM_DEFAULT }
  );
  const [intentado, setIntentado] = useState(false);

  const contracts = (Store.all('contracts') as Contract[]).filter((c) => !c.anulado);
  const contractId = form.contractId || '';
  const contrato: Contract | null = contractId
    ? ((Store.get('contracts', contractId) as Contract | null) || null)
    : null;

  const valorContrato = contrato ? M(contrato).valorActual : 0;
  // El registro en edición no se cuenta a sí mismo al calcular lo ya delegado.
  const delegados = contractId
    ? (Store.byContract('subcontracts', contractId) as Subcontract[]).filter((s) => s.id !== form.id)
    : [];
  const delegado = sum(delegados, (s) => Number(s.valor) || 0);
  const disponible = valorContrato - delegado;
  const pctDelegado = valorContrato > 0 ? (delegado / valorContrato) * 100 : 0;
  const finPrincipal = contrato ? contrato.fechaFin || contrato.endDate || '' : '';

  const set = (patch: Partial<Subcontract>) => setForm((f) => ({ ...f, ...patch }));

  // Validación en bloque (reglas del handler original + reglas del Validator.contract)
  const numero = (form.numero || '').trim();
  const contratista = (form.contratista || '').trim();
  const nit = (form.nit || '').trim();
  const objeto = (form.objeto || '').trim();
  const valor = Number(form.valor) || 0;
  const ejecucion = Number(form.ejecucion) || 0;
  const fechaInicio = form.fechaInicio || '';
  const fechaFin = form.fechaFin || '';

  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!contractId) addError("contractId", 'Seleccione el contrato principal al que se vincula el subcontrato.');
  else if (!contrato) addError("contractId", 'El contrato principal seleccionado ya no existe en el portafolio.');
  else if (contrato.anulado)
    addError("contractId", `El contrato principal ${contrato.numero} está anulado y no admite subcontratos.`);
  if (!numero) addError("numero", 'El número del subcontrato es obligatorio.');
  if (!contratista) addError("contratista", 'El nombre del subcontratista es obligatorio.');
  if (!nit) addError("nit", 'El NIT del subcontratista es obligatorio.');
  if (!objeto) addError("objeto", 'El objeto del subcontrato es obligatorio.');
  if (!(valor > 0)) addError("valor", 'El valor del subcontrato debe ser mayor a cero.');
  if (!fechaInicio) addError("fechaInicio", 'La fecha de inicio es obligatoria.');
  if (!fechaFin) addError("fechaFin", 'La fecha de terminación es obligatoria.');
  if (fechaInicio && fechaFin && fechaFin < fechaInicio)
    addError("fechaFin", 'La fecha de terminación debe ser posterior o igual a la de inicio.');
  if (ejecucion < 0 || ejecucion > 100) addError("ejecucion", 'La ejecución debe estar entre 0% y 100%.');
  // Regla de negocio 1: la suma de subcontratos no supera el valor del contrato principal
  if (contrato && valor > 0 && delegado + valor > valorContrato) {
    addError("valor",
      `La suma de subcontratos (${money(delegado + valor)}) supera el valor del contrato principal (${money(
        valorContrato
      )}); solo quedan ${money(disponible)} disponibles.`
    );
  }
  // Regla de negocio 2: ningún subcontrato termina después del contrato principal
  if (contrato && fechaFin && finPrincipal && fechaFin > finPrincipal) {
    addError("fechaFin",
      `La terminación (${fdate(fechaFin)}) no puede ser posterior a la del contrato principal (${fdate(
        finPrincipal
      )}).`
    );
  }

  const guardar = () => {
    setIntentado(true);
    if (!AuthService.guard(isEdit ? 'editar' : 'crear')) return;
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }

    if (isEdit) {
      const id = form.id as string;
      // Snapshot previo: Store.update muta en sitio y falsearía el diff de auditoría
      const before = { ...(Store.get('subcontracts', id) || {}) };
      const patch: Partial<Subcontract> = {
        ...form,
        contractId,
        numero,
        contratista,
        nit,
        objeto,
        valor,
        fechaInicio,
        fechaFin,
        ejecucion
      };
      Store.update('subcontracts', id, patch);
      Audit.diff('Subcontratos', contractId, before, patch, {
        numero: 'Número de subcontrato',
        contratista: 'Subcontratista',
        nit: 'NIT de subcontratista',
        objeto: 'Objeto del subcontrato',
        valor: 'Valor del subcontrato',
        fechaInicio: 'Inicio del subcontrato',
        fechaFin: 'Terminación del subcontrato',
        ejecucion: 'Ejecución del subcontrato',
        estado: 'Estado del subcontrato',
        responsable: 'Responsable del subcontrato'
      });
      notify(`Subcontrato «${numero}» actualizado.`);
      onDone(id);
      return;
    }

    const nuevo: Subcontract = {
      id: uid('SC'),
      contractId,
      numero,
      contratista,
      nit,
      objeto,
      valor,
      fechaInicio,
      fechaFin,
      ejecucion,
      estado: form.estado || 'Activo',
      responsable: form.responsable || '',
      documentos: form.documentos || '',
      riesgos: form.riesgos || '',
      obligaciones: form.obligaciones || ''
    };
    Store.insert('subcontracts', nuevo);
    Audit.log({
      contractId,
      modulo: 'Subcontratos',
      accion: 'Creación',
      campo: 'Nuevo subcontrato ' + numero,
      nuevo: `${contratista} · ${money(valor)}`
    });
    notify(`Subcontrato «${numero}» registrado en el contrato ${contrato?.numero || contractId}.`);
    onDone(nuevo.id);
  };

  return (
    <AccessibleForm errors={fieldErrors} attempted={intentado}>
      <PageHeader className="ph">
        <div>
          <nav aria-label="Ruta de navegación" className="crumb" style={{ width: '100%', marginBottom: 6 }}>
            <Link href="/subcontratos">Subcontratos</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <span aria-current="page">{isEdit ? 'Editar subcontrato' : 'Nuevo subcontrato'}</span>
          </nav>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            {isEdit ? 'Editar Subcontrato' : 'Nuevo Subcontrato'}
          </h1>
          <p style={{ margin: '4px 0 0' }}>
            {isEdit
              ? 'Actualiza los datos del subcontrato; cada cambio queda en la auditoría del sistema.'
              : 'Registra un contrato derivado y vigila que no supere el valor ni el plazo del contrato principal.'}
          </p>
        </div>
      </PageHeader>

      {/* Vínculo contractual: selector + resumen en vivo de las reglas de negocio */}
      <Surface className="panel mb">

        <FormSection title={<>Vínculo contractual</>} icon="file-contract" description={<>{contracts.length} contratos vigentes en el portafolio</>} accent>
          <Field className="f span3">
            <label className="req">Contrato principal</label>
            <Select name="contractId"
              value={contractId}
              disabled={isEdit}
              onChange={(e) => {
                // Al elegir contrato se acota la terminación al plazo del principal:
                // evita que el default (hoy + 30 días) viole la regla cuando el contrato
                // principal vence antes.
                const cid = e.target.value;
                const c = cid ? ((Store.get('contracts', cid) as Contract | null) || null) : null;
                const fin = c ? c.fechaFin || c.endDate || '' : '';
                setForm((f) => {
                  const next = { ...f, contractId: cid };
                  if (fin && next.fechaFin && next.fechaFin > fin) next.fechaFin = fin;
                  return next;
                });
              }}
            >
              <option value="">— Seleccione contrato —</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} · {c.contratista} · {moneyM(M(c).valorActual)}
                </option>
              ))}
            </Select>
            {isEdit && (
              <small style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                El contrato principal no se modifica al editar; registre un nuevo subcontrato si necesita reasignarlo.
              </small>
            )}
          </Field>
        </FormSection>

        {contrato ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 14,
              marginTop: 14,
              padding: '14px 16px',
              background: 'var(--surface-2)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r)'
            }}
          >
            <Dato
              label="Valor del contrato"
              value={moneyM(valorContrato)}
              sub={`${money(valorContrato)} · ${companyName(contrato.companyId)}`}
            />
            <Dato label="Ya subcontratado" value={moneyM(delegado)} sub={`${delegados.length} subcontrato(s)`} />
            <Dato
              label="Disponible"
              value={moneyM(disponible)}
              sub={money(disponible)}
              tone={disponible < 0 ? 'var(--crit)' : undefined}
            />
            <Dato
              label="Plazo principal"
              value={`${fdate(contrato.fechaInicio)} → ${fdate(finPrincipal)}`}
              sub="Vigencia máxima del subcontrato"
            />
            <div style={{ gridColumn: '1 / -1' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11.5,
                  color: 'var(--muted)',
                  marginBottom: 4
                }}
              >
                <span>Grado de delegación sobre el valor del contrato</span>
              </div>
              <PBar value={pctDelegado} />
            </div>
          </div>
        ) : (
          <p style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            Seleccione un contrato principal para consultar su valor disponible y su plazo.
          </p>
        )}
      </Surface>

      {/* Datos del subcontrato */}
      <Surface className="panel mb">

        <FormSection title={<>Datos del subcontrato</>} icon="diagram-project" description={<>Los campos con * son obligatorios</>} accent>
          <Field className="f">
            <label className="req">Número de subcontrato</label>
            <Input name="numero"
              value={form.numero || ''}
              placeholder="Ej. SC-001"
              onChange={(e) => set({ numero: e.target.value })}
            />
          </Field>

          <Field className="f">
            <label>Estado</label>
            <Select name="estado" value={form.estado || 'Activo'} onChange={(e) => set({ estado: e.target.value })}>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
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
            <label className="req">Subcontratista</label>
            <Input name="contratista"
              value={form.contratista || ''}
              placeholder="Nombre o razón social"
              onChange={(e) => set({ contratista: e.target.value })}
            />
          </Field>

          <Field className="f">
            <label className="req">NIT</label>
            <Input name="nit"
              value={form.nit || ''}
              placeholder="900.000.000-0"
              onChange={(e) => set({ nit: e.target.value })}
            />
          </Field>

          <Field className="f">
            <label className="req">Valor</label>
            <Input name="valor"
              type="number"
              min={0}
              value={form.valor ?? 0}
              onChange={(e) => set({ valor: Number(e.target.value) })}
            />
            <small style={{ fontSize: 11.5, color: disponible < valor ? 'var(--crit)' : 'var(--muted)' }}>
              Disponible en el contrato: {money(disponible)}
            </small>
          </Field>

          <Field className="f">
            <label className="req">Fecha de inicio</label>
            <Input name="fechaInicio"
              type="date"
              value={fechaInicio}
              onChange={(e) => set({ fechaInicio: e.target.value })}
            />
          </Field>

          <Field className="f">
            <label className="req">Fecha de terminación</label>
            <Input name="fechaFin" type="date" value={fechaFin} onChange={(e) => set({ fechaFin: e.target.value })} />
            {finPrincipal && (
              <small style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                Máximo hasta {fdate(finPrincipal)} (contrato principal).
              </small>
            )}
          </Field>

          <Field className="f">
            <label>Ejecución (%)</label>
            <Input name="ejecucion"
              type="number"
              min={0}
              max={100}
              value={form.ejecucion ?? 0}
              onChange={(e) => set({ ejecucion: Number(e.target.value) })}
            />
            <small style={{ fontSize: 11.5, color: 'var(--muted)' }}>Avance inicial entre 0 y 100.</small>
          </Field>

          <Field className="f span3">
            <label className="req">Objeto del subcontrato</label>
            <Textarea name="objeto"
              rows={3}
              value={form.objeto || ''}
              placeholder="Detalle de actividades a ejecutar..."
              onChange={(e) => set({ objeto: e.target.value })}
            />
          </Field>
        </FormSection>
      </Surface>

      <div className="form-foot">
        <Button className="btn ghost" onClick={cancelar}>
          <Icon name="chevron-left" /> Cancelar
        </Button>
        <Button className="btn pri" onClick={guardar}>
          <Icon name="check" /> {isEdit ? 'Guardar Cambios' : 'Guardar Subcontrato'}
        </Button>
      </div>
    </AccessibleForm>
  );
};
