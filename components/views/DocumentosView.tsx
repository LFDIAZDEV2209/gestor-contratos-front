'use client';
import { notify, requestReason } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, Field, TableViewport, DataTable, FormGrid } from '../ui/Workspace';
import { useState } from 'react';
import type { Document, DocumentVersion, Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { CAT } from '../../lib/catalog';
import { M, activeContracts, companyName } from '../../lib/metrics';
import { fdate, todayIso, uid, sum } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const DocumentosView = ({
  onSelectContract
}: {
  onSelectContract: (cid: string, tab?: string) => void;
}) => {
  const [q, setQ] = useState('');
  const [filterContract, setFilterContract] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocHistory, setSelectedDocHistory] = useState<Document | null>(null);
  const [newVersionDoc, setNewVersionDoc] = useState<Document | null>(null);

  const [uploadForm, setUploadForm] = useState({
    contractId: '',
    nombre: '',
    categoria: 'Contrato',
    archivo: '',
    motivo: 'Carga inicial',
    obs: ''
  });

  const [versionForm, setVersionForm] = useState({
    archivo: '',
    motivo: '',
    cambios: ''
  });

  const allDocs = (Store.all('documents') as Document[]).slice();
  const allContracts = (Store.all('contracts') as Contract[]).filter((c) => !c.anulado);
  const cs = activeContracts();

  const totalDocs = allDocs.length;
  const totalVersions = sum(allDocs, (d) => d.versions?.length || 1);
  const faltantesCount = cs.filter(
    (c) => M(c).docsFaltantes.length && M(c).estado !== 'Liquidado'
  ).length;
  const anuladosCount = allDocs.filter((d) => d.estado === 'Anulado').length;

  const filtered = allDocs.filter((d) => {
    if (filterContract && d.contractId !== filterContract) return false;
    if (filterCat && d.categoria !== filterCat) return false;
    if (q) {
      const matchName = d.nombre.toLowerCase().includes(q.toLowerCase());
      const matchFile = (d.versions?.[d.versions.length - 1]?.archivo || '')
        .toLowerCase()
        .includes(q.toLowerCase());
      const c = Store.get('contracts', d.contractId);
      const matchContr = c?.numero.toLowerCase().includes(q.toLowerCase()) || false;
      if (!matchName && !matchFile && !matchContr) return false;
    }
    return true;
  });

  const handleUploadNew = () => {
    if (!AuthService.guard('crear')) return;
    if (!uploadForm.contractId) return notify('Seleccione un contrato');
    if (!uploadForm.nombre.trim()) return notify('Ingrese el nombre del documento');

    const u = AuthService.currentUser();
    const docId = uid('DOC');
    const fileName = uploadForm.archivo.trim() || `${uploadForm.nombre.replace(/\s+/g, '_')}.pdf`;

    const initialVersion: DocumentVersion = {
      v: 1,
      fecha: todayIso(),
      usuario: u.nombre,
      archivo: fileName,
      motivo: uploadForm.motivo || 'Carga inicial'
    };

    const newDoc: Document = {
      id: docId,
      contractId: uploadForm.contractId,
      nombre: uploadForm.nombre.trim(),
      categoria: uploadForm.categoria,
      estado: 'Activo',
      obs: uploadForm.obs,
      versions: [initialVersion]
    };

    Store.insert('documents', newDoc);
    Audit.log({
      contractId: uploadForm.contractId,
      modulo: 'Documentos',
      accion: 'Creación',
      campo: 'Documento ' + newDoc.nombre,
      nuevo: `v1 (${initialVersion.archivo})`
    });

    setShowUploadModal(false);
    setUploadForm({
      contractId: '',
      nombre: '',
      categoria: 'Contrato',
      archivo: '',
      motivo: 'Carga inicial',
      obs: ''
    });
  };

  const handleAddVersion = () => {
    if (!newVersionDoc) return;
    if (!AuthService.guard('editar')) return;
    if (!versionForm.archivo.trim()) return notify('Ingrese el nombre del archivo');

    const u = AuthService.currentUser();
    const currentVersions = newVersionDoc.versions || [];
    const nextV = currentVersions.length + 1;

    const newVer: DocumentVersion = {
      v: nextV,
      fecha: todayIso(),
      usuario: u.nombre,
      archivo: versionForm.archivo.trim(),
      motivo: versionForm.motivo || 'Actualización de versión',
      cambios: versionForm.cambios
    };

    const updatedVersions = [...currentVersions, newVer];
    Store.update('documents', newVersionDoc.id, { versions: updatedVersions });

    Audit.log({
      contractId: newVersionDoc.contractId,
      modulo: 'Documentos',
      accion: 'Edición',
      campo: `Documento ${newVersionDoc.nombre}`,
      anterior: `v${currentVersions.length}`,
      nuevo: `v${nextV} (${newVer.archivo})`
    });

    setNewVersionDoc(null);
    setVersionForm({ archivo: '', motivo: '', cambios: '' });
  };

  const handleAnular = async (doc: Document) => {
    if (!AuthService.guard('anular')) return;
    const motivo = await requestReason(`Motivo de anulación del documento «${doc.nombre}»:`);
    if (!motivo) return;

    Store.update('documents', doc.id, { estado: 'Anulado' });
    Audit.log({
      contractId: doc.contractId,
      modulo: 'Documentos',
      accion: 'Anulación',
      campo: 'Estado del documento ' + doc.nombre,
      anterior: doc.estado,
      nuevo: 'Anulado',
      obs: motivo
    });
  };

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      {
        l: 'Contrato',
        k: 'contractId',
        r: (d: any) => {
          const c = Store.get('contracts', d.contractId);
          return c ? c.numero : d.contractId;
        }
      },
      { l: 'Nombre Documento', k: 'nombre' },
      { l: 'Categoría', k: 'categoria' },
      {
        l: 'Archivo Actual',
        k: 'file',
        r: (d: any) => d.versions?.[d.versions.length - 1]?.archivo || '—'
      },
      {
        l: 'Versión',
        k: 'v',
        r: (d: any) => `v${d.versions?.length || 1}`
      },
      {
        l: 'Última Fecha',
        k: 'fecha',
        r: (d: any) => fdate(d.versions?.[d.versions.length - 1]?.fecha)
      },
      { l: 'Estado', k: 'estado' }
    ];
    exportRows('Repositorio Global de Documentos', cols, filtered, format);
  };

  return (
    <div>
      {/* Page Header */}
      <PageHeader className="ph">
        <div>
          <h1>Documentos contractuales</h1>
          <p>Repositorio digital con trazabilidad y versionamiento histórico inmutable</p>
        </div>
        <div className="ph-actions">
          <div className="exp-actions">
            <Button className="btn sm" onClick={() => handleExport('xlsx')} title="Exportar a Excel">
              <Icon name="file-excel" /> Excel
            </Button>
            <Button className="btn sm" onClick={() => handleExport('pdf')} title="Exportar a PDF">
              <Icon name="file-pdf" /> PDF
            </Button>
            <Button className="btn sm" onClick={() => handleExport('csv')} title="Exportar a CSV">
              <Icon name="file-csv" /> CSV
            </Button>
          </div>
          <Button className="btn sm pri" onClick={() => setShowUploadModal(true)}>
            <Icon name="upload" /> Cargar documento
          </Button>
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <div className="kpis mb">
        <Kpi label="Total Documentos" value={totalDocs} />
        <Kpi label="Versiones Totales" value={totalVersions} sub="Nunca se eliminan" color="brand" />
        <Kpi
          label="Contratos con Faltantes"
          value={faltantesCount}
          sub="Requeridos: Contrato, Propuesta, Pólizas, Actas"
          color={faltantesCount > 0 ? 'warn' : 'ok'}
        />
        <Kpi label="Documentos Anulados" value={anuladosCount} color={anuladosCount > 0 ? 'crit' : 'ok'} />
      </div>

      {/* Main Panel */}
      <Surface className="panel">
        {/* Filters */}
        <div className="filters mb" style={{ padding: '12px 16px' }}>
          <div className="gsearch">
            <Icon name="search" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, archivo o contrato..."
            />
          </div>
          <Field className="f">
            <select
              className="inp sm"
              value={filterContract}
              onChange={(e) => setFilterContract(e.target.value)}
            >
              <option value="">— Todos los contratos —</option>
              {allContracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} · {c.contratista}
                </option>
              ))}
            </select>
          </Field>
          <Field className="f">
            <select
              className="inp sm"
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
            >
              <option value="">— Todas las categorías —</option>
              {CAT('categoriasDoc').map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Table */}
        <TableViewport className="tbl-wrap">
          <DataTable className="tbl">
            <thead>
              <tr>
                <th className="nw">Contrato</th>
                <th>Categoría</th>
                <th>Nombre del Documento</th>
                <th>Archivo Actual</th>
                <th className="nw">Versión</th>
                <th className="nw">Fecha</th>
                <th>Usuario</th>
                <th className="nw">Estado</th>
                <th className="nw">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const c = Store.get('contracts', d.contractId);
                const lastVer = d.versions?.[d.versions.length - 1];
                const isVoid = d.estado === 'Anulado';

                return (
                  <tr key={d.id} className={isVoid ? 'void' : ''}>
                    <td className="nw">
                      {c ? (
                        <a
                          className="link font-bold"
                          onClick={() => onSelectContract(c.id, 'documentos')}
                          style={{ cursor: 'pointer' }}
                        >
                          {c.numero}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span className="badge">{d.categoria}</span>
                    </td>
                    <td>
                      <b>{d.nombre}</b>
                      {d.obs && <div className="small muted">{d.obs}</div>}
                    </td>
                    <td className="nw">
                      {lastVer ? (
                        <span className="link" title="Descargar o ver archivo">
                          <Icon name="paperclip" /> {lastVer.archivo}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="nw">
                      <span
                        className="badge brand font-bold"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedDocHistory(d)}
                        title="Ver historial de versiones"
                      >
                        v{d.versions?.length || 1}
                      </span>
                    </td>
                    <td className="nw">{lastVer ? fdate(lastVer.fecha) : '—'}</td>
                    <td>{lastVer?.usuario || '—'}</td>
                    <td className="nw">
                      <Badge
                        text={d.estado}
                        color={d.estado === 'Activo' ? 'ok' : 'crit'}
                      />
                    </td>
                    <td className="nw">
                      <div className="row-flex" style={{ gap: '4px' }}>
                        <Button
                          className="btn sm"
                          onClick={() => setSelectedDocHistory(d)}
                          title="Historial de versiones"
                        >
                          Versiones
                        </Button>
                        {!isVoid && (
                          <>
                            <Button
                              className="btn sm"
                              onClick={() => setNewVersionDoc(d)}
                              title="Subir nueva versión"
                            >
                              <Icon name="upload" />
                            </Button>
                            <Button
                              className="icon-btn"
                              style={{ color: 'var(--crit)' }}
                              onClick={() => handleAnular(d)}
                              title="Anular documento"
                            >
                              <Icon name="ban" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty">
                    No se encontraron documentos con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </TableViewport>
      </Surface>

      {/* Upload New Document Modal */}
      {showUploadModal && (
        <Modal
          title="Cargar nuevo documento"
          onClose={() => setShowUploadModal(false)}
          size="md"
          footer={
            <>
              <Button className="btn" onClick={() => setShowUploadModal(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleUploadNew}>
                <Icon name="upload" /> Subir documento
              </Button>
            </>
          }
        >
          <FormGrid className="grid g-1" style={{ gap: '14px' }}>
            <div>
              <label className="lbl required">Contrato</label>
              <select
                className="inp"
                value={uploadForm.contractId}
                onChange={(e) => setUploadForm({ ...uploadForm, contractId: e.target.value })}
              >
                <option value="">— Seleccione contrato —</option>
                {allContracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero} · {c.contratista}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl required">Nombre del documento</label>
              <input
                className="inp"
                value={uploadForm.nombre}
                placeholder="Ej. Minuta del contrato firmada"
                onChange={(e) => setUploadForm({ ...uploadForm, nombre: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl required">Categoría</label>
              <select
                className="inp"
                value={uploadForm.categoria}
                onChange={(e) => setUploadForm({ ...uploadForm, categoria: e.target.value })}
              >
                {CAT('categoriasDoc').map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl required">Archivo (nombre o ruta simulada)</label>
              <input
                className="inp"
                value={uploadForm.archivo}
                placeholder="Ej. contrato_firmado_final.pdf"
                onChange={(e) => setUploadForm({ ...uploadForm, archivo: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl">Observaciones</label>
              <textarea
                className="inp"
                rows={2}
                value={uploadForm.obs}
                placeholder="Notas adicionales..."
                onChange={(e) => setUploadForm({ ...uploadForm, obs: e.target.value })}
              />
            </div>
          </FormGrid>
        </Modal>
      )}

      {/* Version History Modal */}
      {selectedDocHistory && (
        <Modal
          title={`Historial de versiones: ${selectedDocHistory.nombre}`}
          onClose={() => setSelectedDocHistory(null)}
          size="lg"
          footer={
            <Button className="btn pri" onClick={() => setSelectedDocHistory(null)}>
              Cerrar
            </Button>
          }
        >
          <div>
            <p className="small muted mb-3">
              Categoría: <b>{selectedDocHistory.categoria}</b> · Total versiones:{' '}
              <b>{selectedDocHistory.versions?.length || 1}</b>
            </p>
            <TableViewport className="tbl-wrap">
              <DataTable className="tbl">
                <thead>
                  <tr>
                    <th className="nw">Versión</th>
                    <th className="nw">Fecha</th>
                    <th>Usuario</th>
                    <th>Archivo</th>
                    <th>Motivo / Cambios</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedDocHistory.versions || []).map((ver) => (
                    <tr key={ver.v}>
                      <td className="nw">
                        <span className="badge brand font-bold">v{ver.v}</span>
                      </td>
                      <td className="nw">{fdate(ver.fecha)}</td>
                      <td>{ver.usuario}</td>
                      <td className="nw">
                        <span className="link">
                          <Icon name="paperclip" /> {ver.archivo}
                        </span>
                      </td>
                      <td>
                        {ver.motivo}
                        {ver.cambios && <div className="small muted">Cambios: {ver.cambios}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </TableViewport>
          </div>
        </Modal>
      )}

      {/* Upload New Version Modal */}
      {newVersionDoc && (
        <Modal
          title={`Cargar nueva versión: ${newVersionDoc.nombre}`}
          onClose={() => setNewVersionDoc(null)}
          size="md"
          footer={
            <>
              <Button className="btn" onClick={() => setNewVersionDoc(null)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleAddVersion}>
                <Icon name="upload" /> Guardar versión v{(newVersionDoc.versions?.length || 1) + 1}
              </Button>
            </>
          }
        >
          <FormGrid className="grid g-1" style={{ gap: '14px' }}>
            <div>
              <label className="lbl required">Nuevo archivo</label>
              <input
                className="inp"
                value={versionForm.archivo}
                placeholder="Ej. contrato_firmado_v2.pdf"
                onChange={(e) => setVersionForm({ ...versionForm, archivo: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl required">Motivo de la nueva versión</label>
              <input
                className="inp"
                value={versionForm.motivo}
                placeholder="Ej. Ajuste de cláusula / adición de firmas"
                onChange={(e) => setVersionForm({ ...versionForm, motivo: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl">Descripción de cambios</label>
              <textarea
                className="inp"
                rows={2}
                value={versionForm.cambios}
                placeholder="Detalle de modificaciones en esta versión..."
                onChange={(e) => setVersionForm({ ...versionForm, cambios: e.target.value })}
              />
            </div>
          </FormGrid>
        </Modal>
      )}
    </div>
  );
};
