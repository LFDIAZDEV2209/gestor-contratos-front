'use client';
import { useState } from 'react';
import { Input, Textarea } from '../../ui/Controls';
import { notify } from '../../ui/Feedback';
import { FormGrid, Field } from '../../ui/Workspace';
import { Store, AuthService, Audit } from '../../../lib/store';
import { todayIso, addDays, uid } from '../../../lib/format';
import type { Contract, Deliverable } from '../../../lib/types';
import { ExpedienteFormShell } from './ExpedienteFormShell';

type FormState = { nombre: string; descripcion: string; fechaInicio: string; fechaProg: string; responsable: string };

/**
 * VISTA dedicada del entregable contractual (antes modales alta/edición en TabEntregables).
 * Edita solo la FICHA de planificación (nombre, descripción, fechas, responsable): no toca
 * estado/avance/evidencia del seguimiento — eso vive en la vista de gestión de entrega.
 */
export const EntregableForm = ({ cid, recordId, onDone }: { cid: string; recordId?: string; onDone: () => void }) => {
  const c = Store.get('contracts', cid) as Contract;
  const actual = recordId ? (Store.get('deliverables', recordId) as Deliverable | undefined) : undefined;
  const u = AuthService.currentUser();
  const isEdit = !!actual;
  const [form, setForm] = useState<FormState>({
    nombre: actual?.nombre || '',
    descripcion: actual?.descripcion || '',
    fechaInicio: actual?.fechaInicio || todayIso(),
    fechaProg: actual?.fechaProg || addDays(todayIso(), 30),
    responsable: actual?.responsable || ''
  });
  const [intentado, setIntentado] = useState(false);
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const errores: string[] = [];
  if (!form.nombre.trim()) errores.push('El nombre del entregable es obligatorio.');
  if (!form.fechaProg) errores.push('La fecha programada de entrega es obligatoria.');
  if (form.fechaProg && form.fechaInicio && form.fechaProg < form.fechaInicio)
    errores.push('La fecha programada no puede ser anterior a la fecha de inicio.');

  const guardar = () => {
    setIntentado(true);
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }
    if (!AuthService.guard(isEdit ? 'editar' : 'crear')) return;

    if (isEdit) {
      // Solo campos de la ficha: el seguimiento (estado/avance/evidencia) queda intacto.
      Store.update('deliverables', actual!.id, {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        fechaInicio: form.fechaInicio,
        fechaProg: form.fechaProg,
        responsable: form.responsable.trim()
      });
      Audit.log({
        contractId: cid,
        modulo: 'Entregables',
        accion: 'Edición',
        campo: 'Datos entregable ' + actual!.id,
        nuevo: form.nombre.trim()
      });
      notify(`Entregable "${form.nombre.trim()}" actualizado`);
    } else {
      const dObj: Deliverable = {
        id: uid('EN'),
        contractId: cid,
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        fechaInicio: form.fechaInicio,
        fechaProg: form.fechaProg,
        responsable: form.responsable.trim() || c.supervisor || u.nombre,
        estado: 'Pendiente',
        avance: 0
      };
      Store.insert('deliverables', dObj);
      Audit.log({
        contractId: cid,
        modulo: 'Entregables',
        accion: 'Creación',
        campo: 'Entregable ' + dObj.id,
        nuevo: dObj.nombre
      });
      notify(`Entregable "${dObj.nombre}" creado exitosamente`);
    }
    onDone();
  };

  return (
    <ExpedienteFormShell
      cid={cid}
      tab="entregables"
      paso={isEdit ? `Editar entregable · ${actual!.nombre}` : 'Nuevo entregable'}
      title={isEdit ? `Editar entregable · ${actual!.nombre}` : 'Nuevo entregable contractual'}
      description={
        isEdit
          ? 'Ajusta la planificación del hito; el estado y el avance registrados en el seguimiento no se modifican aquí.'
          : 'Producto o hito exigido por el contrato; entra «Pendiente» con 0 % y se sigue desde la pestaña Entregables y el cronograma.'
      }
      errores={errores}
      intentado={intentado}
      onSubmit={guardar}
      submitLabel={isEdit ? 'Guardar cambios' : 'Guardar entregable'}
      submitIcon="check"
      onCancel={onDone}
      nota={
        <p className="small muted" style={{ margin: '0 0 12px' }}>
          La gestión de la entrega (estado, avance, radicado y observaciones) se hace desde la acción
          «Gestionar entrega» de la pestaña, que abre su propia vista.
        </p>
      }
    >
      <FormGrid className="form-grid">
        <Field className="f span2">
          <label className="req">Nombre del entregable / producto</label>
          <Input
            value={form.nombre}
            onChange={(e) => set({ nombre: e.target.value })}
            placeholder="Ej. Informe técnico de interventoría o acta de avance..."
            required
          />
        </Field>
        <Field className="f span2">
          <label>Descripción / Criterio de aceptación</label>
          <Textarea
            rows={2}
            value={form.descripcion}
            onChange={(e) => set({ descripcion: e.target.value })}
            placeholder="Detalle de condiciones técnicas y formales para aprobación..."
          />
        </Field>
        <Field className="f">
          <label className="req">Fecha planificada de inicio</label>
          <Input type="date" value={form.fechaInicio} onChange={(e) => set({ fechaInicio: e.target.value })} required />
        </Field>
        <Field className="f">
          <label className="req">Fecha programada de entrega</label>
          <Input type="date" value={form.fechaProg} onChange={(e) => set({ fechaProg: e.target.value })} required />
        </Field>
        <Field className="f span2">
          <label>Responsable de entrega o revisión</label>
          <Input
            value={form.responsable}
            onChange={(e) => set({ responsable: e.target.value })}
            placeholder={c.contratista || 'Nombre del responsable asignado'}
          />
        </Field>
      </FormGrid>
    </ExpedienteFormShell>
  );
};
