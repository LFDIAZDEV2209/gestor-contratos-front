'use client';
import { useState } from 'react';
import { useSoportes } from '../../ui/Soportes';
import { contractHref } from '../../app/routes';
import { Input, Select, Textarea } from '../../ui/Controls';
import { notify } from '../../ui/Feedback';
import { FormGrid, Field } from '../../ui/Workspace';
import { Store, AuthService, Audit } from '../../../lib/store';
import { money, todayIso, addDays, uid } from '../../../lib/format';
import type { Contract, Subcontract } from '../../../lib/types';
import { ExpedienteFormShell, createFieldValidation } from './ExpedienteFormShell';
import { guardExpedienteRecord } from './ExpedienteRoute';

type FormState = {
  numero: string;
  contratista: string;
  nit: string;
  valor: number;
  fechaInicio: string;
  fechaFin: string;
  ejecucion: number;
  estado: string;
  objeto: string;
  documentos: string;
};

/**
 * VISTA dedicada del subcontrato derivado (antes modales alta/edición en TabSubcontratos).
 * Reglas del handler original: número/contratista obligatorios con trim y valor > 0;
 * responsable por defecto el supervisor del principal; objeto con fallback.
 * Endurecimiento acordado: NIT y objeto obligatorios (estaban marcados así en el modal),
 * terminación posterior al inicio y ejecución acotada 0–100.
 */
export const SubcontratoForm = ({ cid, recordId, onDone }: { cid: string; recordId?: string; onDone: () => void }) => {
  const sop = useSoportes(cid, contractHref(cid, 'subcontratos'));
  const c = Store.get('contracts', cid) as Contract;
  const actual = recordId ? (Store.get('subcontracts', recordId) as Subcontract | undefined) : undefined;
  const isEdit = !!actual;
  const [form, setForm] = useState<FormState>({
    numero: actual?.numero || '',
    contratista: actual?.contratista || '',
    nit: actual?.nit || '',
    valor: actual ? Number(actual.valor) : 0,
    fechaInicio: actual?.fechaInicio || todayIso(),
    fechaFin: actual?.fechaFin || addDays(todayIso(), 180),
    ejecucion: actual ? Number(actual.ejecucion) || 0 : 0,
    estado: actual?.estado || 'Activo',
    objeto: actual?.objeto || '',
    documentos: actual?.documentos || ''
  });
  const [intentado, setIntentado] = useState(false);
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!form.numero.trim()) addError("numero", 'El número del subcontrato es obligatorio.');
  if (!form.contratista.trim()) addError("contratista", 'El nombre o razón social del subcontratista es obligatorio.');
  if (!form.nit.trim()) addError("nit", 'El NIT o identificación tributaria es obligatoria.');
  if (!form.valor || Number(form.valor) <= 0) addError("valor", 'Ingresa un valor válido mayor a cero.');
  if (form.fechaFin && form.fechaInicio && form.fechaFin < form.fechaInicio)
    addError("fechaFin", 'La fecha de terminación no puede ser anterior al inicio.');
  if (form.ejecucion < 0 || form.ejecucion > 100) addError("ejecucion", 'El porcentaje de ejecución debe estar entre 0 y 100.');
  if (!form.objeto.trim()) addError("objeto", 'El objeto específico del subcontrato es obligatorio.');

  const guardar = async () => {
    if (sop.bloqueado()) return;
    setIntentado(true);
    if (recordId && !guardExpedienteRecord(cid, 'subcontracts', recordId)) {
      notify('El registro ya no pertenece a este expediente.');
      return;
    }
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }
    if (!AuthService.guard(isEdit ? 'editar' : 'crear')) return;

    if (isEdit) {
      const avance = Math.min(100, Math.max(0, Number(form.ejecucion) || 0));
      Store.update('subcontracts', actual!.id, {
        numero: form.numero.trim(),
        contratista: form.contratista.trim(),
        nit: form.nit.trim(),
        objeto: form.objeto.trim(),
        valor: Number(form.valor) || 0,
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin,
        ejecucion: avance,
        estado: form.estado,
        responsable: actual!.responsable,
        documentos: form.documentos
      });
      Audit.log({
        contractId: cid,
        modulo: 'Subcontratos',
        accion: 'Edición',
        campo: 'Subcontrato ' + actual!.numero,
        nuevo: `${form.contratista.trim()} · ${money(Number(form.valor))}`
      });
      notify(`Subcontrato ${form.numero.trim()} actualizado`);
    } else {
      const newSub: Subcontract = {
        id: uid('SC'),
        contractId: cid,
        numero: form.numero.trim(),
        contratista: form.contratista.trim(),
        nit: form.nit.trim(),
        objeto: form.objeto.trim(),
        valor: Number(form.valor),
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin,
        ejecucion: Number(form.ejecucion) || 0,
        estado: form.estado,
        responsable: c.supervisor || 'Supervisor',
        documentos: form.documentos
      };
      Store.insert('subcontracts', newSub);
      Audit.log({
        contractId: cid,
        modulo: 'Subcontratos',
        accion: 'Creación',
        campo: 'Nuevo subcontrato ' + newSub.numero,
        nuevo: `${newSub.contratista} · ${money(newSub.valor)}`
      });
      notify(`Subcontrato ${newSub.numero} registrado con éxito`);
    }
    await sop.finalizar(onDone);
  };

  return (
    <ExpedienteFormShell
      fieldErrors={fieldErrors}
      cid={cid}
      tab="subcontratos"
      paso={isEdit ? `Editar subcontrato · ${actual!.numero}` : 'Nuevo subcontrato'}
      title={isEdit ? `Editar subcontrato · ${actual!.numero}` : 'Nuevo subcontrato derivado'}
      description={
        isEdit
          ? 'Actualiza los datos del subcontrato derivado; el principal queda vinculado y su responsable se conserva.'
          : 'Labor o actividad delegada del contrato principal; queda en el árbol jerárquico de la pestaña Subcontratos.'
      }
      errores={errores}
      intentado={intentado}
      onSubmit={guardar}
      submitting={sop.subiendo}
      soportes={sop.node}
      submitLabel={isEdit ? 'Guardar cambios' : 'Guardar subcontrato'}
      submitIcon="check"
      onCancel={onDone}
      nota={
        <p className="small muted" style={{ margin: '0 0 12px' }}>
          El responsable por defecto es {c.supervisor || 'el supervisor'} del contrato principal; la ejecución se
          mide de 0 a 100 y alimenta el árbol de delegación.
        </p>
      }
    >
      <FormGrid className="form-grid">
        <Field className="f">
          <label className="req">Número de subcontrato</label>
          <Input name="numero"
            value={form.numero}
            placeholder="Ej. SC-001 o SUB-2026-01"
            onChange={(e) => set({ numero: e.target.value })}
            required
          />
        </Field>
        <Field className="f">
          <label className="req">Nombre o Razón Social del subcontratista</label>
          <Input name="contratista"
            value={form.contratista}
            placeholder="Nombre de la empresa subcontratada"
            onChange={(e) => set({ contratista: e.target.value })}
            required
          />
        </Field>
        <Field className="f">
          <label className="req">NIT / Identificación tributaria</label>
          <Input name="nit" value={form.nit} placeholder="900.000.000-0" onChange={(e) => set({ nit: e.target.value })} required />
        </Field>
        <Field className="f">
          <label className="req">Valor del subcontrato (COP)</label>
          <Input name="valor"
            type="number"
            min="0"
            step="1000"
            value={form.valor || ''}
            onChange={(e) => set({ valor: Number(e.target.value) })}
            required
          />
        </Field>
        <Field className="f">
          <label className="req">Fecha de inicio</label>
          <Input name="fechaInicio" type="date" value={form.fechaInicio} onChange={(e) => set({ fechaInicio: e.target.value })} required />
        </Field>
        <Field className="f">
          <label className="req">Fecha de terminación</label>
          <Input name="fechaFin" type="date" value={form.fechaFin} onChange={(e) => set({ fechaFin: e.target.value })} required />
        </Field>
        <Field className="f">
          <label>% Ejecución actual (0–100)</label>
          <Input name="ejecucion"
            type="number"
            min="0"
            max="100"
            value={form.ejecucion || ''}
            onChange={(e) => set({ ejecucion: Number(e.target.value) })}
          />
        </Field>
        <Field className="f">
          <label>Estado operativo</label>
          <Select name="estado" value={form.estado} onChange={(e) => set({ estado: e.target.value })}>
            <option value="Activo">Activo</option>
            <option value="Suspendido">Suspendido</option>
            <option value="Terminado">Terminado</option>
            <option value="Liquidado">Liquidado</option>
          </Select>
        </Field>
        <Field className="f span2">
          <label className="req">Objeto específico del subcontrato</label>
          <Textarea name="objeto"
            rows={2}
            value={form.objeto}
            placeholder="Alcance, labores o actividades delegadas formalmente..."
            onChange={(e) => set({ objeto: e.target.value })}
            required
          />
        </Field>
        <Field className="f span2">
          <label>Soportes, pólizas y documentos radicados</label>
          <Input name="documentos"
            value={form.documentos}
            placeholder="Ej. Contrato suscrito, ARL, póliza de cumplimiento..."
            onChange={(e) => set({ documentos: e.target.value })}
          />
        </Field>
      </FormGrid>
    </ExpedienteFormShell>
  );
};
