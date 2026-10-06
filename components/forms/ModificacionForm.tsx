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
import type { Modification, Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { M } from '../../lib/metrics';
import { money, moneyM, fdate, todayIso, uid } from '../../lib/format';
import { Icon } from '../icons';

/**
 * Modificación contractual en VISTA dedicada (reemplaza al modal de
 * ModificacionesView). La secuencia original se conserva íntegra: se inserta la
 * modificación, se parchea el contrato según el tipo, se audita con diff y se
 * alerta sobre garantías afectadas. El aviso de garantías viaja como notificación.
 */
export const ModificacionForm = ({ onDone }: { onDone: () => void }) => {
  const cancelar = useFormCancel("/modificaciones");
  const [intentado, setIntentado] = useState(false);
  const [form, setForm] = useState({
    contractId: '',
    tipo: 'Adición',
    numero: '',
    fecha: todayIso(),
    justificacion: '',
    valorNuevo: 0,
    fechaNueva: '',
    nuevoTexto: '',
    soporte: ''
  });

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const contracts = Store.all('contracts').filter((c) => !c.anulado);
  const selectedContract = form.contractId ? Store.get('contracts', form.contractId) : null;
  const selectedMetrics = selectedContract ? M(selectedContract) : null;

  const numero = form.numero.trim();
  const justificacion = form.justificacion.trim();
  const nuevoTexto = form.nuevoTexto.trim();
  const tocaValor = form.tipo === 'Adición' || form.tipo === 'Reducción';
  const tocaFecha = ['Prórroga', 'Reinicio', 'Terminación anticipada'].includes(form.tipo);
  const tocaCesionario = form.tipo === 'Cesión';
  const tocaSupervisor = form.tipo === 'Modificación de supervisor';

  const errCampo: Record<string, string> = {};
  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!form.contractId) {
    errCampo.contractId = 'Selecciona el contrato que se modifica.';
    addError("contractId", 'El contrato es obligatorio.');
  }
  if (!numero) {
    errCampo.numero = 'Indica la referencia (MOD-01, OTROSI-01, etc.).';
    addError("numero", 'El número de la modificación es obligatorio.');
  }
  if (!form.fecha) {
    errCampo.fecha = 'Indica la fecha de la modificación.';
    addError("fecha", 'La fecha es obligatoria.');
  }
  if (!justificacion) {
    errCampo.justificacion = 'Describe el motivo técnico o jurídico de la modificación.';
    addError("justificacion", 'La justificación es obligatoria.');
  }
  // Endurecimiento explícito: el modal marcaba estos campos como requeridos pero
  // el handler no los comprobaba y podía guardar un contrato sin valor ni fecha fin.
  if (tocaValor && !form.valorNuevo) {
    errCampo.valorNuevo = 'Registra el nuevo valor total resultante del contrato.';
    addError("valorNuevo", 'El nuevo valor es obligatorio para adiciones y reducciones.');
  }
  if (tocaFecha && !form.fechaNueva) {
    errCampo.fechaNueva = 'Indica la nueva fecha de terminación del contrato.';
    addError("fechaNueva", 'La nueva fecha de terminación es obligatoria.');
  }
  if (tocaCesionario && !nuevoTexto) {
    errCampo.nuevoTexto = 'Indica la razón social y NIT del nuevo contratista.';
    addError("nuevoTexto", 'El nuevo contratista es obligatorio en una cesión.');
  }
  if (tocaSupervisor && !nuevoTexto) {
    errCampo.nuevoTexto = 'Indica el nombre y cargo del nuevo supervisor.';
    addError("nuevoTexto", 'El nuevo supervisor es obligatorio.');
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
    if (!AuthService.guard('editar')) return;

    const c = Store.get('contracts', form.contractId);
    if (!c) {
      notify('El contrato seleccionado ya no existe.');
      return;
    }

    // Snapshot previo: Store.update muta en sitio y falsearía el diff
    const before = JSON.parse(JSON.stringify(c));
    const m = M(c);

    const newMod: Modification = {
      id: uid('MD'),
      contractId: form.contractId,
      numero,
      tipo: form.tipo,
      fecha: form.fecha,
      justificacion,
      soporte: form.soporte || `${numero}.pdf`,
      valorAnterior: m.valorActual,
      fechaAnterior: c.fechaFin
    };

    const contractPatch: Partial<Contract> = {};

    if (form.tipo === 'Adición') {
      const added = Number(form.valorNuevo) - m.valorActual;
      contractPatch.adiciones = (Number(c.adiciones) || 0) + added;
      newMod.valorNuevo = Number(form.valorNuevo);
    } else if (form.tipo === 'Reducción') {
      const reduced = m.valorActual - Number(form.valorNuevo);
      contractPatch.reducciones = (Number(c.reducciones) || 0) + reduced;
      newMod.valorNuevo = Number(form.valorNuevo);
    } else if (form.tipo === 'Prórroga') {
      newMod.fechaAnterior = c.fechaFin;
      newMod.fechaNueva = form.fechaNueva;
      contractPatch.fechaFin = form.fechaNueva;
      if (c.estado === 'Terminado') contractPatch.estado = 'Activo';
    } else if (form.tipo === 'Suspensión') {
      contractPatch.estado = 'Suspendido';
    } else if (form.tipo === 'Reinicio') {
      contractPatch.estado = 'Activo';
      if (form.fechaNueva) {
        newMod.fechaAnterior = c.fechaFin;
        newMod.fechaNueva = form.fechaNueva;
        contractPatch.fechaFin = form.fechaNueva;
      }
    } else if (form.tipo === 'Cesión') {
      newMod.valorAnterior = 0;
      newMod.impacto = `Cesionario anterior: ${c.contratista}.`;
      contractPatch.contratista = nuevoTexto;
      newMod.nuevoTexto = nuevoTexto;
    } else if (form.tipo === 'Modificación de supervisor') {
      contractPatch.supervisor = nuevoTexto;
      newMod.nuevoTexto = nuevoTexto;
    } else if (form.tipo === 'Terminación anticipada') {
      newMod.fechaAnterior = c.fechaFin;
      newMod.fechaNueva = form.fechaNueva;
      contractPatch.fechaFin = form.fechaNueva;
      contractPatch.estado = 'Terminado';
    }

    Store.insert('modifications', newMod);
    if (Object.keys(contractPatch).length > 0) {
      Store.update('contracts', form.contractId, contractPatch);
      Audit.diff('Modificaciones', form.contractId, before, { ...c, ...contractPatch }, {
        adiciones: 'Adiciones',
        reducciones: 'Reducciones',
        fechaFin: 'Fecha de terminación',
        estado: 'Estado',
        contratista: 'Contratista',
        supervisor: 'Supervisor'
      });
    }

    const hasGuarantees = Store.byContract('guarantees', form.contractId).length > 0;
    if (['Adición', 'Prórroga', 'Reinicio'].includes(form.tipo) && hasGuarantees) {
      notify(
        `Revisa las garantías del contrato ${c.numero}: la ${form.tipo.toLowerCase()} puede exigir ajustar valor o vigencia de las pólizas.`
      );
    }

    notify(`Modificación ${numero} aplicada al contrato ${c.numero}.`);
    onDone();
  };

  const err = (campo: string) => (intentado ? errCampo[campo] : undefined);

  return (
    <AccessibleForm errors={fieldErrors} attempted={intentado}>
      <PageHeader className="ph">
        <div>
          <nav aria-label="Ruta de navegación" className="crumb" style={{ width: '100%', marginBottom: 6 }}>
            <Link href="/modificaciones">Modificaciones</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <span aria-current="page">Nueva modificación</span>
          </nav>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            Nueva modificación contractual
          </h1>
          <p style={{ margin: '4px 0 0' }}>
            Adiciones, prórrogas, suspensiones y demás otrosíes con efecto automático sobre el
            contrato, trazados en auditoría.
          </p>
        </div>
      </PageHeader>

      <Surface className="panel mb">

        <FormSection title={<>Contrato y referencia</>} icon="file-signature" description={<>Sobre qué contrato opera y con qué documento</>} accent>
          <Field className={`f span3${err('contractId') ? ' err' : ''}`}>
            <label className="req">Contrato</label>
            <Select name="contractId"
              value={form.contractId}
              onChange={(e) => {
                const cid = e.target.value;
                const c = Store.get('contracts', cid);
                const m = c ? M(c) : null;
                set({
                  contractId: cid,
                  valorNuevo: m ? m.valorActual : 0,
                  fechaNueva: c?.fechaFin || todayIso()
                });
              }}
              aria-describedby={err('contractId') ? 'err-mcontrato' : undefined}
            >
              <option value="">— Seleccione contrato —</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} · {c.contratista} · {moneyM(M(c).valorActual)}
                </option>
              ))}
            </Select>
            {err('contractId') && (
              <span className="emsg" id="err-mcontrato"><span aria-hidden="true"><Icon name="alert-circle" size={13} /></span>
                {err('contractId')}
              </span>
            )}
          </Field>

          <Field className="f">
            <label className="req">Tipo de modificación</label>
            <Select name="tipo" value={form.tipo} onChange={(e) => set({ tipo: e.target.value })}>
              <option value="Adición">Adición (aumentar valor)</option>
              <option value="Reducción">Reducción (disminuir valor)</option>
              <option value="Prórroga">Prórroga (ampliar plazo)</option>
              <option value="Suspensión">Suspensión</option>
              <option value="Reinicio">Reinicio</option>
              <option value="Cesión">Cesión contractual</option>
              <option value="Modificación de supervisor">Modificación de supervisor</option>
              <option value="Terminación anticipada">Terminación anticipada</option>
              <option value="Modificación de cláusula">Aclaración o modificación de cláusula</option>
            </Select>
          </Field>

          <Field className={`f${err('numero') ? ' err' : ''}`}>
            <label className="req">Número / Referencia</label>
            <Input name="numero"
              value={form.numero}
              placeholder="Ej. MOD-01 u OTROSI-01"
              onChange={(e) => set({ numero: e.target.value })}
              aria-describedby={err('numero') ? 'err-mnumero' : undefined}
            />
            {err('numero') && (
              <span className="emsg" id="err-mnumero"><span aria-hidden="true"><Icon name="alert-circle" size={13} /></span>
                {err('numero')}
              </span>
            )}
          </Field>

          <Field className={`f${err('fecha') ? ' err' : ''}`}>
            <label className="req">Fecha</label>
            <Input name="fecha"
              type="date"
              value={form.fecha}
              onChange={(e) => set({ fecha: e.target.value })}
              aria-describedby={err('fecha') ? 'err-mfecha' : undefined}
            />
            {err('fecha') && (
              <span className="emsg" id="err-mfecha"><span aria-hidden="true"><Icon name="alert-circle" size={13} /></span>
                {err('fecha')}
              </span>
            )}
          </Field>
        </FormSection>
      </Surface>

      {(tocaValor || tocaFecha || tocaCesionario || tocaSupervisor) && (
        <Surface className="panel mb">

          <FormSection title={<>Efecto de la modificación</>} icon="code-compare" description={<>Valores, fechas o sujetos que cambian según el tipo seleccionado</>} accent>
            {tocaValor && (
              <>
                <Field className="f">
                  <label>Valor actual</label>
                  <Input
                    value={selectedMetrics ? money(selectedMetrics.valorActual) : '—'}
                    disabled
                    readOnly
                  />
                  <span className="hint">Valor vigente antes de la modificación.</span>
                </Field>
                <Field className={`f span2${err('valorNuevo') ? ' err' : ''}`}>
                  <label className="req">Nuevo valor total resultante</label>
                  <Input name="valorNuevo"
                    type="number"
                    value={form.valorNuevo}
                    onChange={(e) => set({ valorNuevo: Number(e.target.value) })}
                    aria-describedby={err('valorNuevo') ? 'err-mvalor' : undefined}
                  />
                  {err('valorNuevo') ? (
                    <span className="emsg" id="err-mvalor"><span aria-hidden="true"><Icon name="alert-circle" size={13} /></span>
                      {err('valorNuevo')}
                    </span>
                  ) : (
                    <span className="hint">
                      {form.tipo === 'Adición'
                        ? `Se adiciona ${money(Number(form.valorNuevo) - (selectedMetrics?.valorActual || 0))}.`
                        : `Se reducen ${money((selectedMetrics?.valorActual || 0) - Number(form.valorNuevo))}.`}
                    </span>
                  )}
                </Field>
              </>
            )}

            {tocaFecha && (
              <>
                <Field className="f">
                  <label>Fecha fin actual</label>
                  <Input
                    value={selectedContract?.fechaFin ? fdate(selectedContract.fechaFin) : '—'}
                    disabled
                    readOnly
                  />
                </Field>
                <Field className={`f${err('fechaNueva') ? ' err' : ''}`}>
                  <label className="req">Nueva fecha de terminación</label>
                  <Input name="fechaNueva"
                    type="date"
                    value={form.fechaNueva}
                    onChange={(e) => set({ fechaNueva: e.target.value })}
                    aria-describedby={err('fechaNueva') ? 'err-mfechan' : undefined}
                  />
                  {err('fechaNueva') && (
                    <span className="emsg" id="err-mfechan"><span aria-hidden="true"><Icon name="alert-circle" size={13} /></span>
                      {err('fechaNueva')}
                    </span>
                  )}
                </Field>
              </>
            )}

            {tocaCesionario && (
              <Field className={`f span3${err('nuevoTexto') ? ' err' : ''}`}>
                <label className="req">Nuevo contratista (Razón social y NIT)</label>
                <Input name="nuevoTexto"
                  value={form.nuevoTexto}
                  placeholder="Ej. NUEVA EMPRESA SAS - NIT 901.000.000-1"
                  onChange={(e) => set({ nuevoTexto: e.target.value })}
                  aria-describedby={err('nuevoTexto') ? 'err-mtexto' : undefined}
                />
                {err('nuevoTexto') && (
                  <span className="emsg" id="err-mtexto"><span aria-hidden="true"><Icon name="alert-circle" size={13} /></span>
                    {err('nuevoTexto')}
                  </span>
                )}
              </Field>
            )}

            {tocaSupervisor && (
              <Field className={`f span3${err('nuevoTexto') ? ' err' : ''}`}>
                <label className="req">Nuevo supervisor</label>
                <Input name="nuevoTexto"
                  value={form.nuevoTexto}
                  placeholder="Nombre y cargo del nuevo supervisor"
                  onChange={(e) => set({ nuevoTexto: e.target.value })}
                  aria-describedby={err('nuevoTexto') ? 'err-msup' : undefined}
                />
                {err('nuevoTexto') && (
                  <span className="emsg" id="err-msup"><span aria-hidden="true"><Icon name="alert-circle" size={13} /></span>
                    {err('nuevoTexto')}
                  </span>
                )}
              </Field>
            )}
          </FormSection>
        </Surface>
      )}

      <Surface className="panel mb">

        <FormSection title={<>Justificación y soporte</>} icon="clipboard-check" description={<>Motivo jurídico o técnico y documento adjunto</>} accent>
          <Field className={`f span3${err('justificacion') ? ' err' : ''}`}>
            <label className="req">Justificación</label>
            <Textarea name="justificacion"
              rows={3}
              value={form.justificacion}
              placeholder="Motivo técnico o jurídico de la modificación..."
              onChange={(e) => set({ justificacion: e.target.value })}
              aria-describedby={err('justificacion') ? 'err-mjust' : undefined}
            />
            {err('justificacion') && (
              <span className="emsg" id="err-mjust"><span aria-hidden="true"><Icon name="alert-circle" size={13} /></span>
                {err('justificacion')}
              </span>
            )}
          </Field>

          <Field className="f span3">
            <label>Documento soporte (archivo)</label>
            <Input name="soporte"
              value={form.soporte}
              placeholder="Nombre del archivo adjunto (ej. otrosi_01.pdf)"
              onChange={(e) => set({ soporte: e.target.value })}
            />
            <span className="hint">
              {form.soporte
                ? 'Se registra como documento soporte de la modificación (simulado, sin transferencia real).'
                : 'Si se deja vacío se genera «' + (numero || 'modificacion') + '.pdf». No se realiza ninguna transferencia real.'}
            </span>
          </Field>
        </FormSection>
      </Surface>

      <div className="form-foot">
        <Button className="btn ghost" onClick={cancelar}>
          <Icon name="chevron-left" /> Cancelar
        </Button>
        <Button className="btn pri" onClick={guardar}>
          <Icon name="check" /> Aplicar modificación
        </Button>
      </div>
    </AccessibleForm>
  );
};
