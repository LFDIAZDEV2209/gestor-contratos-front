'use client';
import { notify, requestReason } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Field, Surface, TableViewport, DataTable, FormGrid } from '../ui/Workspace';
import { useState } from 'react';
import type { Document } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { fdate, nowStamp, uid } from '../../lib/format';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const TabDocumentos = ({ cid }: { cid: string }) => {
  const [catFilter, setCatFilter] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newDoc, setNewDoc] = useState({ nombre: '', categoria: 'Informes', archivo: '' });

  const docs = Store.byContract('documents', cid) as Document[];
  const db = Store.getDB();
  const cats = db.settings?.catalogs?.categoriasDoc || [
    'Contrato',
    'Estudios previos',
    'Propuesta',
    'Garantías',
    'Actas',
    'Facturas',
    'Informes',
    'Evidencias',
    'Modificaciones',
    'Prórrogas',
    'Suspensiones',
    'Liquidación',
    'Otros'
  ];

  const filtered = docs.filter((d) => !catFilter || d.categoria === catFilter);

  const handleUpload = () => {
    if (!AuthService.guard('crear')) return;
    if (!newDoc.nombre) return notify('Ingrese el nombre del documento');

    const u = AuthService.currentUser();
    const docObj: Document = {
      id: uid('DOC'),
      contractId: cid,
      nombre: newDoc.nombre,
      categoria: newDoc.categoria,
      estado: 'Activo',
      versions: [
        {
          v: 1,
          fecha: fdate(nowStamp()),
          usuario: u.nombre,
          archivo: newDoc.archivo || `${newDoc.nombre}.pdf`,
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
      nuevo: newDoc.nombre
    });
    setShowNewModal(false);
    setNewDoc({ nombre: '', categoria: 'Informes', archivo: '' });
  };

  const handleAnular = async (docId: string, docName: string) => {
    if (!AuthService.guard('anular')) return;
    const mot = await requestReason(`Motivo de anulación para «${docName}»:`);
    if (mot) {
      Store.anular('documents', docId, mot);
    }
  };

  return (
    <div>
      <div className="panel-h mb-3">
        <div>
          <h3>Documentos del expediente</h3>
          <span className="sub">{docs.length} documentos registrados</span>
        </div>
        <div className="row-flex">
          <Button className="btn sm pri" onClick={() => setShowNewModal(true)}>
            <Icon name="upload" /> Cargar documento
          </Button>
        </div>
      </div>

      <div className="filters mb">
        <Field className="f">
          <label>Categoría</label>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="">Todas las categorías</option>
            {cats.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Surface className="panel">
        <TableViewport className="tbl-wrap">
          <DataTable className="tbl">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Nombre del documento</th>
                <th>Versión actual</th>
                <th>Última modificación</th>
                <th>Usuario</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const latest = d.versions?.[d.versions.length - 1];
                return (
                  <tr key={d.id}>
                    <td>
                      <span className="badge b-info">{d.categoria}</span>
                    </td>
                    <td>
                      <b>{d.nombre}</b>
                      {latest?.archivo && (
                        <div className="small muted flex items-center gap-1 mt-1">
                          <Icon name="file-pdf" /> {latest.archivo}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge">v{d.versions?.length || 1}</span>
                    </td>
                    <td>{latest ? fdate(latest.fecha) : '—'}</td>
                    <td>{latest?.usuario || '—'}</td>
                    <td>
                      <Badge text={d.estado} />
                    </td>
                    <td>
                      <div className="acts">
                        <Button
                          className="btn xs ghost"
                          onClick={() => setSelectedDoc(d)}
                          title="Ver historial de versiones"
                        >
                          <Icon name="clock" /> Historial
                        </Button>
                        {d.estado !== 'Anulado' && (
                          <Button
                            className="icon-btn"
                            onClick={() => handleAnular(d.id, d.nombre)}
                            title="Anular documento"
                          >
                            <Icon name="trash" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    No se encontraron documentos en esta categoría.
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </TableViewport>
      </Surface>

      {/* Modal Historial de Versiones */}
      {selectedDoc && (
        <Modal
          title={`Historial de versiones: ${selectedDoc.nombre}`}
          size="lg"
          onClose={() => setSelectedDoc(null)}
          footer={
            <Button className="btn pri" onClick={() => setSelectedDoc(null)}>
              Cerrar
            </Button>
          }
        >
          <div className="readonly-note mb-3">
            <Icon name="lock" /> Las versiones de los documentos son inmutables y nunca se eliminan del repositorio.
          </div>
          <TableViewport className="tbl-wrap">
            <DataTable className="tbl">
              <thead>
                <tr>
                  <th>Versión</th>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Archivo</th>
                  <th>Motivo / Cambios</th>
                </tr>
              </thead>
              <tbody>
                {selectedDoc.versions?.map((v, idx) => (
                  <tr key={idx}>
                    <td>
                      <b>v{v.v}</b>
                    </td>
                    <td>{fdate(v.fecha)}</td>
                    <td>{v.usuario}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Icon name="file-pdf" /> {v.archivo}
                      </div>
                    </td>
                    <td>
                      <div>{v.motivo || 'Actualización de versión'}</div>
                      {v.cambios && <div className="small muted">{v.cambios}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableViewport>
        </Modal>
      )}

      {/* Modal Carga de Documento */}
      {showNewModal && (
        <Modal
          title="Cargar nuevo documento al expediente"
          onClose={() => setShowNewModal(false)}
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button className="btn ghost" onClick={() => setShowNewModal(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleUpload}>
                Guardar Documento
              </Button>
            </div>
          }
        >
          <FormGrid className="form-grid">
            <Field className="f span2">
              <label className="req">Nombre del documento</label>
              <input
                value={newDoc.nombre}
                onChange={(e) => setNewDoc({ ...newDoc, nombre: e.target.value })}
                placeholder="Ej. Acta de entrega fase 1"
              />
            </Field>
            <Field className="f">
              <label>Categoría</label>
              <select
                value={newDoc.categoria}
                onChange={(e) => setNewDoc({ ...newDoc, categoria: e.target.value })}
              >
                {cats.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field className="f span2">
              <label>Archivo adjunto (PDF / Word / Excel)</label>
              <input
                type="text"
                placeholder="Nombre del archivo (ej. Acta_Fase1.pdf)"
                value={newDoc.archivo}
                onChange={(e) => setNewDoc({ ...newDoc, archivo: e.target.value })}
              />
            </Field>
          </FormGrid>
        </Modal>
      )}
    </div>
  );
};
