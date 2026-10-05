'use client';
import { useState } from 'react';
import { Input, Textarea } from '../../ui/Controls';
import { notify } from '../../ui/Feedback';
import { FormGrid, Field } from '../../ui/Workspace';
import { Store, AuthService, Audit } from '../../../lib/store';
import { todayIso, uid } from '../../../lib/format';
import type { Acta, Contract, Modification } from '../../../lib/types';
import { ExpedienteFormShell, createFieldValidation } from './ExpedienteFormShell';

/**
 * VISTA dedicada de suspensión contractual (antes modal en TabSuspensiones, fila 49 del mapa).
 * Es una actuación, no una acción rápida: crea la modificación «Suspensión», el acta firmada
 * correspondiente y pasa el contrato a «Suspendido». Endurecimiento: fecha efectiva
 * obligatoria (el modal original la pedía con label req pero no la validaba).
 */
export const SuspensionForm = ({ cid, onDone }: { cid: string; onDone: () => void }) => {
  const c = Store.get('contracts', cid) as Contract;
  const [fecha, setFecha] = useState(todayIso());
  const [justificacion, setJustificacion] = useState('');
  const [soporte, setSoporte] = useState('');
  const [intentado, setIntentado] = useState(false);

  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!fecha) addError("fecha", 'La fecha efectiva de la suspensión es obligatoria.');
  if (!justificacion.trim()) addError("justificacion", 'La justificación de la actuación es obligatoria.');

  const guardar = () => {
    setIntentado(true);
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }
    if (!AuthService.guard('editar')) return;

    const before = JSON.parse(JSON.stringify(c));
    const modId = uid('MD');
    const actaId = uid('AC');
    const modNum = `MOD-SUS-${Date.now().toString().slice(-4)}`;
    const actaNum = `ACT-SUS-${Date.now().toString().slice(-4)}`;

    const newMod: Modification = {
      id: modId,
      contractId: cid,
      numero: modNum,
      tipo: 'Suspensión',
      fecha,
      justificacion: justificacion.trim(),
      soporte: soporte.trim() || `${modNum}.pdf`,
      fechaAnterior: c.fechaFin,
      anulada: false
    };
    Store.insert('modifications', newMod);

    const newActa: Acta = {
      id: actaId,
      contractId: cid,
      tipo: 'Acta de suspensión',
      numero: actaNum,
      fecha,
      descripcion: justificacion.trim(),
      firmantes: `${c.contratista} / ${c.supervisor || 'Supervisor'}`,
      estado: 'Firmada',
      archivo: soporte.trim() || `${actaNum}.pdf`
    };
    Store.insert('actas', newActa);

    Store.update('contracts', cid, { estado: 'Suspendido' });
    Audit.diff('Contratos', cid, before, { ...c, estado: 'Suspendido' }, {
      estado: 'Estado contractual (Suspensión)'
    });

    notify(`Contrato ${c.numero} suspendido formalmente`);
    onDone();
  };

  return (
    <ExpedienteFormShell
      fieldErrors={fieldErrors}
      cid={cid}
      tab="suspensiones"
      paso="Suspensión"
      title="Suspensión temporal de la ejecución"
      description="Registra la actuación de suspensión: el contrato pasa a «Suspendido», se genera la modificación y el acta firmada de soporte."
      errores={errores}
      intentado={intentado}
      onSubmit={guardar}
      submitLabel="Registrar suspensión"
      submitIcon="pause"
      onCancel={onDone}
      nota={
        <>
          <p className="small muted" style={{ margin: '0 0 12px' }}>
            La fecha de terminación no se modifica en la suspensión; los días suspendidos se recobran al
            reanudar (pestaña Suspensiones → «Registrar reinicio»), que amplía la terminación en los días
            acumulados.
          </p>
          <div className="alert-box warn" role="status">
            <p>La suspensión se ve reflejada en el semáforo del expediente y en la línea de tiempo del contrato.</p>
          </div>
        </>
      }
    >
      <FormGrid className="form-grid">
        <Field className="f">
          <label className="req">Fecha efectiva</label>
          <Input name="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        <Field className="f">
          <label>Documento soporte (archivo radicado)</label>
          <Input name="soporte"
            value={soporte}
            placeholder="Ej. acta_suspension_firmada.pdf"
            onChange={(e) => setSoporte(e.target.value)}
          />
        </Field>
        <Field className="f span2">
          <label className="req">Justificación de la actuación</label>
          <Textarea name="justificacion"
            rows={3}
            value={justificacion}
            placeholder="Causal de la suspensión (sitio no entregado, caso fortuito, acuerdo entre las partes...)"
            onChange={(e) => setJustificacion(e.target.value)}
          />
        </Field>
      </FormGrid>
    </ExpedienteFormShell>
  );
};
