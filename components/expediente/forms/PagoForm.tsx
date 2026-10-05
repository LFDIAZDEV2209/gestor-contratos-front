'use client';
import { useState } from 'react';
import { Input } from '../../ui/Controls';
import { notify } from '../../ui/Feedback';
import { FormGrid, Field } from '../../ui/Workspace';
import { Store, AuthService, Audit } from '../../../lib/store';
import { money, todayIso, uid } from '../../../lib/format';
import type { Payment } from '../../../lib/types';
import { ExpedienteFormShell, createFieldValidation } from './ExpedienteFormShell';

type FormState = {
  numero: string;
  factura: string;
  fecha: string;
  periodo: string;
  bruto: number;
  iva: number;
  retenciones: number;
  soporte: string;
};

/**
 * VISTA dedicada de registro de pagos/cuentas de cobro (antes modal en TabPagos).
 * Reglas del handler original: número y bruto obligatorios; neto = bruto + IVA − retenciones;
 * IVA precalculado al 19 % al teclear el bruto; entra «Pendiente».
 * Endurecimiento acordado: número con trim, bruto > 0.
 */
export const PagoForm = ({ cid, onDone }: { cid: string; onDone: () => void }) => {
  const [form, setForm] = useState<FormState>({
    numero: '',
    factura: '',
    fecha: todayIso(),
    periodo: '',
    bruto: 0,
    iva: 0,
    retenciones: 0,
    soporte: ''
  });
  const [intentado, setIntentado] = useState(false);
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const calcNeto = Number(form.bruto) + Number(form.iva) - Number(form.retenciones);
  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!form.numero.trim()) addError("numero", 'El número de pago o cuenta de cobro es obligatorio (radicado interno).');
  if (!form.bruto || Number(form.bruto) <= 0)
    addError("bruto", 'El valor bruto debe ser positivo: sin él no se liquidan IVA, retenciones ni neto.');

  const guardar = () => {
    setIntentado(true);
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }
    if (!AuthService.guard('crear')) return;

    const neto = Number(form.bruto) + Number(form.iva) - Number(form.retenciones);
    const payObj: Payment = {
      id: uid('PG'),
      contractId: cid,
      numero: form.numero.trim(),
      factura: form.factura,
      fecha: form.fecha,
      periodo: form.periodo,
      bruto: Number(form.bruto),
      iva: Number(form.iva),
      retenciones: Number(form.retenciones),
      neto,
      estado: 'Pendiente',
      soporte: form.soporte.trim() || `${form.numero.trim()}.pdf`
    };

    Store.insert('payments', payObj);
    Audit.log({
      contractId: cid,
      modulo: 'Pagos',
      accion: 'Creación',
      campo: 'Pago ' + payObj.numero,
      nuevo: money(neto)
    });
    notify('Pago registrado (Pendiente)');
    onDone();
  };

  return (
    <ExpedienteFormShell
      fieldErrors={fieldErrors}
      cid={cid}
      tab="pagos"
      paso="Registrar pago"
      title="Registrar pago o cuenta de cobro"
      description="Cuenta de cobro u orden de pago del periodo; entra «Pendiente» y pasa por Aprobado → Pagado desde la pestaña."
      errores={errores}
      intentado={intentado}
      onSubmit={guardar}
      submitLabel="Guardar pago"
      submitIcon="check"
      onCancel={onDone}
      nota={
        <div
          className="calc p-3 rounded flex justify-between items-center text-sm mb"
          style={{ background: 'var(--bg-sub)', border: '1px solid var(--line)' }}
        >
          <span>
            Neto a pagar: <b className="mono">{money(calcNeto)}</b>
          </span>
          <span className="small muted mono">Bruto + IVA − Retenciones</span>
        </div>
      }
    >
      <FormGrid className="form-grid">
        <Field className="f">
          <label className="req">Número de pago</label>
          <Input name="numero" value={form.numero} onChange={(e) => set({ numero: e.target.value })} placeholder="Ej. OP-044-01" />
        </Field>
        <Field className="f">
          <label>Factura de venta</label>
          <Input name="factura" value={form.factura} onChange={(e) => set({ factura: e.target.value })} placeholder="Ej. FE-8891" />
        </Field>
        <Field className="f">
          <label className="req">Fecha de radicación</label>
          <Input name="fecha" type="date" value={form.fecha} onChange={(e) => set({ fecha: e.target.value })} />
        </Field>
        <Field className="f">
          <label>Periodo de ejecución (AAAA-MM)</label>
          <Input name="periodo" type="month" value={form.periodo} onChange={(e) => set({ periodo: e.target.value })} />
        </Field>
        <Field className="f">
          <label className="req">Valor bruto</label>
          <Input name="bruto"
            type="number"
            min="0"
            value={form.bruto || ''}
            onChange={(e) => {
              const b = Number(e.target.value);
              set({ bruto: b, iva: Math.round(b * 0.19) });
            }}
          />
        </Field>
        <Field className="f">
          <label>IVA</label>
          <Input name="iva"
            type="number"
            min="0"
            value={form.iva || ''}
            onChange={(e) => set({ iva: Number(e.target.value) })}
          />
        </Field>
        <Field className="f">
          <label>Retenciones (ReteFuente / ReteICA)</label>
          <Input name="retenciones"
            type="number"
            min="0"
            value={form.retenciones || ''}
            onChange={(e) => set({ retenciones: Number(e.target.value) })}
          />
        </Field>
        <Field className="f">
          <label>Archivo soporte</label>
          <Input name="soporte"
            value={form.soporte}
            onChange={(e) => set({ soporte: e.target.value })}
            placeholder="Factura_01.pdf"
          />
        </Field>
      </FormGrid>
    </ExpedienteFormShell>
  );
};
