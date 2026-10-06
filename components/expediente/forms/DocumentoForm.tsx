'use client';
import { useState } from 'react';
import { AvisoApi } from '../../ui/AvisoApi';
import { Input, Select } from '../../ui/Controls';
import { notify } from '../../ui/Feedback';
import { FormGrid, Field } from '../../ui/Workspace';
import { AuthService } from '../../../lib/store';
import { CAT } from '../../../lib/catalog';
import { subirDocumento, advertenciasDe, esConflicto, mensajeErrorDocumento, MAX_ARCHIVO_MB } from '../../../lib/documents';
import { contractHref } from '../../app/routes';
import { ExpedienteFormShell, createFieldValidation } from './ExpedienteFormShell';

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
    obs: ''
  });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [errorApi, setErrorApi] = useState('');
  const [advertencias, setAdvertencias] = useState<string[]>([]);
  const [intentado, setIntentado] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!form.nombre.trim()) addError("nombre", 'El nombre del documento es obligatorio.');
  if (!archivo) addError("archivo", 'Selecciona el archivo a subir.');
  else if (archivo.size > MAX_ARCHIVO_MB * 1024 * 1024) addError("archivo", `El archivo supera ${MAX_ARCHIVO_MB} MB.`);

  const enviar = async (force: boolean) => {
    setErrorApi('');
    setAdvertencias([]);
    setSubiendo(true);
    try {
      await subirDocumento(cid, form.nombre.trim(), form.categoria, form.obs.trim() || undefined, archivo!, force);
      // Simplificación aceptada: recarga completa para que AppShell re-hidrate del API.
      window.location.assign(contractHref(cid, 'documentos'));
    } catch (e) {
      const w = advertenciasDe(e);
      if (w) setAdvertencias(w);
      else {
        setErrorApi(mensajeErrorDocumento(e));
        if (esConflicto(e)) setTimeout(() => window.location.reload(), 1500);
      }
      setSubiendo(false);
    }
  };

  const guardar = async () => {
    if (subiendo) return;
    setIntentado(true);
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }
    if (!AuthService.guard('crear')) return;

    await enviar(false);
  };

  return (
    <ExpedienteFormShell
      fieldErrors={fieldErrors}
      cid={cid}
      tab="documentos"
      paso="Cargar documento"
      title="Cargar nuevo documento al expediente"
      description="Cualquier soporte requerido por la cláusula de administración contract­ual; queda con versión inicial v1 y su historial se conserva aunque se anule."
      errores={errores}
      intentado={intentado}
      onSubmit={guardar}
      submitting={subiendo}
      submitLabel="Guardar documento"
      submitIcon="upload"
      onCancel={onDone}
      nota={
        <>
          <p className="small muted" style={{ margin: '0 0 12px' }}>
            El archivo se almacena de forma segura. Las sucesivas versiones se registran desde la ficha del
            documento, que conserva el historial completo.
          </p>
          <AvisoApi error={errorApi} advertencias={advertencias} onForzar={() => enviar(true)} cargando={subiendo} />
        </>
      }
    >
      <FormGrid className="form-grid">
        <Field className="f span2">
          <label className="req">Nombre del documento</label>
          <Input name="nombre"
            value={form.nombre}
            onChange={(e) => set({ nombre: e.target.value })}
            placeholder="Ej. Acta de entrega fase 1"
          />
        </Field>
        <Field className="f">
          <label>Categoría</label>
          <Select name="categoria" value={form.categoria} onChange={(e) => set({ categoria: e.target.value })}>
            {cats.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field className={`f span2${intentado && fieldErrors.archivo ? ' err' : ''}`}>
          <label className="req">Archivo adjunto (PDF / Word / Excel)</label>
          <Input name="archivo"
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          />
          {intentado && fieldErrors.archivo && <span className="emsg">{fieldErrors.archivo}</span>}
        </Field>
      </FormGrid>
    </ExpedienteFormShell>
  );
};
