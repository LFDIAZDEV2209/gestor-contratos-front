'use client';
import { useState } from 'react';
import { useSoportes } from '../../ui/Soportes';
import { contractHref } from '../../app/routes';
import { Input, Textarea } from '../../ui/Controls';
import { notify } from '../../ui/Feedback';
import { FormGrid, Field } from '../../ui/Workspace';
import { Store, AuthService, Audit } from '../../../lib/store';
import { todayIso, addDays, diffDays, uid } from '../../../lib/format';
import type { Acta, Contract, Modification } from '../../../lib/types';
import { ExpedienteFormShell, createFieldValidation } from './ExpedienteFormShell';

/**
 * VISTA dedicada de reinicio de ejecución (antes modal en TabSuspensiones, fila 49 del mapa).
 * Conserva el cálculo original: días acumulados desde la última suspensión activa y nueva
 * fecha de terminación = terminación actual + días. Crea modificación «Reinicio», acta de
 * reinicio y pasa el contrato a «Activo» (+fechaFin si hay ampliación).
 * Endurecimiento: días ≥ 0 y fecha efectiva obligatoria.
 */
export const ReinicioForm = ({ cid, onDone }: { cid: string; onDone: () => void }) => {
  const sop = useSoportes(cid, contractHref(cid, 'suspensiones'));
  const c = Store.get('contracts', cid) as Contract;
  const modSusp = (Store.byContract('modifications', cid) as Modification[]).filter(
    (mm) => mm.tipo === 'Suspensión' || mm.tipo === 'Reinicio'
  );
  const lastSusp = modSusp.find((mm) => mm.tipo === 'Suspensión' && !mm.anulada);
  const diasSugeridos =
    lastSusp && lastSusp.fecha ? Math.max(0, diffDays(lastSusp.fecha, todayIso())) : 0;

  const [fecha, setFecha] = useState(todayIso());
  const [diasProrroga, setDiasProrroga] = useState(diasSugeridos);
  const [nuevaFechaFin, setNuevaFechaFin] = useState(addDays(c.fechaFin || todayIso(), diasSugeridos));
  const [justificacion, setJustificacion] = useState('');
  const [soporte, setSoporte] = useState('');
  const [intentado, setIntentado] = useState(false);

  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!fecha) addError("fecha", 'La fecha efectiva del reinicio es obligatoria.');
  if (!justificacion.trim()) addError("justificacion", 'La justificación de la actuación es obligatoria.');
  if (diasProrroga < 0) addError("diasProrroga", 'Los días de ampliación no pueden ser negativos.');

  const guardar = async () => {
    if (sop.bloqueado()) return;
    setIntentado(true);
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }
    if (!AuthService.guard('editar')) return;

    const before = JSON.parse(JSON.stringify(c));
    const modId = uid('MD');
    const actaId = uid('AC');
    const modNum = `MOD-REI-${Date.now().toString().slice(-4)}`;
    const actaNum = `ACT-REI-${Date.now().toString().slice(-4)}`;

    const newMod: Modification = {
      id: modId,
      contractId: cid,
      numero: modNum,
      tipo: 'Reinicio',
      fecha,
      justificacion: `${justificacion.trim()} (Ampliación por días de suspensión: ${diasProrroga} días)`,
      soporte: soporte.trim() || `${modNum}.pdf`,
      fechaAnterior: c.fechaFin,
      fechaNueva: nuevaFechaFin,
      anulada: false
    };
    Store.insert('modifications', newMod);

    const newActa: Acta = {
      id: actaId,
      contractId: cid,
      tipo: 'Acta de reinicio',
      numero: actaNum,
      fecha,
      descripcion: justificacion.trim(),
      firmantes: `${c.contratista} / ${c.supervisor || 'Supervisor'}`,
      estado: 'Firmada',
      archivo: soporte.trim() || `${actaNum}.pdf`
    };
    Store.insert('actas', newActa);

    const patch: Partial<Contract> = { estado: 'Activo' };
    if (nuevaFechaFin) patch.fechaFin = nuevaFechaFin;

    Store.update('contracts', cid, patch);
    Audit.diff('Contratos', cid, before, { ...c, ...patch }, {
      estado: 'Estado contractual (Reinicio)',
      fechaFin: 'Nueva fecha de terminación contractual'
    });

    notify(`Reinicio formal registrado. Contrato ${c.numero} pasa a estado Activo`);
    await sop.finalizar(onDone);
  };

  return (
    <ExpedienteFormShell
      fieldErrors={fieldErrors}
      cid={cid}
      tab="suspensiones"
      paso="Reinicio"
      title="Reinicio de la ejecución del contrato"
      description="Reactiva el contrato: pasa a «Activo» y recobra los días de suspensión ampliando la fecha de terminación."
      errores={errores}
      intentado={intentado}
      onSubmit={guardar}
      submitting={sop.subiendo}
      soportes={sop.node}
      submitLabel="Registrar reinicio"
      submitIcon="play"
      onCancel={onDone}
      nota={
        <p className="small muted" style={{ margin: '0 0 12px' }}>
          Días sugeridos: {diasSugeridos} desde la última suspensión activa. Ajusta la ampliación si el acuerdo
          recobra un número distinto de días; el acta de reinicio se genera firmada con la justificación.
        </p>
      }
    >
      <FormGrid className="form-grid">
        <Field className="f">
          <label className="req">Fecha efectiva del reinicio</label>
          <Input name="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        <Field className="f">
          <label>Días de ampliación acumulados</label>
          <Input name="diasProrroga"
            type="number"
            min="0"
            step="1"
            value={diasProrroga}
            onChange={(e) => {
              const d = Math.max(0, Number(e.target.value));
              setDiasProrroga(d);
              setNuevaFechaFin(addDays(c.fechaFin || todayIso(), d));
            }}
          />
        </Field>
        <Field className="f">
          <label>Nueva fecha de terminación contractual</label>
          <Input name="nuevaFechaFin" value={nuevaFechaFin} disabled readOnly />
        </Field>
        <Field className="f">
          <label>Documento soporte (archivo radicado)</label>
          <Input name="soporte"
            value={soporte}
            placeholder="Ej. acta_reinicio_firmada.pdf"
            onChange={(e) => setSoporte(e.target.value)}
          />
        </Field>
        <Field className="f span2">
          <label className="req">Justificación de la actuación</label>
          <Textarea name="justificacion"
            rows={3}
            value={justificacion}
            placeholder="Causal del reinicio (solucionada la causal de la suspensión, acuerdo de las partes...)"
            onChange={(e) => setJustificacion(e.target.value)}
          />
        </Field>
      </FormGrid>
    </ExpedienteFormShell>
  );
};
