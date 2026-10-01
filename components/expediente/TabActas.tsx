'use client';
import { Select, Input, Textarea } from '../ui/Controls';
import { notify, requestReason } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, FormGrid, Field, EmptyState } from '../ui/Workspace';
import { useState } from 'react';
import type { Acta } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { CAT } from '../../lib/catalog';
import { fdate, todayIso, uid } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const TabActas = ({ cid }: { cid: string }) => {
  const [showModal, setShowModal] = useState(false);
  const [filterTipo, setFilterTipo] = useState('');
  const [form, setForm] = useState({
    tipo: 'Acta de inicio',
    numero: '',
    fecha: todayIso(),
    descripcion: '',
    firmantes: '',
    estado: 'Firmada',
    archivo: ''
  });

  const c = Store.get('contracts', cid);
  if (!c) return <div className="empty">Contrato no encontrado</div>;

  const actas = (Store.byContract('actas', cid) as Acta[]).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const tipos = Array.from(new Set(actas.map((a) => a.tipo)));

  const filtered = filterTipo ? actas.filter((a) => a.tipo === filterTipo) : actas;

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      { l: 'Número', k: 'numero' },
      { l: 'Tipo', k: 'tipo' },
      { l: 'Fecha', k: 'fecha', r: (r: any) => fdate(r.fecha) },
      { l: 'Descripción', k: 'descripcion' },
      { l: 'Firmantes', k: 'firmantes' },
      { l: 'Estado', k: 'estado' }
    ];
    exportRows('Actas - ' + c.numero, cols, filtered, format);
  };

  const handleCreate = () => {
    if (!AuthService.guard('crear')) return;
    if (!form.numero.trim()) return notify('Ingrese el número del acta');
    if (!form.fecha) return notify('Ingrese la fecha del acta');

    const nuevaActa: Acta = {
      id: uid('AC'),
      contractId: cid,
      tipo: form.tipo,
      numero: form.numero.trim(),
      fecha: form.fecha,
      descripcion: form.descripcion,
      firmantes: form.firmantes,
      estado: form.estado,
      archivo: form.archivo || `${form.numero.replace(/\s+/g, '_')}.pdf`
    };

    Store.insert('actas', nuevaActa);
    Audit.log({
      contractId: cid,
      modulo: 'Actas',
      accion: 'Creación',
      campo: 'Nueva acta ' + nuevaActa.numero,
      nuevo: `${nuevaActa.tipo} - ${nuevaActa.fecha}`
    });

    notify('Acta registrada');
    setShowModal(false);
    setForm({
      tipo: 'Acta de inicio',
      numero: '',
      fecha: todayIso(),
      descripcion: '',
      firmantes: '',
      estado: 'Firmada',
      archivo: ''
    });
  };

  /* Anulación con motivo obligatorio (files/08): pide permiso ANULAR y el motivo queda en auditoría. */
  const handleAnular = async (acta: Acta) => {
    if (!AuthService.guard('anular')) return;
    const mot = await requestReason(`Motivo de anulación del acta ${acta.numero}:`, `Error en la radicación del acta ${acta.numero}`);
    if (!mot) return;

    Store.anular('actas', acta.id, mot);
    notify(`Acta ${acta.numero} anulada`);
  };

  return (
    <Surface className="panel">
      <div className="panel-h" style={{ borderTop: 0 }}>
        <div>
          <h3>Actas</h3>
          <span className="sub">{actas.length} acta(s) registrada(s)</span>
        </div>
        <div className="row-flex">
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
          <Button className="btn sm pri" onClick={() => setShowModal(true)}>
            <Icon name="plus" /> Nueva acta
          </Button>
        </div>
      </div>

      {tipos.length > 0 && (
        <div className="row-flex px-4 py-2" style={{ gap: '6px', borderBottom: '1px solid var(--line)' }}>
          <Button
            className={`btn sm ${filterTipo === '' ? 'pri' : 'ghost'}`}
            onClick={() => setFilterTipo('')}
          >
            Todas ({actas.length})
          </Button>
          {tipos.map((t) => (
            <Button
              key={t}
              className={`btn sm ${filterTipo === t ? 'pri' : 'ghost'}`}
              onClick={() => setFilterTipo(t)}
            >
              {t} ({actas.filter((a) => a.tipo === t).length})
            </Button>
          ))}
        </div>
      )}

      <TableViewport className="tbl-wrap">
        <DataTable className="tbl">
          <thead>
            <tr>
              <th className="nw">Número</th>
              <th>Tipo</th>
              <th className="nw">Fecha</th>
              <th>Descripción</th>
              <th>Firmantes</th>
              <th className="nw">Estado</th>
              <th className="nw">Soporte</th>
              <th className="nw">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const isVoid = a.estado === 'Anulada';
              return (
                <tr key={a.id} className={isVoid ? 'void' : ''}>
                  <td className="nw mono">
                    <b>{a.numero}</b>
                  </td>
                  <td>{a.tipo}</td>
                  <td className="nw">{fdate(a.fecha)}</td>
                  <td className="clip" style={{ maxWidth: '280px' }} title={a.descripcion}>
                    {a.descripcion || '—'}
                  </td>
                  <td className="clip" style={{ maxWidth: '200px' }} title={a.firmantes}>
                    {a.firmantes || '—'}
                  </td>
                  <td className="nw">
                    <Badge
                      text={a.estado}
                      color={
                        a.estado === 'Firmada'
                          ? 'ok'
                          : a.estado === 'En firmas'
                          ? 'warn'
                          : a.estado === 'Anulada'
                          ? 'na'
                          : 'default'
                      }
                    />
                  </td>
                  <td className="nw">
                    {a.archivo ? (
                      <span className="link" title="Ver documento soporte">
                        <Icon name="file-text" /> {a.archivo}
                      </span>
                    ) : (
                      <span className="badge b-crit">Sin soporte</span>
                    )}
                  </td>
                  <td className="nw">
                    {!isVoid && (
                      <Button
                        className="icon-btn"
                        onClick={() => handleAnular(a)}
                        title="Anular acta (conserva el historial)"
                        aria-label={`Anular acta ${a.numero}`}
                        style={{ color: 'var(--crit)' }}
                      >
                        <Icon name="circle-xmark" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="empty">
                  {filterTipo ? 'No hay actas de ese tipo.' : 'El contrato no registra actas.'}
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </TableViewport>

      {actas.length === 0 && (
        <EmptyState
          title="Sin actas registradas"
          description="Registra el acta de inicio y las actas parciales para soportar la ejecución del contrato."
          action={
            <Button className="btn sm pri" onClick={() => setShowModal(true)}>
              <Icon name="plus" /> Registrar primera acta
            </Button>
          }
        />
      )}

      {showModal && (
        <Modal
          title="Nueva acta contractual"
          onClose={() => setShowModal(false)}
          size="lg"
          footer={
            <>
              <Button className="btn" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleCreate}>
                <Icon name="save" /> Registrar acta
              </Button>
            </>
          }
        >
          <FormGrid className="form-grid">
            <Field className="f">
              <label className="req">Tipo de acta</label>
              <Select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              >
                {CAT('tiposActa').map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field className="f">
              <label className="req">Número de acta</label>
              <Input
                value={form.numero}
                placeholder="Ej. ACT-001"
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
              />
            </Field>
            <Field className="f">
              <label className="req">Fecha</label>
              <Input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </Field>
            <Field className="f">
              <label>Estado</label>
              <Select
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
              >
                <option value="Borrador">Borrador</option>
                <option value="En firmas">En firmas</option>
                <option value="Firmada">Firmada</option>
              </Select>
            </Field>
            <Field className="f span2">
              <label>Firmantes</label>
              <Input
                value={form.firmantes}
                placeholder="Nombres y cargos de quienes suscriben el acta"
                onChange={(e) => setForm({ ...form, firmantes: e.target.value })}
              />
            </Field>
            <Field className="f span2">
              <label>Descripción / Objeto del acta</label>
              <Textarea
                rows={3}
                value={form.descripcion}
                placeholder="Detalle o acuerdos registrados en el acta..."
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
            </Field>
            <Field className="f span2">
              <label>Documento soporte (archivo)</label>
              <Input
                value={form.archivo}
                placeholder="Nombre del archivo adjunto (ej. acta_inicio_firmada.pdf)"
                onChange={(e) => setForm({ ...form, archivo: e.target.value })}
              />
            </Field>
          </FormGrid>
        </Modal>
      )}
    </Surface>
  );
};
