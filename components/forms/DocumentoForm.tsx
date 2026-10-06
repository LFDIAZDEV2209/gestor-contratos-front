'use client';

import { useState } from 'react';
import { AvisoApi } from '../ui/AvisoApi';
import { useFormCancel } from './useFormCancel';
import { AccessibleForm, createFieldValidation } from './AccessibleForm';
import Link from 'next/link';
import { Input, Select, Textarea } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, Field } from '../ui/Workspace';
import { FormSection } from '../ui/FormSection';
import { Store, AuthService } from '../../lib/store';
import { CAT } from '../../lib/catalog';
import { subirDocumento, advertenciasDe, esConflicto, mensajeErrorDocumento, MAX_ARCHIVO_MB } from '../../lib/documents';
import { Icon } from '../icons';

/**
 * Carga de documento en VISTA dedicada (reemplaza al modal de DocumentosView).
 * Conserva la versión inicial con usuario, fecha y motivo. El archivo sigue
 * siendo simulado: si se deja vacío se genera el nombre por defecto.
 */
export const DocumentoForm = ({ onDone }: { onDone: (savedId: string) => void }) => {
  const cancelar = useFormCancel("/documentos");
  const [intentado, setIntentado] = useState(false);
  const [form, setForm] = useState({
    contractId: '',
    nombre: '',
    categoria: 'Contrato',
    obs: ''
  });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [errorApi, setErrorApi] = useState('');
  const [advertencias, setAdvertencias] = useState<string[]>([]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const contracts = Store.all('contracts').filter((c) => !c.anulado);

  const nombre = form.nombre.trim();
  const errCampo: Record<string, string> = {};
  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!form.contractId) {
    errCampo.contractId = 'Selecciona el contrato al que pertenece el documento.';
    addError("contractId", 'El contrato es obligatorio.');
  }
  if (!nombre) {
    errCampo.nombre = 'Ingresa el nombre con el que se indexará el documento.';
    addError("nombre", 'El nombre del documento es obligatorio.');
  }

  if (!archivo) {
    errCampo.archivo = 'Selecciona el archivo a subir.';
    addError("archivo", 'El archivo es obligatorio.');
  } else if (archivo.size > MAX_ARCHIVO_MB * 1024 * 1024) {
    errCampo.archivo = `El archivo supera ${MAX_ARCHIVO_MB} MB.`;
    addError("archivo", errCampo.archivo);
  }

  const enviar = async (force: boolean) => {
    setErrorApi('');
    setAdvertencias([]);
    setSubiendo(true);
    try {
      await subirDocumento(form.contractId, nombre, form.categoria, form.obs.trim() || undefined, archivo!, force);
      // Simplificación aceptada: recarga completa para que AppShell re-hidrate del API.
      window.location.assign('/documentos');
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

  const err = (campo: string) => (intentado ? errCampo[campo] : undefined);

  return (
    <AccessibleForm errors={fieldErrors} attempted={intentado}>
      <PageHeader className="ph">
        <div>
          <nav aria-label="Ruta de navegación" className="crumb" style={{ width: '100%', marginBottom: 6 }}>
            <Link href="/documentos">Documentos</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <span aria-current="page">Nuevo documento</span>
          </nav>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            Cargar nuevo documento
          </h1>
          <p style={{ margin: '4px 0 0' }}>
            Indexa un documento del expediente con su versión inicial; cada carga posterior queda
            registrada en el historial inmutable.
          </p>
        </div>
      </PageHeader>

      <Surface className="panel mb">

        <FormSection title={<>Identificación</>} icon="folder-tree" description={<>Contrato, nombre y categoría del documento</>} accent>
          <Field className={`f span3${err('contractId') ? ' err' : ''}`}>
            <label className="req">Contrato</label>
            <Select name="contractId"
              value={form.contractId}
              onChange={(e) => set({ contractId: e.target.value })}
              aria-describedby={err('contractId') ? 'err-dcontrato' : undefined}
            >
              <option value="">— Seleccione contrato —</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} · {c.contratista}
                </option>
              ))}
            </Select>
            {err('contractId') && (
              <span className="emsg" id="err-dcontrato"><span aria-hidden="true"><Icon name="alert-circle" size={13} /></span>
                {err('contractId')}
              </span>
            )}
          </Field>

          <Field className={`f span2${err('nombre') ? ' err' : ''}`}>
            <label className="req">Nombre del documento</label>
            <Input name="nombre"
              value={form.nombre}
              placeholder="Ej. Minuta del contrato firmada"
              onChange={(e) => set({ nombre: e.target.value })}
              aria-describedby={err('nombre') ? 'err-dnombre' : undefined}
            />
            {err('nombre') && (
              <span className="emsg" id="err-dnombre"><span aria-hidden="true"><Icon name="alert-circle" size={13} /></span>
                {err('nombre')}
              </span>
            )}
          </Field>

          <Field className="f">
            <label className="req">Categoría</label>
            <Select name="categoria" value={form.categoria} onChange={(e) => set({ categoria: e.target.value })}>
              {CAT('categoriasDoc').map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Select>
          </Field>

          <Field className={`f span3${err('archivo') ? ' err' : ''}`}>
            <label className="req">Archivo</label>
            <Input name="archivo"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              aria-describedby={err('archivo') ? 'err-darchivo' : undefined}
            />
            {err('archivo') && (
              <span className="emsg" id="err-darchivo"><span aria-hidden="true"><Icon name="alert-circle" size={13} /></span>
                {err('archivo')}
              </span>
            )}
            <span className="hint">Máximo {MAX_ARCHIVO_MB} MB. Se registra como versión v1.</span>
          </Field>
        </FormSection>
      </Surface>

      <Surface className="panel mb">

        <FormSection title={<>Versión inicial</>} icon="history" description={<>Se registra v1 con el usuario y la fecha de hoy; nunca se elimina</>} accent>
          <Field className="f span3">
            <label>Observaciones</label>
            <Textarea name="obs"
              rows={3}
              value={form.obs}
              placeholder="Notas adicionales sobre el documento..."
              onChange={(e) => set({ obs: e.target.value })}
            />
          </Field>
        </FormSection>
      </Surface>

      <AvisoApi error={errorApi} advertencias={advertencias} onForzar={() => enviar(true)} cargando={subiendo} />

      <div className="form-foot">
        <Button className="btn ghost" onClick={cancelar}>
          <Icon name="chevron-left" /> Cancelar
        </Button>
        <Button className="btn pri" onClick={guardar} loading={subiendo}>
          <Icon name="upload" /> {subiendo ? 'Subiendo…' : 'Subir documento'}
        </Button>
      </div>
    </AccessibleForm>
  );
};
