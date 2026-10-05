'use client';
import { useState } from 'react';
import { Input, Select, Textarea } from '../../ui/Controls';
import { notify } from '../../ui/Feedback';
import { FormGrid, Field } from '../../ui/Workspace';
import { Store, AuthService, Audit } from '../../../lib/store';
import { money, todayIso, uid, diffDays, fdate } from '../../../lib/format';
import { M } from '../../../lib/metrics';
import type { Contract, Modification } from '../../../lib/types';
import { ExpedienteFormShell } from './ExpedienteFormShell';

type FormState = {
  tipo: string;
  numero: string;
  fecha: string;
  valorNuevo: number;
  fechaNueva: string;
  nuevoTexto: string;
  justificacion: string;
  soporte: string;
};

const TIPOS: { value: string; label: string }[] = [
  { value: 'Adición', label: 'Adición (aumento de valor)' },
  { value: 'Reducción', label: 'Reducción (disminución de valor)' },
  { value: 'Prórroga', label: 'Prórroga (ampliación de plazo)' },
  { value: 'Suspensión', label: 'Suspensión temporal de ejecución' },
  { value: 'Reinicio', label: 'Reinicio de ejecución' },
  { value: 'Cesión', label: 'Cesión contractual (cambio de contratista)' },
  { value: 'Modificación de supervisor', label: 'Modificación de supervisor' },
  { value: 'Terminación anticipada', label: 'Terminación anticipada por mutuo acuerdo' },
  { value: 'Modificación de cláusula', label: 'Aclaración o modificación de cláusula' }
];

/**
 * VISTA dedicada de la modificación contractual / otrosí (antes modal en TabModificaciones).
 * Conserva el efecto del handler original: además de insertar la modificación, parchea el
 * contrato (adiciones/reducciones/fechaFin/estado/contratista/supervisor), audita el diff y
 * advierte normativamente sobre garantías en Adición/Prórroga/Reinicio.
 * Endurecimiento acordado: valor requerido para Adición/Reducción, fecha requerida para
 * Prórroga/Reinicio/Terminación y cesionario/supervisor obligatorio en su tipo.
 */
export const ModificacionForm = ({ cid, onDone }: { cid: string; onDone: () => void }) => {
  const c = Store.get('contracts', cid) as Contract;
  const m = M(c);
  const [form, setForm] = useState<FormState>({
    tipo: 'Adición',
    numero: '',
    fecha: todayIso(),
    valorNuevo: m.valorActual,
    fechaNueva: c.fechaFin || todayIso(),
    nuevoTexto: '',
    justificacion: '',
    soporte: ''
  });
  const [intentado, setIntentado] = useState(false);
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const conValor = form.tipo === 'Adición' || form.tipo === 'Reducción';
  const conFecha = form.tipo === 'Prórroga' || form.tipo === 'Reinicio' || form.tipo === 'Terminación anticipada';
  const conTexto = form.tipo === 'Cesión' || form.tipo === 'Modificación de supervisor';

  const errores: string[] = [];
  if (!form.numero.trim()) errores.push('El número o radicado del otrosí es obligatorio.');
  if (!form.justificacion.trim()) errores.push('La justificación técnica y jurídica es obligatoria.');
  if (conValor && (!form.valorNuevo || form.valorNuevo <= 0))
    errores.push('Ingresa el nuevo valor total del contrato (mayor a cero).');
  if (conValor && form.tipo === 'Reducción' && Number(form.valorNuevo) >= m.valorActual)
    errores.push('El valor reducido debe ser inferior al valor actual del contrato.');
  if (conFecha && !form.fechaNueva) errores.push('Ingresa la nueva fecha de terminación.');
  if (conFecha && form.tipo === 'Prórroga' && form.fechaNueva && c.fechaFin && form.fechaNueva <= c.fechaFin)
    errores.push('La nueva fecha debe ampliarse: debe ser posterior a la terminación actual.');
  if (conTexto && !form.nuevoTexto.trim())
    errores.push(
      form.tipo === 'Cesión'
        ? 'Indica el nuevo contratista cesionario (razón social y NIT).'
        : 'Indica el nuevo supervisor asignado (nombre y cargo).'
    );

  const guardar = () => {
    setIntentado(true);
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }
    if (!AuthService.guard('editar')) return;

    const before = JSON.parse(JSON.stringify(c));
    const newMod: Modification = {
      id: uid('MD'),
      contractId: cid,
      numero: form.numero.trim(),
      tipo: form.tipo,
      fecha: form.fecha,
      justificacion: form.justificacion.trim(),
      soporte: form.soporte.trim() || `mod_${form.numero.trim()}.pdf`,
      valorAnterior: m.valorActual,
      fechaAnterior: c.fechaFin,
      anulada: false
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
      contractPatch.contratista = form.nuevoTexto.trim();
      newMod.nuevoTexto = form.nuevoTexto.trim();
    } else if (form.tipo === 'Modificación de supervisor') {
      contractPatch.supervisor = form.nuevoTexto.trim();
      newMod.nuevoTexto = form.nuevoTexto.trim();
    } else if (form.tipo === 'Terminación anticipada') {
      newMod.fechaAnterior = c.fechaFin;
      newMod.fechaNueva = form.fechaNueva;
      contractPatch.fechaFin = form.fechaNueva;
      contractPatch.estado = 'Terminado';
    }

    Store.insert('modifications', newMod);
    if (Object.keys(contractPatch).length > 0) {
      Store.update('contracts', cid, contractPatch);
      Audit.diff('Modificaciones', cid, before, { ...c, ...contractPatch }, {
        adiciones: 'Adiciones presupuestales',
        reducciones: 'Reducciones presupuestales',
        fechaFin: 'Fecha de terminación',
        estado: 'Estado contractual',
        contratista: 'Cesión de contratista',
        supervisor: 'Designación de supervisor'
      });
    }

    const hasGuarantees = Store.byContract('guarantees', cid).length > 0;
    if (['Adición', 'Prórroga', 'Reinicio'].includes(form.tipo) && hasGuarantees) {
      notify(
        `Atención normativa: la ${form.tipo.toLowerCase()} puede exigir ajustar el valor asegurado o ampliar la vigencia de las pólizas.`
      );
    }

    notify(`Modificación ${newMod.numero} (${form.tipo}) aplicada exitosamente`);
    onDone();
  };

  return (
    <ExpedienteFormShell
      cid={cid}
      tab="modificaciones"
      paso="Nueva modificación"
      title="Nueva modificación contractual (Otrosí)"
      description="Suscribe y aplica el otrosí: actualiza los totales/plazo/estado del contrato y deja trazabilidad en la auditoría."
      errores={errores}
      intentado={intentado}
      onSubmit={guardar}
      submitLabel="Aplicar modificación"
      submitIcon="check"
      onCancel={onDone}
      nota={
        conValor || conFecha ? (
          <div className="alert-box warn mb" role="status">
            {conValor && (
              <p>
                Valor actual del contrato: <b className="mono">{money(m.valorActual)}</b>. Diferencia:{' '}
                <b className="mono">
                  {form.tipo === 'Adición' ? '+' : '−'}
                  {money(Math.abs(Number(form.valorNuevo) - m.valorActual))}
                </b>
                .
              </p>
            )}
            {conFecha && form.tipo === 'Prórroga' && (
              <p>
                Terminación actual: <b>{fdateSeguro(c.fechaFin)}</b>. Días adicionales calculados:{' '}
                <b className="mono">+{diffDays(c.fechaFin, form.fechaNueva)} días</b>.
              </p>
            )}
            {['Adición', 'Prórroga', 'Reinicio'].includes(form.tipo) && (
              <p>Verifica la vigencia y valor asegurado de las pólizas del expediente tras aplicar el otrosí.</p>
            )}
          </div>
        ) : null
      }
    >
      <FormGrid className="form-grid">
        <Field className="f">
          <label className="req">Tipo de modificación</label>
          <Select
            value={form.tipo}
            onChange={(e) => {
              const t = e.target.value;
              set({ tipo: t });
              if (t === 'Adición' || t === 'Reducción') set({ valorNuevo: m.valorActual });
              if (t === 'Prórroga' || t === 'Reinicio' || t === 'Terminación anticipada')
                set({ fechaNueva: c.fechaFin || todayIso() });
            }}
          >
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field className="f">
          <label className="req">Número o radicado del Otrosí</label>
          <Input
            value={form.numero}
            placeholder="Ej. OTROSI-01 o MOD-2026-01"
            onChange={(e) => set({ numero: e.target.value })}
            required
          />
        </Field>
        <Field className="f">
          <label className="req">Fecha de suscripción</label>
          <Input type="date" value={form.fecha} onChange={(e) => set({ fecha: e.target.value })} required />
        </Field>

        {conValor && (
          <Field className="f">
            <label className="req">{form.tipo === 'Adición' ? 'Nuevo valor total actualizado' : 'Nuevo valor total reducido'}</label>
            <Input
              type="number"
              min="0"
              step="1000"
              value={form.valorNuevo || ''}
              onChange={(e) => set({ valorNuevo: Number(e.target.value) })}
              required
            />
          </Field>
        )}

        {conFecha && (
          <>
            <Field className="f">
              <label>Fecha de terminación contractual actual</label>
              <Input value={fdateSeguro(c.fechaFin)} disabled readOnly />
            </Field>
            <Field className="f">
              <label className="req">Nueva fecha de terminación</label>
              <Input type="date" value={form.fechaNueva} onChange={(e) => set({ fechaNueva: e.target.value })} />
            </Field>
          </>
        )}

        {form.tipo === 'Cesión' && (
          <Field className="f span2">
            <label className="req">Nuevo contratista cesionario (Razón Social y NIT)</label>
            <Input
              value={form.nuevoTexto}
              placeholder="Ej. INGENIERÍA INTEGRAL S.A.S. - NIT 900.123.456-7"
              onChange={(e) => set({ nuevoTexto: e.target.value })}
              required
            />
          </Field>
        )}

        {form.tipo === 'Modificación de supervisor' && (
          <Field className="f span2">
            <label className="req">Nuevo supervisor asignado (Nombre y cargo)</label>
            <Input
              value={form.nuevoTexto}
              placeholder="Ej. Ing. Carlos Martínez - Supervisor de Contratos"
              onChange={(e) => set({ nuevoTexto: e.target.value })}
              required
            />
          </Field>
        )}

        <Field className="f span2">
          <label className="req">Justificación técnica y jurídica</label>
          <Textarea
            rows={3}
            value={form.justificacion}
            placeholder="Motivo y justificación detallada de la modificación suscrita..."
            onChange={(e) => set({ justificacion: e.target.value })}
            required
          />
        </Field>
        <Field className="f span2">
          <label>Documento soporte (archivo radicado)</label>
          <Input
            value={form.soporte}
            placeholder="Ej. otrosi_01_firmado.pdf"
            onChange={(e) => set({ soporte: e.target.value })}
          />
        </Field>
      </FormGrid>
    </ExpedienteFormShell>
  );
};

function fdateSeguro(s?: string) {
  return fdate(s || '');
}
