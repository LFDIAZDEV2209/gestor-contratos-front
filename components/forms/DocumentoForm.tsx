'use client';

import { useState } from 'react';
import { useFormCancel } from './useFormCancel';
import { AccessibleForm, createFieldValidation } from './AccessibleForm';
import Link from 'next/link';
import { Input, Select, Textarea } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, FormGrid, Field } from '../ui/Workspace';
import type { Document, DocumentVersion } from '../../lib/types';
import { Store, Audit, AuthService } from '../../lib/store';
import { CAT } from '../../lib/catalog';
import { todayIso, uid } from '../../lib/format';
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
    archivo: '',
    motivo: 'Carga inicial',
    obs: ''
  });

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

  const guardar = () => {
    setIntentado(true);
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }
    if (!AuthService.guard('crear')) return;

    const u = AuthService.currentUser();
    const docId = uid('DOC');
    const fileName = form.archivo.trim() || `${nombre.replace(/\s+/g, '_')}.pdf`;

    const initialVersion: DocumentVersion = {
      v: 1,
      fecha: todayIso(),
      usuario: u.nombre,
      archivo: fileName,
      motivo: form.motivo.trim() || 'Carga inicial'
    };

    const newDoc: Document = {
      id: docId,
      contractId: form.contractId,
      nombre,
      categoria: form.categoria,
      estado: 'Activo',
      obs: form.obs,
      versions: [initialVersion]
    };

    Store.insert('documents', newDoc);
    Audit.log({
      contractId: form.contractId,
      modulo: 'Documentos',
      accion: 'Creación',
      campo: 'Documento ' + newDoc.nombre,
      nuevo: `v1 (${initialVersion.archivo})`
    });

    notify(`Documento «${nombre}» cargado como v1.`);
    onDone(newDoc.id);
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
        <div className="panel-h">
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <Icon name="folder-tree" /> Identificación
            </h2>
            <span className="sub small muted">Contrato, nombre y categoría del documento</span>
          </div>
        </div>

        <FormGrid className="form-grid">
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
              <span className="emsg" id="err-dcontrato">
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
              <span className="emsg" id="err-dnombre">
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

          <Field className="f span3">
            <label>Archivo (nombre o ruta simulada)</label>
            <Input name="archivo"
              value={form.archivo}
              placeholder="Ej. contrato_firmado_final.pdf"
              onChange={(e) => set({ archivo: e.target.value })}
            />
            <span className="hint">
              Opcional: si se deja vacío se genera «{nombre ? nombre.replace(/\s+/g, '_') : 'documento'}.pdf».
              No se realiza ninguna transferencia real.
            </span>
          </Field>
        </FormGrid>
      </Surface>

      <Surface className="panel mb">
        <div className="panel-h">
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <Icon name="history" /> Versión inicial
            </h2>
            <span className="sub small muted">
              Se registra v1 con el usuario y la fecha de hoy; nunca se elimina
            </span>
          </div>
        </div>

        <FormGrid className="form-grid">
          <Field className="f span3">
            <label>Motivo de la carga</label>
            <Input name="motivo"
              value={form.motivo}
              placeholder="Ej. Carga inicial"
              onChange={(e) => set({ motivo: e.target.value })}
            />
          </Field>

          <Field className="f span3">
            <label>Observaciones</label>
            <Textarea name="obs"
              rows={3}
              value={form.obs}
              placeholder="Notas adicionales sobre el documento..."
              onChange={(e) => set({ obs: e.target.value })}
            />
          </Field>
        </FormGrid>
      </Surface>



      <div className="form-foot">
        <Button className="btn ghost" onClick={cancelar}>
          <Icon name="chevron-left" /> Cancelar
        </Button>
        <Button className="btn pri" onClick={guardar}>
          <Icon name="upload" /> Subir documento
        </Button>
      </div>
    </AccessibleForm>
  );
};
