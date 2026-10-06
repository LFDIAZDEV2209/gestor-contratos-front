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
import type { Acta } from '../../lib/types';
import { Store, Audit, AuthService } from '../../lib/store';
import { CAT } from '../../lib/catalog';
import { todayIso, uid } from '../../lib/format';
import { Icon } from '../icons';
import { useSoportes } from '../ui/Soportes';

/**
 * Acta contractual en VISTA dedicada (reemplaza al modal de ActasView).
 * Mismas reglas del handler original: contrato, número y fecha obligatorios.
 */
export const ActaForm = ({ onDone }: { onDone: (savedId: string) => void }) => {
  const cancelar = useFormCancel("/actas");
  const [intentado, setIntentado] = useState(false);
  const [form, setForm] = useState({
    contractId: '',
    tipo: 'Acta de inicio',
    numero: '',
    fecha: todayIso(),
    descripcion: '',
    firmantes: '',
    estado: 'Firmada',
    archivo: ''
  });

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const contracts = Store.all('contracts').filter((c) => !c.anulado);
  const tiposCatalogo = CAT('tiposActa');

  const numero = form.numero.trim();
  const errCampo: Record<string, string> = {};
  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!form.contractId) {
    errCampo.contractId = 'Selecciona el contrato al que pertenece el acta.';
    addError("contractId", 'El contrato es obligatorio.');
  }
  if (!numero) {
    errCampo.numero = 'Ingresa el número o consecutivo del acta.';
    addError("numero", 'El número del acta es obligatorio.');
  }
  if (!form.fecha) {
    errCampo.fecha = 'Indica la fecha de elaboración o firma.';
    addError("fecha", 'La fecha del acta es obligatoria.');
  }

  const sop = useSoportes(() => form.contractId, '/actas');

  const guardar = async () => {
    if (sop.bloqueado()) return;
    setIntentado(true);
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }
    if (!AuthService.guard('crear')) return;

    const newActa: Acta = {
      id: uid('AC'),
      contractId: form.contractId,
      tipo: form.tipo,
      numero,
      fecha: form.fecha,
      descripcion: form.descripcion,
      firmantes: form.firmantes,
      estado: form.estado,
      archivo: form.archivo || `${numero.replace(/\s+/g, '_')}.pdf`
    };

    Store.insert('actas', newActa);
    Audit.log({
      contractId: form.contractId,
      modulo: 'Actas',
      accion: 'Creación',
      campo: 'Acta ' + newActa.numero,
      nuevo: `${newActa.tipo} - ${newActa.fecha}`
    });

    notify(`Acta «${numero}» registrada exitosamente.`);
    await sop.finalizar(() => onDone(newActa.id));
  };

  const err = (campo: string) => (intentado ? errCampo[campo] : undefined);

  return (
    <AccessibleForm errors={fieldErrors} attempted={intentado}>
      <PageHeader className="ph">
        <div>
          <nav aria-label="Ruta de navegación" className="crumb" style={{ width: '100%', marginBottom: 6 }}>
            <Link href="/actas">Actas</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <span aria-current="page">Nueva acta</span>
          </nav>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <span className="form-shell-icon" aria-hidden="true"><Icon name="file-signature" size={22} /></span>
            Nueva acta contractual
          </h1>
          <p style={{ margin: '4px 0 0' }}>
            Formaliza un hito del contrato: inicio, recibo, suspensión, prórroga o liquidación, con
            sus firmantes y soporte.
          </p>
        </div>
      </PageHeader>

      <Surface className="panel mb">

        <FormSection title={<>Identificación del acta</>} icon="file-signature" description={<>Contrato, tipo, consecutivo y fecha</>} accent>
          <Field className={`f span3${err('contractId') ? ' err' : ''}`}>
            <label className="req">Contrato</label>
            <Select name="contractId"
              value={form.contractId}
              onChange={(e) => set({ contractId: e.target.value })}
              aria-describedby={err('contractId') ? 'err-acontrato' : undefined}
            >
              <option value="">— Seleccione contrato —</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} · {c.contratista}
                </option>
              ))}
            </Select>
            {err('contractId') && (
              <span className="emsg" id="err-acontrato"><span aria-hidden="true"><Icon name="alert-circle" size={13} /></span>
                {err('contractId')}
              </span>
            )}
          </Field>

          <Field className="f">
            <label className="req">Tipo de acta</label>
            <Select name="tipo" value={form.tipo} onChange={(e) => set({ tipo: e.target.value })}>
              {tiposCatalogo.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>

          <Field className={`f${err('numero') ? ' err' : ''}`}>
            <label className="req">Número de acta</label>
            <Input name="numero"
              value={form.numero}
              placeholder="Ej. ACT-001"
              onChange={(e) => set({ numero: e.target.value })}
              aria-describedby={err('numero') ? 'err-anumero' : undefined}
            />
            {err('numero') && (
              <span className="emsg" id="err-anumero"><span aria-hidden="true"><Icon name="alert-circle" size={13} /></span>
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
              aria-describedby={err('fecha') ? 'err-afecha' : undefined}
            />
            {err('fecha') && (
              <span className="emsg" id="err-afecha"><span aria-hidden="true"><Icon name="alert-circle" size={13} /></span>
                {err('fecha')}
              </span>
            )}
          </Field>

          <Field className="f span3">
            <label>Firmantes</label>
            <Input name="firmantes"
              value={form.firmantes}
              placeholder="Nombres y cargos de quienes suscriben el acta"
              onChange={(e) => set({ firmantes: e.target.value })}
            />
          </Field>

          <Field className="f span3">
            <label>Descripción / Objeto del acta</label>
            <Textarea name="descripcion"
              rows={4}
              value={form.descripcion}
              placeholder="Detalle o acuerdos formalizados en el acta..."
              onChange={(e) => set({ descripcion: e.target.value })}
            />
          </Field>
        </FormSection>
      </Surface>

      <Surface className="panel mb">

        <FormSection title={<>Estado y soporte</>} icon="check-circle" description={<>Situación documental y archivo de respaldo</>} accent>
          <Field className="f">
            <label>Estado</label>
            <Select name="estado" value={form.estado} onChange={(e) => set({ estado: e.target.value })}>
              <option value="Borrador">Borrador</option>
              <option value="En firmas">En firmas</option>
              <option value="Firmada">Firmada</option>
            </Select>
          </Field>

          <Field className="f span2">
            <label>Documento soporte (archivo)</label>
            <Input name="archivo"
              value={form.archivo}
              placeholder="Nombre del archivo adjunto (ej. acta_inicio_firmada.pdf)"
              onChange={(e) => set({ archivo: e.target.value })}
            />
            <span className="hint">
              Opcional: si se deja vacío se genera «
              {numero ? numero.replace(/\s+/g, '_') : 'acta'}.pdf». No se realiza una transferencia
              real.
            </span>
          </Field>
        </FormSection>
      </Surface>

      {sop.node}

      <div className="form-foot">
        <Button className="btn ghost" onClick={cancelar}>
          <Icon name="chevron-left" /> Cancelar
        </Button>
        <Button className="btn pri" onClick={guardar} loading={sop.subiendo}>
          <Icon name="check" /> Registrar acta
        </Button>
      </div>
    </AccessibleForm>
  );
};
