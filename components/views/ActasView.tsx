'use client';
import { useState } from 'react';
import type { Acta, Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { CAT } from '../../lib/catalog';
import { fdate, todayIso, uid } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const ActasView = ({
  onSelectContract
}: {
  onSelectContract: (cid: string, tab?: string) => void;
}) => {
  const [filterTipo, setFilterTipo] = useState('');
  const [filterContract, setFilterContract] = useState('');
  const [q, setQ] = useState('');
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    contractId: '',
    tipo: 'Acta de inicio',
    numero: '',
    fecha: todayIso(),
    descripcion: '',
    firmantes: '',
    estado: 'Firmada',
    archivo: ''
  });

  const allActas = (Store.all('actas') as Acta[]).slice().sort((a, b) =>
    (a.fecha || '') < (b.fecha || '') ? 1 : -1
  );
  const allContracts = (Store.all('contracts') as Contract[]).filter((c) => !c.anulado);

  const tiposCatalogo = CAT('tiposActa');

  const filtered = allActas.filter((a) => {
    if (filterTipo && a.tipo !== filterTipo) return false;
    if (filterContract && a.contractId !== filterContract) return false;
    if (q) {
      const matchNum = a.numero.toLowerCase().includes(q.toLowerCase());
      const matchDesc = a.descripcion.toLowerCase().includes(q.toLowerCase());
      const matchFirm = (a.firmantes || '').toLowerCase().includes(q.toLowerCase());
      const c = Store.get('contracts', a.contractId);
      const matchContr = c?.numero.toLowerCase().includes(q.toLowerCase()) || false;
      if (!matchNum && !matchDesc && !matchFirm && !matchContr) return false;
    }
    return true;
  });

  const handleCreate = () => {
    if (!AuthService.guard('crear')) return;
    if (!form.contractId) return alert('Seleccione un contrato');
    if (!form.numero.trim()) return alert('Ingrese el número del acta');
    if (!form.fecha) return alert('Ingrese la fecha');

    const newActa: Acta = {
      id: uid('AC'),
      contractId: form.contractId,
      tipo: form.tipo,
      numero: form.numero.trim(),
      fecha: form.fecha,
      descripcion: form.descripcion,
      firmantes: form.firmantes,
      estado: form.estado,
      archivo: form.archivo || `${form.numero.replace(/\s+/g, '_')}.pdf`
    };

    Store.insert('actas', newActa);
    Audit.log({
      contractId: form.contractId,
      modulo: 'Actas',
      accion: 'Creación',
      campo: 'Acta ' + newActa.numero,
      nuevo: `${newActa.tipo} - ${newActa.fecha}`
    });

    setShowModal(false);
    setForm({
      contractId: '',
      tipo: 'Acta de inicio',
      numero: '',
      fecha: todayIso(),
      descripcion: '',
      firmantes: '',
      estado: 'Firmada',
      archivo: ''
    });
  };

  const handleAnular = (acta: Acta) => {
    if (!AuthService.guard('editar')) return;
    if (!confirm(`¿Está seguro de anular el acta ${acta.numero}?`)) return;

    Store.update('actas', acta.id, { estado: 'Anulada' });
    Audit.log({
      contractId: acta.contractId,
      modulo: 'Actas',
      accion: 'Edición',
      campo: 'Estado de acta ' + acta.numero,
      anterior: acta.estado,
      nuevo: 'Anulada'
    });
  };

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      {
        l: 'Contrato',
        k: 'contractId',
        r: (a: any) => {
          const c = Store.get('contracts', a.contractId);
          return c ? c.numero : a.contractId;
        }
      },
      { l: 'Número', k: 'numero' },
      { l: 'Tipo', k: 'tipo' },
      { l: 'Fecha', k: 'fecha', r: (a: any) => fdate(a.fecha) },
      { l: 'Descripción', k: 'descripcion' },
      { l: 'Firmantes', k: 'firmantes' },
      { l: 'Estado', k: 'estado' }
    ];
    exportRows('Relación Global de Actas Contractuales', cols, filtered, format);
  };

  return (
    <div>
      {/* Page Header */}
      <div className="ph">
        <div>
          <h1>Actas contractuales</h1>
          <p>Registro formal de hitos, acuerdos, suspensiones, recibos y liquidaciones</p>
        </div>
        <div className="ph-actions">
          <div className="exp-actions">
            <button className="btn sm" onClick={() => handleExport('xlsx')} title="Exportar a Excel">
              <Icon name="file-excel" /> Excel
            </button>
            <button className="btn sm" onClick={() => handleExport('pdf')} title="Exportar a PDF">
              <Icon name="file-pdf" /> PDF
            </button>
            <button className="btn sm" onClick={() => handleExport('csv')} title="Exportar a CSV">
              <Icon name="file-csv" /> CSV
            </button>
          </div>
          <button className="btn sm pri" onClick={() => setShowModal(true)}>
            <Icon name="plus" /> Nueva acta
          </button>
        </div>
      </div>

      {/* Actas Type Count Chips */}
      <div
        className="panel mb p-3"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
          background: 'var(--bg-sub)'
        }}
      >
        <button
          className={`btn sm ${filterTipo === '' ? 'pri' : 'ghost'}`}
          onClick={() => setFilterTipo('')}
        >
          Todas ({allActas.length})
        </button>
        {tiposCatalogo.map((t) => {
          const count = allActas.filter((a) => a.tipo === t).length;
          return (
            <button
              key={t}
              className={`btn sm ${filterTipo === t ? 'pri' : 'ghost'}`}
              onClick={() => setFilterTipo(t)}
            >
              {t} ({count})
            </button>
          );
        })}
      </div>

      {/* Main Table Panel */}
      <div className="panel">
        <div className="filters mb" style={{ padding: '12px 16px' }}>
          <div className="gsearch">
            <Icon name="search" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por número, descripción o contrato..."
            />
          </div>
          <div className="f">
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
          </div>
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th className="nw">Contrato</th>
                <th className="nw">Número</th>
                <th>Tipo de Acta</th>
                <th className="nw">Fecha</th>
                <th>Descripción / Objeto</th>
                <th>Firmantes</th>
                <th className="nw">Estado</th>
                <th className="nw">Soporte</th>
                <th className="nw">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const c = Store.get('contracts', a.contractId);
                const isVoid = a.estado === 'Anulada';
                return (
                  <tr key={a.id} className={isVoid ? 'void' : ''}>
                    <td className="nw">
                      {c ? (
                        <a
                          className="link font-bold"
                          onClick={() => onSelectContract(c.id, 'actas')}
                          style={{ cursor: 'pointer' }}
                        >
                          {c.numero}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="nw">
                      <b>{a.numero}</b>
                    </td>
                    <td>{a.tipo}</td>
                    <td className="nw">{fdate(a.fecha)}</td>
                    <td className="clip" style={{ maxWidth: '280px' }} title={a.descripcion}>
                      {a.descripcion || '—'}
                    </td>
                    <td className="clip" style={{ maxWidth: '180px' }} title={a.firmantes}>
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
                        <span className="link">
                          <Icon name="paperclip" /> {a.archivo}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="nw">
                      <div className="row-flex" style={{ gap: '4px' }}>
                        {c && (
                          <button
                            className="btn sm"
                            onClick={() => onSelectContract(c.id, 'actas')}
                          >
                            Expediente
                          </button>
                        )}
                        {!isVoid && (
                          <button
                            className="icon-btn"
                            style={{ color: 'var(--crit)' }}
                            onClick={() => handleAnular(a)}
                            title="Anular acta"
                          >
                            <Icon name="ban" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty">
                    No se encontraron actas con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for New Acta */}
      {showModal && (
        <Modal
          title="Nueva acta contractual"
          onClose={() => setShowModal(false)}
          size="lg"
          footer={
            <>
              <button className="btn" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button className="btn pri" onClick={handleCreate}>
                <Icon name="save" /> Registrar acta
              </button>
            </>
          }
        >
          <div className="grid g-2" style={{ gap: '14px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl required">Contrato</label>
              <select
                className="inp"
                value={form.contractId}
                onChange={(e) => setForm({ ...form, contractId: e.target.value })}
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
              <label className="lbl required">Tipo de acta</label>
              <select
                className="inp"
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              >
                {tiposCatalogo.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl required">Número de acta</label>
              <input
                className="inp"
                value={form.numero}
                placeholder="Ej. ACT-001"
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl required">Fecha</label>
              <input
                type="date"
                className="inp"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl">Estado</label>
              <select
                className="inp"
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
              >
                <option value="Borrador">Borrador</option>
                <option value="En firmas">En firmas</option>
                <option value="Firmada">Firmada</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl">Firmantes</label>
              <input
                className="inp"
                value={form.firmantes}
                placeholder="Nombres y cargos de quienes suscriben el acta"
                onChange={(e) => setForm({ ...form, firmantes: e.target.value })}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl">Descripción / Objeto del acta</label>
              <textarea
                className="inp"
                rows={3}
                value={form.descripcion}
                placeholder="Detalle o acuerdos formalizados en el acta..."
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl">Documento soporte (archivo)</label>
              <input
                className="inp"
                value={form.archivo}
                placeholder="Nombre del archivo adjunto (ej. acta_inicio_firmada.pdf)"
                onChange={(e) => setForm({ ...form, archivo: e.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
