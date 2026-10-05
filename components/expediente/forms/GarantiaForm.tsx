'use client';
import { useState } from 'react';
import { Input, Select } from '../../ui/Controls';
import { notify } from '../../ui/Feedback';
import { FormGrid, Field } from '../../ui/Workspace';
import { Store, AuthService, Audit } from '../../../lib/store';
import { money, todayIso, uid } from '../../../lib/format';
import { CAT } from '../../../lib/catalog';
import { cupoStats } from '../../../lib/metrics';
import type { Cupo, Guarantee } from '../../../lib/types';
import { ExpedienteFormShell } from './ExpedienteFormShell';

type FormState = {
  poliza: string;
  tipo: string;
  aseguradora: string;
  modalidadPoliza: string;
  cupoId: string;
  valor: number;
  porcentaje: number;
  fechaInicio: string;
  fechaVenc: string;
};

/**
 * VISTA dedicada de alta de pólizas del expediente (antes modal en TabGarantias).
 * Reglas del handler original: póliza, valor y vigencias obligatorias, vencimiento ≥ inicio,
 * cupo condicional a la modalidad y registro en estado «Pendiente» de aprobación.
 * Endurecimiento acordado: póliza obligatoria con trim y valor > 0. Las advertencias
 * en vivo de cupo (disponible insuficiente / vence tras el cupo) no bloquean el guardado.
 */
export const GarantiaForm = ({ cid, onDone }: { cid: string; onDone: () => void }) => {
  const [form, setForm] = useState<FormState>({
    poliza: '',
    tipo: CAT('tiposGarantia')[0] || 'Cumplimiento',
    aseguradora: CAT('aseguradoras')[0] || '',
    modalidadPoliza: 'Individual',
    cupoId: '',
    valor: 0,
    porcentaje: 10,
    fechaInicio: todayIso(),
    fechaVenc: ''
  });
  const [intentado, setIntentado] = useState(false);
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  // Advertencias en vivo al usar cupo (files/06): disponible insuficiente o póliza que vence tras el cupo
  const allCupos = Store.all('cupos') as Cupo[];
  const cuposForAseg = allCupos.filter((cp) => cp.aseguradora === form.aseguradora && cp.estado === 'Vigente');
  const cupoElegido = allCupos.find((cp) => cp.id === form.cupoId);
  const cupoDisp = cupoElegido ? cupoStats(cupoElegido).disponible : null;
  const excedeCupo = cupoDisp != null && Number(form.valor) > cupoDisp;
  const venceTrasCupo = !!cupoElegido?.fechaVenc && form.fechaVenc > cupoElegido.fechaVenc;

  const errores: string[] = [];
  if (!form.poliza.trim()) errores.push('El número de la póliza es obligatorio.');
  if (!form.valor || Number(form.valor) <= 0) errores.push('Ingresa un valor asegurado mayor a cero.');
  if (!form.fechaInicio) errores.push('La fecha de inicio de vigencia es obligatoria.');
  if (!form.fechaVenc) errores.push('La fecha de vencimiento de vigencia es obligatoria.');
  if (form.fechaVenc && form.fechaInicio && form.fechaVenc < form.fechaInicio)
    errores.push('El vencimiento no puede ser anterior al inicio.');
  if (form.modalidadPoliza === 'Póliza por cupo' && !form.cupoId)
    errores.push('Selecciona el cupo de la aseguradora para esta póliza por cupo.');

  const guardar = () => {
    setIntentado(true);
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }
    if (!AuthService.guard('crear')) return;

    const garObj: Guarantee = {
      id: uid('GR'),
      contractId: cid,
      tipo: form.tipo,
      aseguradora: form.aseguradora,
      poliza: form.poliza.trim(),
      modalidadPoliza: form.modalidadPoliza,
      cupoId: form.cupoId || '',
      porcentaje: Number(form.porcentaje) || 0,
      valor: Number(form.valor),
      fechaInicio: form.fechaInicio,
      fechaVenc: form.fechaVenc,
      estado: 'Pendiente',
      documento: `${form.poliza.trim()}.pdf`
    };

    Store.insert('guarantees', garObj);
    Audit.log({
      contractId: cid,
      modulo: 'Garantías',
      accion: 'Creación',
      campo: 'Póliza ' + garObj.poliza,
      nuevo: money(form.valor)
    });
    notify('Póliza registrada (Pendiente de aprobación)');
    onDone();
  };

  return (
    <ExpedienteFormShell
      cid={cid}
      tab="garantias"
      paso="Nueva póliza"
      title="Registrar póliza de garantía"
      description="Amparo del contrato (cumplimiento, calidad, salarios, responsabilidad civil u otros); entra «Pendiente» hasta la aprobación del supervisor."
      errores={errores}
      intentado={intentado}
      onSubmit={guardar}
      submitLabel="Registrar póliza"
      submitIcon="shield"
      onCancel={onDone}
      nota={
        <>
          {form.modalidadPoliza === 'Póliza por cupo' && (
            <div className="alert-box warn mb" role="status">
              {cupoDisp != null && excedeCupo && (
                <p>
                  El valor supera el disponible del cupo (<b className="mono">{money(cupoDisp)}</b>). Si procede,
                  coordina la ampliación con la aseguradora antes de la aprobación.
                </p>
              )}
              {venceTrasCupo && (
                <p>
                  La póliza vencería <b>{form.fechaVenc}</b>, después del vencimiento del cupo. Revisa la vigencia
                  requerida en los amparos contractuales.
                </p>
              )}
              {cupoDisp != null && !excedeCupo && !venceTrasCupo && (
                <p>
                  Cupo seleccionado: disponible <b className="mono">{money(cupoDisp)}</b> tras registrar este
                  valor.
                </p>
              )}
            </div>
          )}
          <p className="small muted" style={{ margin: '0 0 12px' }}>
            El porcentaje expresado respecto del valor del contrato deriva el valor asegurado en las pólizas
            típicas; la cobertura se recalcula al aprobar.
          </p>
        </>
      }
    >
      <FormGrid className="form-grid">
        <Field className="f">
          <label className="req">Número de póliza</label>
          <Input value={form.poliza} onChange={(e) => set({ poliza: e.target.value })} placeholder="Ej. 1234-CP" />
        </Field>
        <Field className="f">
          <label>Tipo de amparo</label>
          <Select value={form.tipo} onChange={(e) => set({ tipo: e.target.value })}>
            {CAT('tiposGarantia').map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field className="f">
          <label>Aseguradora</label>
          <Select value={form.aseguradora} onChange={(e) => set({ aseguradora: e.target.value, cupoId: '' })}>
            {CAT('aseguradoras').map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </Field>
        <Field className="f">
          <label>Modalidad</label>
          <Select
            value={form.modalidadPoliza}
            onChange={(e) => set({ modalidadPoliza: e.target.value, cupoId: '' })}
          >
            <option value="Individual">Individual</option>
            <option value="Póliza por cupo">Póliza por cupo</option>
          </Select>
        </Field>
        {form.modalidadPoliza === 'Póliza por cupo' && (
          <Field className="f">
            <label className="req">Cupo de la aseguradora</label>
            <Select value={form.cupoId} onChange={(e) => set({ cupoId: e.target.value })}>
              <option value="">— Seleccione el cupo —</option>
              {cuposForAseg.map((cp) => (
                <option key={cp.id} value={cp.id}>
                  {cp.numero} (disponible {money(cupoStats(cp).disponible)})
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field className="f">
          <label className="req">Valor asegurado (COP)</label>
          <Input
            type="number"
            min="0"
            step="100000"
            value={form.valor || ''}
            onChange={(e) => set({ valor: Number(e.target.value) })}
          />
        </Field>
        <Field className="f">
          <label>% del valor del contrato</label>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={form.porcentaje || ''}
            onChange={(e) => set({ porcentaje: Number(e.target.value) })}
          />
        </Field>
        <Field className="f">
          <label className="req">Inicio de vigencia</label>
          <Input type="date" value={form.fechaInicio} onChange={(e) => set({ fechaInicio: e.target.value })} />
        </Field>
        <Field className="f">
          <label className="req">Vencimiento de vigencia</label>
          <Input type="date" value={form.fechaVenc} onChange={(e) => set({ fechaVenc: e.target.value })} />
        </Field>
      </FormGrid>
    </ExpedienteFormShell>
  );
};
