'use client';
import { fieldIcon } from '../forms/fieldIcon';
import Link from 'next/link';
import { Select } from '../ui/Controls';
import { notify, requestReason } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Field, Surface, TableViewport, DataTable, EmptyState } from '../ui/Workspace';
import { useState } from 'react';
import type { Document } from '../../lib/types';
import { Store, AuthService } from '../../lib/store';
import { M } from '../../lib/metrics';
import { fdate } from '../../lib/format';
import { CAT } from '../../lib/catalog';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';
import { expHref } from './routes';

import { SectionHeader } from '../ui/SectionHeader';
import { Kpi } from '../ui/Kpi';

export const TabDocumentos = ({ cid }: { cid: string }) => {
  const [catFilter, setCatFilter] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  const docs = Store.byContract('documents', cid) as Document[];
  const cats = CAT('categoriasDoc');
  const c = Store.get('contracts', cid);
  const m = M(c);

  const filtered = docs.filter((d) => !catFilter || d.categoria === catFilter);
  const totalVersiones = docs.reduce((acc, d) => acc + (d.versions?.length || 1), 0);
  const activos = docs.filter((d) => d.estado !== 'Anulado').length;
  const faltantesCount = m.docsFaltantes?.length || 0;

  const handleAnular = async (docId: string, docName: string) => {
    if (!AuthService.guard('anular')) return;
    const mot = await requestReason(`Motivo de anulación para «${docName}»:`, 'Documento duplicado en el expediente');
    if (mot) {
      Store.anular('documents', docId, mot);
      notify(`Documento «${docName}» anulado (versiones conservadas)`);
    }
  };

  return (
    <div className="ws-tab-pane">
      <SectionHeader as="h3"
        icon="folder"
        title="Documentos del expediente"
        description={`${filtered.length} de ${docs.length} documento(s) mostrados.`}
        action={
          <Link className="btn sm pri" href={expHref(cid, 'documentos/nueva')}>
            <Icon name="upload" /> Cargar documento
          </Link>
        }
      />

      <div className="kpis">
        <Kpi label="Total documentos" value={docs.length} color="brand" icon="folder" />
        <Kpi label="Documentos vigentes" value={activos} color="ok" icon="check-circle" />
        <Kpi label="Historial de versiones" value={totalVersiones} color="info" icon="clock" />
        <Kpi
          label="Requeridos pendientes"
          value={faltantesCount}
          color={faltantesCount > 0 ? 'warn' : 'ok'}
          sem={faltantesCount > 0 ? 'warn' : 'ok'}
          icon="alert-circle"
        />
      </div>

      <div className="ws-t-filters">
        <Field className="f" style={{ minWidth: 240 }}>
          <label>Filtrar por categoría</label>
          <Select icon={fieldIcon("catFilter", "Filtrar por categoría", "")} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="">Todas las categorías ({docs.length})</option>
            {cats.map((c) => {
              const count = docs.filter((d) => d.categoria === c).length;
              return (
                <option key={c} value={c}>
                  {c} ({count})
                </option>
              );
            })}
          </Select>
        </Field>
      </div>

      {/* Documentos requeridos pendientes: atajo para completar el expediente */}
      {m.docsFaltantes.length > 0 && (
        <div className="alert-box warn mb">
          <Icon name="triangle-exclamation" />
          <div>
            Faltan documentos requeridos del expediente:{' '}
            {m.docsFaltantes.map((doc: string, i: number) => (
              <Link
                key={i}
                className="btn xs ghost"
                href={`${expHref(cid, 'documentos/nueva')}?categoria=${encodeURIComponent(doc)}`}
                style={{ margin: '2px 2px 0', color: 'var(--warn-text)' }}
                title={`Cargar documento de ${doc}`}
              >
                <Icon name="upload" /> {doc}
              </Link>
            ))}
          </div>
        </div>
      )}

      <Surface className="panel">
        {docs.length === 0 && (
          <EmptyState
            title="Sin documentos en el expediente"
            description="Carga el contrato suscrito, los estudios previos y los soportes exigidos por la cláusula de administración."
            action={
              <Link className="btn sm pri" href={expHref(cid, 'documentos/nueva')}>
                <Icon name="upload" /> Cargar primer documento
              </Link>
            }
          />
        )}
        {docs.length > 0 && (
          <TableViewport className="tbl-wrap">
          <DataTable className="tbl" aria-label="Documentos del contrato">
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
                            title="Anular documento (conserva todas las versiones)"
                            aria-label={`Anular documento ${d.nombre}`}
                          >
                            <Icon name="circle-xmark" />
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
        )}
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
            <DataTable className="tbl" aria-label="Historial de versiones del documento">
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
    </div>
  );
};
