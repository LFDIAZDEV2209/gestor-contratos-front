'use client';

import { useState } from 'react';
import { AvisoApi } from '../ui/AvisoApi';
import { useFormCancel } from './useFormCancel';
import { AccessibleForm, createFieldValidation } from './AccessibleForm';
import Link from 'next/link';
import { Input, Textarea } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, Field } from '../ui/Workspace';
import { FormSection } from '../ui/FormSection';
import type { Document } from '../../lib/types';
import { AuthService } from '../../lib/store';
import { fdate } from '../../lib/format';
import { subirNuevaVersion, advertenciasDe, esConflicto, mensajeErrorDocumento, ultimaVersion, MAX_ARCHIVO_MB } from '../../lib/documents';
import { Icon } from '../icons';

/**
 * Nueva versión de un documento en VISTA dedicada (reemplaza al modal de
 * "Cargar nueva versión" de DocumentosView). Numeración consecutiva:
 * n = versions.length + 1 y el historial anterior se conserva íntegro.
 */
export const VersionDocumentoForm = ({
  doc,
  onDone
}: {
  doc: Document;
  onDone: (savedId: string) => void;
}) => {
  const cancelar = useFormCancel("/documentos");
  const [intentado, setIntentado] = useState(false);
  const [form, setForm] = useState({ motivo: '', cambios: '' });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [errorApi, setErrorApi] = useState('');
  const [advertencias, setAdvertencias] = useState<string[]>([]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const versions = doc.versions || [];
  const last = ultimaVersion(doc);
  const nextV = (last?.v ?? 0) + 1;

  const errCampo: Record<string, string> = {};
  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!archivo) {
    errCampo.archivo = 'Selecciona el archivo de esta versión.';
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
      await subirNuevaVersion(doc.id, form.motivo.trim() || 'Actualización de versión', form.cambios.trim() || undefined, archivo!, force);
      // Simplificación aceptada: recarga completa para que AppShell re-hidrate del API.
      window.location.assign(`/documentos/${encodeURIComponent(doc.id)}`);
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
    if (!AuthService.guard('editar')) return;

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
            <Link href="/documentos">{doc.nombre}</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <span aria-current="page">Nueva versión</span>
          </nav>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            Cargar nueva versión
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                padding: '2px 8px',
                borderRadius: 'var(--r-pill)',
                background: 'var(--brand-soft)',
                color: 'var(--brand-2)'
              }}
            >
              v{nextV}
            </span>
          </h1>
          <p style={{ margin: '4px 0 0' }}>
            El historial anterior se conserva completo; esta carga queda como última versión del
            documento «{doc.nombre}».
          </p>
        </div>
      </PageHeader>

      {/* Contexto del documento: última versión registrada */}
      <Surface className="panel mb">
        <div className="panel-h">
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <Icon name="file-text" /> {doc.nombre}
            </h2>
            <span className="sub small muted">
              Categoría {doc.categoria} · {versions.length} versión(es) · Estado {doc.estado}
            </span>
          </div>
        </div>
        <div className="dl" style={{ border: 0, borderTop: '1px solid var(--line)' }}>
          <div>
            <span>Versión actual</span>
            <b>v{last ? last.v : 1}</b>
          </div>
          <div>
            <span>Última fecha</span>
            <b>{last ? fdate(last.fecha) : '—'}</b>
          </div>
          <div>
            <span>Último archivo</span>
            <b style={{ overflowWrap: 'anywhere' }}>{last ? last.archivo : '—'}</b>
          </div>
          <div>
            <span>Registró</span>
            <b>{last ? last.usuario : '—'}</b>
          </div>
          <div>
            <span>Motivo</span>
            <b style={{ overflowWrap: 'anywhere' }}>{last ? last.motivo || '—' : '—'}</b>
          </div>
        </div>
      </Surface>

      <Surface className="panel mb">

        <FormSection title={<>Carga de la versión v{nextV}</>} icon="upload" description={<>Archivo, motivo y detalle de los cambios aplicados</>} accent>
          <Field className={`f span3${err('archivo') ? ' err' : ''}`}>
            <label className="req">Nuevo archivo</label>
            <Input name="archivo"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              aria-describedby={err('archivo') ? 'err-varchivo' : undefined}
            />
            {err('archivo') && (
              <span className="emsg" id="err-varchivo"><span aria-hidden="true"><Icon name="alert-circle" size={13} /></span>
                {err('archivo')}
              </span>
            )}
            <span className="hint">Máximo {MAX_ARCHIVO_MB} MB.</span>
          </Field>

          <Field className="f span3">
            <label>Motivo de la nueva versión</label>
            <Input name="motivo"
              value={form.motivo}
              placeholder="Ej. Ajuste de cláusula / adición de firmas"
              onChange={(e) => set({ motivo: e.target.value })}
            />
          </Field>

          <Field className="f span3">
            <label>Descripción de cambios</label>
            <Textarea name="cambios"
              rows={4}
              value={form.cambios}
              placeholder="Detalle de modificaciones en esta versión..."
              onChange={(e) => set({ cambios: e.target.value })}
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
          <Icon name="upload" /> {subiendo ? 'Subiendo…' : `Guardar versión v${nextV}`}
        </Button>
      </div>
    </AccessibleForm>
  );
};
