'use client';

import { useState } from 'react';
import { useFormCancel } from './useFormCancel';
import { AccessibleForm, createFieldValidation } from './AccessibleForm';
import Link from 'next/link';
import { Input, Textarea } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, FormGrid, Field } from '../ui/Workspace';
import type { Document, DocumentVersion } from '../../lib/types';
import { Store, Audit, AuthService } from '../../lib/store';
import { fdate, todayIso } from '../../lib/format';
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
  const [form, setForm] = useState({ archivo: '', motivo: '', cambios: '' });

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const versions = doc.versions || [];
  const last = versions[versions.length - 1];
  const nextV = versions.length + 1;

  const archivo = form.archivo.trim();
  const errCampo: Record<string, string> = {};
  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!archivo) {
    errCampo.archivo = 'Ingresa el nombre del archivo de esta versión.';
    addError("archivo", 'El archivo es obligatorio.');
  }

  const guardar = () => {
    setIntentado(true);
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }
    if (!AuthService.guard('editar')) return;

    const currentVersions = doc.versions || [];
    const newVer: DocumentVersion = {
      v: currentVersions.length + 1,
      fecha: todayIso(),
      usuario: AuthService.currentUser().nombre,
      archivo,
      motivo: form.motivo.trim() || 'Actualización de versión',
      cambios: form.cambios
    };

    const updatedVersions = [...currentVersions, newVer];
    Store.update('documents', doc.id, { versions: updatedVersions });

    Audit.log({
      contractId: doc.contractId,
      modulo: 'Documentos',
      accion: 'Edición',
      campo: `Documento ${doc.nombre}`,
      anterior: `v${currentVersions.length}`,
      nuevo: `v${newVer.v} (${newVer.archivo})`
    });

    notify(`Documento «${doc.nombre}» actualizado a v${newVer.v}.`);
    onDone(doc.id);
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
        <div className="panel-h">
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <Icon name="upload" /> Carga de la versión v{nextV}
            </h2>
            <span className="sub small muted">Archivo, motivo y detalle de los cambios aplicados</span>
          </div>
        </div>

        <FormGrid className="form-grid">
          <Field className={`f span3${err('archivo') ? ' err' : ''}`}>
            <label className="req">Nuevo archivo</label>
            <Input name="archivo"
              value={form.archivo}
              placeholder="Ej. contrato_firmado_v2.pdf"
              onChange={(e) => set({ archivo: e.target.value })}
              aria-describedby={err('archivo') ? 'err-varchivo' : undefined}
            />
            {err('archivo') && (
              <span className="emsg" id="err-varchivo">
                {err('archivo')}
              </span>
            )}
            <span className="hint">Nombre o ruta simulada; no se realiza una transferencia real.</span>
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
        </FormGrid>
      </Surface>



      <div className="form-foot">
        <Button className="btn ghost" onClick={cancelar}>
          <Icon name="chevron-left" /> Cancelar
        </Button>
        <Button className="btn pri" onClick={guardar}>
          <Icon name="upload" /> Guardar versión v{nextV}
        </Button>
      </div>
    </AccessibleForm>
  );
};
