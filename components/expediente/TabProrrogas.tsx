'use client';
import { useState } from 'react';
import type { Modification, Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { fdate, todayIso, uid, diffDays, addDays } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const TabProrrogas = ({ cid }: { cid: string }) => {
  const [showModal, setShowModal] = useState(false);
  const [diasAdd, setDiasAdd] = useState(30);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [numero, setNumero] = useState('');
  const [justificacion, setJustificacion] = useState('');
  const [soporte, setSoporte] = useState('');

  const c = Store.get('contracts', cid) as Contract | undefined;
  if (!c) return <div className="empty">Contrato no encontrado</div>;

  const prorrogas = (Store.byContract('modifications', cid) as Modification[])
    .filter((x) => x.tipo === 'Prórroga')
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));

  const first = prorrogas[0];
  const originalEnd = first?.fechaAnterior || c.fechaFin;
  const totalDays = originalEnd && c.fechaFin ? diffDays(originalEnd, c.fechaFin) : 0;

  const handleOpen = () => {
    const base = c.fechaFin || todayIso();
    setDiasAdd(30);
    setNuevaFecha(addDays(base, 30));
    setNumero(`MOD-PRO-${Date.now().toString().slice(-4)}`);
    setJustificacion('');
    setSoporte('');
    setShowModal(true);
  };

  const handleCreate = () => {
    if (!AuthService.guard('editar')) return;
    if (!nuevaFecha) return alert('Seleccione la nueva fecha de terminación');
    if (!justificacion.trim()) return alert('Ingrese la justificación');

    const before = JSON.parse(JSON.stringify(c));
    const newMod: Modification = {
      id: uid('MD'),
      contractId: cid,
      numero: numero || `PRO-${Date.now().toString().slice(-4)}`,
      tipo: 'Prórroga',
      fecha: todayIso(),
      justificacion,
      soporte: soporte || `${numero}.pdf`,
      fechaAnterior: c.fechaFin,
      fechaNueva: nuevaFecha
    };

    Store.insert('modifications', newMod);

    const patch: Partial<Contract> = { fechaFin: nuevaFecha };
    if (c.estado === 'Terminado') patch.estado = 'Activo';

    Store.update('contracts', cid, patch);
    Audit.diff('Contratos', cid, before, { ...c, ...patch }, {
      fechaFin: 'Fecha de terminación (Prórroga)'
    });

    const hasGuarantees = Store.byContract('guarantees', cid).length > 0;
    if (hasGuarantees) {
      alert('Atención: La prórroga puede exigir ampliar la vigencia de las pólizas de garantía.');
    }

    setShowModal(false);
  };

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      { l: 'Número', k: 'numero' },
      { l: 'Fecha trámite', k: 'fecha', r: (r: any) => fdate(r.fecha) },
      { l: 'Término anterior', k: 'fechaAnterior', r: (r: any) => fdate(r.fechaAnterior) },
      { l: 'Nuevo término', k: 'fechaNueva', r: (r: any) => fdate(r.fechaNueva) },
      { l: 'Días prorrogados', k: 'dias', r: (r: any) => diffDays(r.fechaAnterior, r.fechaNueva) },
      { l: 'Justificación', k: 'justificacion' }
    ];
    exportRows('Prorrogas - ' + c.numero, cols, prorrogas, format);
  };

  return (
    <div className="panel">
      <div className="panel-h" style={{ borderTop: 0 }}>
        <div>
          <h3>Prórrogas</h3>
          <span className="sub">
            {prorrogas.length > 0
              ? `Plazo original hasta ${fdate(originalEnd)} · actual hasta ${fdate(c.fechaFin)} (+${totalDays} días)`
              : 'Sin prórrogas registradas'}
          </span>
        </div>
        <div className="row-flex">
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
          <button className="btn sm pri" onClick={handleOpen}>
            <Icon name="calendar-plus" /> Crear prórroga
          </button>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th className="nw">Número</th>
              <th className="nw">Fecha trámite</th>
              <th className="nw">Vencimiento anterior</th>
              <th className="nw">Nuevo vencimiento</th>
              <th className="nw">Días adicionales</th>
              <th>Justificación</th>
              <th className="nw">Soporte</th>
            </tr>
          </thead>
          <tbody>
            {prorrogas.map((p) => {
              const days = diffDays(p.fechaAnterior, p.fechaNueva);
              return (
                <tr key={p.id}>
                  <td className="nw">
                    <b>{p.numero}</b>
                  </td>
                  <td className="nw">{fdate(p.fecha)}</td>
                  <td className="nw">{fdate(p.fechaAnterior)}</td>
                  <td className="nw">
                    <b>{fdate(p.fechaNueva)}</b>
                  </td>
                  <td className="nw">
                    <Badge text={`+${days} días`} color="brand" />
                  </td>
                  <td className="clip" style={{ maxWidth: '350px' }} title={p.justificacion}>
                    {p.justificacion}
                  </td>
                  <td className="nw">
                    {p.soporte ? (
                      <span className="link">
                        <Icon name="paperclip" /> {p.soporte}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
            {prorrogas.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  El contrato no registra prórrogas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal
          title="Crear prórroga contractual"
          onClose={() => setShowModal(false)}
          size="md"
          footer={
            <>
              <button className="btn" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button className="btn pri" onClick={handleCreate}>
                <Icon name="calendar-plus" /> Registrar prórroga
              </button>
            </>
          }
        >
          <div className="grid g-1" style={{ gap: '14px' }}>
            <div>
              <label className="lbl">Fecha de terminación actual</label>
              <input className="inp" value={fdate(c.fechaFin)} disabled readOnly />
            </div>

            <div>
              <label className="lbl required">Días de ampliación</label>
              <input
                type="number"
                className="inp"
                value={diasAdd}
                onChange={(e) => {
                  const d = Number(e.target.value);
                  setDiasAdd(d);
                  setNuevaFecha(addDays(c.fechaFin || todayIso(), d));
                }}
              />
            </div>

            <div>
              <label className="lbl required">Nueva fecha de terminación</label>
              <input
                type="date"
                className="inp"
                value={nuevaFecha}
                onChange={(e) => {
                  setNuevaFecha(e.target.value);
                  if (c.fechaFin) {
                    setDiasAdd(Math.max(0, diffDays(c.fechaFin, e.target.value)));
                  }
                }}
              />
            </div>

            <div>
              <label className="lbl required">Número / Referencia de modificación</label>
              <input
                className="inp"
                value={numero}
                placeholder="Ej. OTROSI-02"
                onChange={(e) => setNumero(e.target.value)}
              />
            </div>

            <div>
              <label className="lbl required">Justificación</label>
              <textarea
                className="inp"
                rows={3}
                value={justificacion}
                placeholder="Motivo y justificación de la prórroga de plazo..."
                onChange={(e) => setJustificacion(e.target.value)}
              />
            </div>

            <div>
              <label className="lbl">Documento soporte (archivo)</label>
              <input
                className="inp"
                value={soporte}
                placeholder="Nombre del archivo adjunto (ej. otrosi_prorroga.pdf)"
                onChange={(e) => setSoporte(e.target.value)}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
