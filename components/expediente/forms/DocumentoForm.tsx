'use client';
import { useState } from 'react';
import { Input, Select } from '../../ui/Controls';
import { notify } from '../../ui/Feedback';
import { FormGrid, Field } from '../../ui/Workspace';
import { Store, AuthService, Audit } from '../../../lib/store';
import { nowStamp, fdate, uid } from '../../../lib/format';
import { CAT } from '../../../lib/catalog';
import type { Document } from '../../../lib/types';
import { ExpedienteFormShell } from './ExpedienteFormShell';

/**
 * VISTA dedicada de alta de documentos del expediente (antes modal en TabDocumentos).
 * Crea el documento «Activo» con su versión inicial inmutable (usuario + fecha + motivo de carga).
 * `catInicial` permite preseleccionar la categoría (sugerencias de documentos faltantes).
 */
export const DocumentoForm = ({ cid, catInicial, onDone }: { cid: string; catInicial?: string; onDone: () => void }) => {
  const cats = CAT('categoriasDoc');
  const [form, setForm] = useState({
    nombre: '',
    categoria: catInicial && cats.includes(catInicial) ? catInicial : cats[0] || 'Informes',
    archivo: ''
  });
  const [intentado, setIntentado] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const errores: string[] = [];
  if (!form.nombre.trim()) errores.push('El nombre del documento es obligatorio.');

  const guardar = () => {
    setIntentado(true);
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }
    if (!AuthService.guard('crear')) return;

    const u = AuthService.currentUser();
    const docObj: Document = {
      id: uid('DOC'),
      contractId: cid,
      nombre: form.nombre.trim(),
      categoria: form.categoria,
      estado: 'Activo',
      versions: [
        {
          v: 1,
          fecha: fdate(nowStamp()),
          usuario: u.nombre,
          archivo: form.archivo.trim() || `${form.nombre.trim()}.pdf`,
          motivo: 'Carga inicial'
        }
      ]
    };

    Store.insert('documents', docObj);
    Audit.log({
      contractId: cid,
      modulo: 'Documentos',
      accion: 'Creación',
      campo: 'Documento',
      nuevo: docObj.nombre
    });
    notify('Documento registrado en el expediente (v1)');
    onDone();
  };

  return (
    <ExpedienteFormShell
      cid={cid}
      tab="documentos"
      paso="Cargar documento"
      title="Cargar nuevo documento al expediente"
      description="Cualquier soporte requerido por la cláusula de administración contract­ual; queda con versión inicial v1 y su historial se conserva aunque se anule."
      errores={errores}
      intentado={intentado}
      onSubmit={guardar}
      submitLabel="Guardar documento"
      submitIcon="upload"
      onCancel={onDone}
      nota={
        <p className="small muted" style={{ margin: '0 0 12px' }}>
          Los archivos son simulados (nombre y metadatos, sin transferencia real). Las sucesivas versiones se
          registran desde la pestaña Documentos, que conserva el historial completo.
        </p>
      }
    >
      <FormGrid className="form-grid">
        <Field className="f span2">
          <label className="req">Nombre del documento</label>
          <Input
            value={form.nombre}
            onChange={(e) => set({ nombre: e.target.value })}
            placeholder="Ej. Acta de entrega fase 1"
          />
        </Field>
        <Field className="f">
          <label>Categoría</label>
          <Select value={form.categoria} onChange={(e) => set({ categoria: e.target.value })}>
            {cats.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field className="f span2">
          <label>Archivo adjunto (PDF / Word / Excel)</label>
          <Input
            type="text"
            placeholder="Nombre del archivo (ej. Acta_Fase1.pdf)"
            value={form.archivo}
            onChange={(e) => set({ archivo: e.target.value })}
          />
        </Field>
      </FormGrid>
    </ExpedienteFormShell>
  );
};
