'use client';
import { useState } from 'react';
import { Input, Select, Textarea } from '../../ui/Controls';
import { notify } from '../../ui/Feedback';
import { FormGrid, Field } from '../../ui/Workspace';
import { Store, AuthService, Audit } from '../../../lib/store';
import { todayIso, uid } from '../../../lib/format';
import { CAT } from '../../../lib/catalog';
import type { Acta } from '../../../lib/types';
import { ExpedienteFormShell, createFieldValidation } from './ExpedienteFormShell';

/**
 * VISTA dedicada de alta de actas (antes modal en TabActas). Reglas del handler original:
 * número (trim) y fecha obligatorios; archivo demo con nombre derivado del número cuando queda vacío.
 */
export const ActaForm = ({ cid, onDone }: { cid: string; onDone: () => void }) => {
  const [form, setForm] = useState({
    tipo: CAT('tiposActa')[0] || 'Acta de inicio',
    numero: '',
    fecha: todayIso(),
    estado: 'Firmada',
    firmantes: '',
    descripcion: '',
    archivo: ''
  });
  const [intentado, setIntentado] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!form.numero.trim()) addError("numero", 'El número del acta es obligatorio (se usa como radicado en el expediente).');
  if (!form.fecha) addError("fecha", 'La fecha del acta es obligatoria.');

  const guardar = () => {
    setIntentado(true);
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }
    if (!AuthService.guard('crear')) return;

    const nueva: Acta = {
      id: uid('AC'),
      contractId: cid,
      tipo: form.tipo,
      numero: form.numero.trim(),
      fecha: form.fecha,
      descripcion: form.descripcion,
      firmantes: form.firmantes,
      estado: form.estado,
      archivo: form.archivo || `${form.numero.replace(/\s+/g, '_')}.pdf`
    };

    Store.insert('actas', nueva);
    Audit.log({
      contractId: cid,
      modulo: 'Actas',
      accion: 'Creación',
      campo: 'Nueva acta ' + nueva.numero,
      nuevo: `${nueva.tipo} - ${nueva.fecha}`
    });
    notify('Acta registrada');
    onDone();
  };

  return (
    <ExpedienteFormShell
      fieldErrors={fieldErrors}
      cid={cid}
      tab="actas"
      paso="Nueva acta"
      title="Nueva acta contractual"
      description="Documento formal del expediente (actas de inicio, avance, recibo, liquidación o actuación contractual)."
      errores={errores}
      intentado={intentado}
      onSubmit={guardar}
      submitLabel="Registrar acta"
      submitIcon="save"
      onCancel={onDone}
      nota={
        <p className="small muted" style={{ margin: '0 0 12px' }}>
          Si no indicas el documento soporte se genera un nombre de archivo a partir del número del acta
          (archivo de demostración, sin carga real al repositorio).
        </p>
      }
    >
      <FormGrid className="form-grid">
        <Field className="f">
          <label className="req">Tipo de acta</label>
          <Select name="tipo" value={form.tipo} onChange={(e) => set({ tipo: e.target.value })}>
            {CAT('tiposActa').map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field className="f">
          <label className="req">Número de acta</label>
          <Input name="numero" value={form.numero} placeholder="Ej. ACT-001" onChange={(e) => set({ numero: e.target.value })} />
        </Field>
        <Field className="f">
          <label className="req">Fecha</label>
          <Input name="fecha" type="date" value={form.fecha} onChange={(e) => set({ fecha: e.target.value })} />
        </Field>
        <Field className="f">
          <label>Estado</label>
          <Select name="estado" value={form.estado} onChange={(e) => set({ estado: e.target.value })}>
            <option value="Borrador">Borrador</option>
            <option value="En firmas">En firmas</option>
            <option value="Firmada">Firmada</option>
          </Select>
        </Field>
        <Field className="f span2">
          <label>Firmantes</label>
          <Input name="firmantes"
            value={form.firmantes}
            placeholder="Nombres y cargos de quienes suscriben el acta"
            onChange={(e) => set({ firmantes: e.target.value })}
          />
        </Field>
        <Field className="f span2">
          <label>Descripción / Objeto del acta</label>
          <Textarea name="descripcion"
            rows={3}
            value={form.descripcion}
            placeholder="Detalle o acuerdos registrados en el acta..."
            onChange={(e) => set({ descripcion: e.target.value })}
          />
        </Field>
        <Field className="f span2">
          <label>Documento soporte (archivo)</label>
          <Input name="archivo"
            value={form.archivo}
            placeholder="Nombre del archivo adjunto (ej. acta_inicio_firmada.pdf)"
            onChange={(e) => set({ archivo: e.target.value })}
          />
        </Field>
      </FormGrid>
    </ExpedienteFormShell>
  );
};
