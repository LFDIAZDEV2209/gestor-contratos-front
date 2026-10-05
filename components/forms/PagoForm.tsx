'use client';

import { useState } from 'react';
import { useFormCancel } from './useFormCancel';
import { AccessibleForm, createFieldValidation } from './AccessibleForm';
import Link from 'next/link';
import { Input, Select } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, FormGrid, Field } from '../ui/Workspace';
import type { Payment } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { M } from '../../lib/metrics';
import { money, moneyM, todayIso, uid } from '../../lib/format';
import { Kpi } from '../ui/Kpi';
import { Icon } from '../icons';

/**
 * Registro de pago o cuenta de cobro en VISTA dedicada (reemplaza al modal de
 * PagosView). Neto = bruto + IVA − retenciones; el estado inicial sigue siendo
 * Pendiente y la aprobación/desembolso permanecen como acciones breves.
 */
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const PagoForm = ({ onDone }: { onDone: () => void }) => {
  const cancelar = useFormCancel("/pagos");
  const [intentado, setIntentado] = useState(false);
  const [form, setForm] = useState({
    contractId: '',
    numero: '',
    factura: '',
    fecha: todayIso(),
    periodo: todayIso().slice(0, 7),
    bruto: 0,
    iva: 0,
    retenciones: 0,
    soporte: ''
  });

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const contracts = Store.all('contracts').filter((c) => !c.anulado);
  const seleccion = contracts.find((c) => c.id === form.contractId);
  const mSel = seleccion ? M(seleccion) : null;

  const numero = form.numero.trim();
  const neto = Number(form.bruto) + Number(form.iva) - Number(form.retenciones);

  const errCampo: Record<string, string> = {};
  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!form.contractId) {
    errCampo.contractId = 'Selecciona el contrato al que se imputa el pago.';
    addError("contractId", 'El contrato es obligatorio.');
  }
  if (!numero) {
    errCampo.numero = 'Indica el número del pago o de la cuenta de cobro.';
    addError("numero", 'El número de pago es obligatorio.');
  }
  if (!form.bruto) {
    errCampo.bruto = 'Registra el valor bruto (antes de IVA).';
    addError("bruto", 'El valor bruto es obligatorio.');
  }
  if (!form.fecha) {
    errCampo.fecha = 'Indica la fecha del pago o de la cuenta.';
    addError("fecha", 'La fecha es obligatoria.');
  }

  const guardar = () => {
    setIntentado(true);
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      requestAnimationFrame(() => {
        const el = document.querySelector('.f.err, .err') as HTMLElement | null;
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const ctrl = el?.querySelector('input, select, textarea') as HTMLElement | null;
        ctrl?.focus({ preventScroll: true });
      });
      return;
    }
    if (!AuthService.guard('crear')) return;

    const payObj: Payment = {
      id: uid('PG'),
      contractId: form.contractId,
      numero,
      factura: form.factura.trim(),
      fecha: form.fecha,
      periodo: form.periodo,
      bruto: Number(form.bruto),
      iva: Number(form.iva),
      retenciones: Number(form.retenciones),
      neto,
      estado: 'Pendiente',
      soporte: form.soporte || `${numero}.pdf`
    };

    Store.insert('payments', payObj);
    Audit.log({
      contractId: form.contractId,
      modulo: 'Pagos',
      accion: 'Creación',
      campo: 'Nuevo pago ' + payObj.numero,
      nuevo: `${money(payObj.neto)} (Factura ${payObj.factura || 's/n'})`
    });

    notify(`Pago «${numero}» registrado por ${money(neto)} (Pendiente).`);
    onDone();
  };

  const err = (campo: string) => (intentado ? errCampo[campo] : undefined);

  return (
    <AccessibleForm errors={fieldErrors} attempted={intentado}>
      <PageHeader className="ph">
        <div>
          <nav aria-label="Ruta de navegación" className="crumb" style={{ width: '100%', marginBottom: 6 }}>
            <Link href="/pagos">Pagos</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <span aria-current="page">Nuevo pago</span>
          </nav>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            Registrar pago o cuenta de cobro
          </h1>
          <p style={{ margin: '4px 0 0' }}>
            Registra la cuenta con su factura, IVA y retenciones; el valor neto se calcula solo y
            el pago entra en cola de revisión y aprobación.
          </p>
        </div>
      </PageHeader>

      <Surface className="panel mb">
        <div className="panel-h">
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <Icon name="money-check-dollar" /> Identificación del pago
            </h2>
            <span className="sub small muted">Contrato, referencia y fechas del desembolso</span>
          </div>
        </div>

        <FormGrid className="form-grid">
          <Field className={`f span3${err('contractId') ? ' err' : ''}`}>
            <label className="req">Contrato</label>
            <Select name="contractId"
              value={form.contractId}
              onChange={(e) => set({ contractId: e.target.value })}
              aria-describedby={err('contractId') ? 'err-pcontrato' : undefined}
            >
              <option value="">— Seleccione contrato —</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} · {c.contratista} · Saldo: {moneyM(M(c).saldo)}
                </option>
              ))}
            </Select>
            {err('contractId') && (
              <span className="emsg" id="err-pcontrato">
                {err('contractId')}
              </span>
            )}
          </Field>

          <Field className={`f${err('numero') ? ' err' : ''}`}>
            <label className="req">Número de pago o cuenta</label>
            <Input name="numero"
              value={form.numero}
              placeholder="Ej. Pago 03"
              onChange={(e) => set({ numero: e.target.value })}
              aria-describedby={err('numero') ? 'err-pnumero' : undefined}
            />
            {err('numero') && (
              <span className="emsg" id="err-pnumero">
                {err('numero')}
              </span>
            )}
          </Field>

          <Field className="f">
            <label>Número de factura</label>
            <Input name="factura"
              value={form.factura}
              placeholder="Ej. FE-10492"
              onChange={(e) => set({ factura: e.target.value })}
            />
          </Field>

          <Field className={`f${err('fecha') ? ' err' : ''}`}>
            <label className="req">Fecha</label>
            <Input name="fecha"
              type="date"
              value={form.fecha}
              onChange={(e) => set({ fecha: e.target.value })}
              aria-describedby={err('fecha') ? 'err-pfecha' : undefined}
            />
            {err('fecha') && (
              <span className="emsg" id="err-pfecha">
                {err('fecha')}
              </span>
            )}
          </Field>

          <Field className="f">
            <label>Periodo de facturación</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <Select name="periodo"
                value={String(Number(form.periodo.split('-')[1] || '1') - 1)}
                onChange={(e) =>
                  set({ periodo: `${form.periodo.split('-')[0]}-${String(Number(e.target.value) + 1).padStart(2, '0')}` })
                }
                aria-label="Mes de facturación"
              >
                {MESES.map((m, i) => (
                  <option key={m} value={String(i)}>
                    {m}
                  </option>
                ))}
              </Select>
              <Select name="periodo"
                value={form.periodo.split('-')[0]}
                onChange={(e) => set({ periodo: `${e.target.value}-${form.periodo.split('-')[1]}` })}
                aria-label="Año de facturación"
              >
                {[-1, 0, 1].map((d) => String(Number(todayIso().slice(0, 4)) + d)).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </div>
          </Field>
        </FormGrid>
      </Surface>

      <Surface className="panel mb">
        <div className="panel-h">
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <Icon name="scale-balanced" /> Valores y retenciones
            </h2>
            <span className="sub small muted">Neto = bruto + IVA − retenciones</span>
          </div>
        </div>

        <FormGrid className="form-grid">
          <Field className={`f${err('bruto') ? ' err' : ''}`}>
            <label className="req">Valor bruto (antes de IVA)</label>
            <Input name="bruto"
              type="number"
              value={form.bruto}
              placeholder="Ej. 10000000"
              onChange={(e) => set({ bruto: Number(e.target.value) })}
              aria-describedby={err('bruto') ? 'err-pbruto' : undefined}
            />
            {err('bruto') ? (
              <span className="emsg" id="err-pbruto">
                {err('bruto')}
              </span>
            ) : (
              <span className="hint">{form.bruto ? money(form.bruto) : 'Cifra en pesos colombianos (COP).'}</span>
            )}
          </Field>

          <Field className="f">
            <label>IVA (19 % o aplicable)</label>
            <Input name="iva"
              type="number"
              value={form.iva}
              onChange={(e) => set({ iva: Number(e.target.value) })}
            />
          </Field>

          <Field className="f">
            <label>Retenciones tributarias</label>
            <Input name="retenciones"
              type="number"
              value={form.retenciones}
              onChange={(e) => set({ retenciones: Number(e.target.value) })}
            />
          </Field>

          <Field className="f span3">
            <label>Valor neto a pagar</label>
            <Input className="inp font-bold" value={money(neto)} readOnly style={{ background: 'var(--bg-sub)' }} />
            <span className="hint">Calculado automáticamente a partir del bruto, el IVA y las retenciones.</span>
          </Field>

          <Field className="f span3">
            <label>Documento soporte (factura / cuenta)</label>
            <Input name="soporte"
              value={form.soporte}
              placeholder="Nombre del archivo (ej. factura_pago_03.pdf)"
              onChange={(e) => set({ soporte: e.target.value })}
            />
            <span className="hint">
              {form.soporte
                ? 'Se registra como documento soporte del pago (simulado, sin transferencia real).'
                : 'Si se deja vacío se genera «' + (numero || 'pago') + '.pdf». No se realiza ninguna transferencia real.'}
            </span>
          </Field>
        </FormGrid>
      </Surface>

      {seleccion && mSel && (
        <Surface className="panel mb">
          <div className="panel-h">
            <div>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <Icon name="file-signature" /> Contexto del contrato
              </h2>
              <span className="sub small muted">
                {seleccion.numero} · {seleccion.contratista}
              </span>
            </div>
          </div>
          <div className="kpis">
            <Kpi
              label="Valor vigente"
              value={moneyM(mSel.valorActual)}
              sub={money(mSel.valorActual)}
              icon="file-signature"
              color="brand"
            />
            <Kpi
              label="Saldo disponible"
              value={moneyM(mSel.saldo)}
              sub={money(mSel.saldo)}
              icon="money-check-dollar"
              color={mSel.saldo < 0 ? 'crit' : 'ok'}
            />
            <Kpi
              label="Neto de este pago"
              value={moneyM(neto)}
              sub={money(neto)}
              icon="check-circle"
              color={neto > 0 ? 'info' : 'warn'}
            />
          </div>
        </Surface>
      )}



      <div className="form-foot">
        <Button className="btn ghost" onClick={cancelar}>
          <Icon name="chevron-left" /> Cancelar
        </Button>
        <Button className="btn pri" onClick={guardar}>
          <Icon name="check" /> Registrar pago
        </Button>
      </div>
    </AccessibleForm>
  );
};
