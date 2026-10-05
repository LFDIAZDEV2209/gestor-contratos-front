'use client';
import { useState } from 'react';
import { Input, Textarea } from '../../ui/Controls';
import { notify } from '../../ui/Feedback';
import { FormGrid, Field } from '../../ui/Workspace';
import { Store, AuthService, Audit } from '../../../lib/store';
import { todayIso, addDays, diffDays, uid, fdate } from '../../../lib/format';
import type { Contract, Modification } from '../../../lib/types';
import { ExpedienteFormShell, createFieldValidation } from './ExpedienteFormShell';

/**
 * VISTA dedicada de prórroga (ampliación de plazo, fila 44 del mapa) — antes modal en TabProrrogas.
 * Conserva: días ↔ nueva fecha acoplados (addDays/diffDays), número autogenerado si queda
 * vacío, modificación tipo «Prórroga» + patch de fechaFin del contrato (estado Terminado
 * vuelve a Activo) + Audit.diff. Endurecimiento acordado: la ampliación debe ser positiva
 * (nueva fecha posterior a la terminación actual) y días ≥ 1.
 */
export const ProrrogaForm = ({ cid, onDone }: { cid: string; onDone: () => void }) => {
  const c = Store.get('contracts', cid) as Contract;
  const base = c.fechaFin || todayIso();
  const [diasAdd, setDiasAdd] = useState(30);
  const [nuevaFecha, setNuevaFecha] = useState<string>(addDays(base, 30));
  const [numero, setNumero] = useState(`PRO-${Date.now().toString().slice(-4)}`);
  const [justificacion, setJustificacion] = useState('');
  const [soporte, setSoporte] = useState('');
  const [intentado, setIntentado] = useState(false);

  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!nuevaFecha) addError("nuevaFecha", 'Selecciona la nueva fecha de terminación.');
  if (!diasAdd || diasAdd < 1) addError("nuevaFecha", 'Los días de ampliación deben ser al menos 1.');
  if (nuevaFecha && base && nuevaFecha <= base)
    addError("nuevaFecha", 'La nueva fecha debe ser posterior a la terminación actual: una prórroga amplía el plazo.');
  if (!justificacion.trim()) addError("justificacion", 'La justificación técnica de la prórroga es obligatoria.');

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
      numero: numero.trim() || `PRO-${Date.now().toString().slice(-4)}`,
      tipo: 'Prórroga',
      fecha: todayIso(),
      justificacion: justificacion.trim(),
      soporte: soporte.trim() || `${numero.trim()}.pdf`,
      fechaAnterior: c.fechaFin,
      fechaNueva: nuevaFecha,
      anulada: false
    };

    Store.insert('modifications', newMod);

    const patch: Partial<Contract> = { fechaFin: nuevaFecha };
    if (c.estado === 'Terminado') patch.estado = 'Activo';

    Store.update('contracts', cid, patch);
    Audit.diff('Contratos', cid, before, { ...c, ...patch }, {
      fechaFin: 'Fecha de terminación contractual (Prórroga)'
    });

    const hasGuarantees = Store.byContract('guarantees', cid).length > 0;
    if (hasGuarantees) {
      notify('Atención: la ampliación de plazo puede requerir modificar la vigencia de las pólizas de garantía.');
    }

    notify(`Prórroga ${newMod.numero} registrada exitosamente (+${diffDays(c.fechaFin, nuevaFecha)} días)`);
    onDone();
  };

  return (
    <ExpedienteFormShell
      fieldErrors={fieldErrors}
      cid={cid}
      tab="prorrogas"
      paso="Nueva prórroga"
      title="Crear prórroga contractual (ampliación de plazo)"
      description="Otrosí de ampliación del plazo: extiende la fecha de terminación, deja la modificación en la pestaña y audita el cambio."
      errores={errores}
      intentado={intentado}
      onSubmit={guardar}
      submitLabel="Registrar prórroga"
      submitIcon="calendar-plus"
      onCancel={onDone}
      nota={
        <p className="small muted" style={{ margin: '0 0 12px' }}>
          Días y nueva fecha van acoplados: ajusta uno y el otro se recalcula. Si el contrato está «Terminado»,
          al ampliar vuelve a «Activo». Si existe póliza de garantía recuerda ampliar su vigencia.
        </p>
      }
    >
      <FormGrid className="form-grid">
        <Field className="f span2">
          <label>Fecha de terminación contractual actual</label>
          <Input value={fdate(c.fechaFin)} disabled readOnly />
        </Field>
        <Field className="f">
          <label className="req">Días de ampliación</label>
          <Input name="diasAdd"
            type="number"
            min="1"
            step="1"
            value={diasAdd}
            onChange={(e) => {
              const d = Math.max(0, Number(e.target.value));
              setDiasAdd(d);
              setNuevaFecha(addDays(base, d));
            }}
          />
        </Field>
        <Field className="f">
          <label className="req">Nueva fecha de terminación</label>
          <Input name="nuevaFecha"
            type="date"
            value={nuevaFecha}
            onChange={(e) => {
              const f = e.target.value;
              setNuevaFecha(f);
              setDiasAdd(f ? Math.max(0, diffDays(base, f)) : 0);
            }}
          />
        </Field>
        <Field className="f">
          <label>Número del otrosí</label>
          <Input name="numero" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="PRO-2026-01" />
        </Field>
        <Field className="f span2">
          <label className="req">Justificación técnica</label>
          <Textarea name="justificacion"
            rows={3}
            value={justificacion}
            placeholder="Causa de la ampliación (evidencia, retraso imputable, mutuo acuerdo...)"
            onChange={(e) => setJustificacion(e.target.value)}
          />
        </Field>
        <Field className="f span2">
          <label>Documento soporte (archivo radicado)</label>
          <Input name="soporte"
            value={soporte}
            placeholder="Ej. otrosi_prorroga_firmado.pdf"
            onChange={(e) => setSoporte(e.target.value)}
          />
        </Field>
      </FormGrid>
    </ExpedienteFormShell>
  );
};
