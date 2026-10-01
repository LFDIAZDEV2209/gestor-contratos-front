'use client';
import { useState } from 'react';
import type { Modification, Acta, Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { fdate, todayIso, uid, addDays, diffDays } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const TabSuspensiones = ({ cid }: { cid: string }) => {
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState<'Suspensión' | 'Reinicio'>('Suspensión');
  const [fecha, setFecha] = useState(todayIso());
  const [diasProrroga, setDiasProrroga] = useState(0);
  const [nuevaFechaFin, setNuevaFechaFin] = useState('');
  const [justificacion, setJustificacion] = useState('');
  const [soporte, setSoporte] = useState('');

  const c = Store.get('contracts', cid) as Contract | undefined;
  if (!c) return <div className="empty">Contrato no encontrado</div>;

  const isSuspended = c.estado === 'Suspendido';

  const modSusp = (Store.byContract('modifications', cid) as Modification[])
    .filter((x) => x.tipo === 'Suspensión' || x.tipo === 'Reinicio')
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  const actasSusp = (Store.byContract('actas', cid) as Acta[])
    .filter((a) => /suspensión|reinicio/i.test(a.tipo))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  const handleOpenAction = (tipo: 'Suspensión' | 'Reinicio') => {
    setActionType(tipo);
    setFecha(todayIso());
    setJustificacion('');
    setSoporte('');
    if (tipo === 'Reinicio') {
      // Find the latest suspension to calculate suspended days
      const lastSusp = modSusp.find((m) => m.tipo === 'Suspensión');
      if (lastSusp && lastSusp.fecha) {
        const dias = Math.max(0, diffDays(lastSusp.fecha, todayIso()));
        setDiasProrroga(dias);
        setNuevaFechaFin(addDays(c.fechaFin || todayIso(), dias));
      } else {
        setDiasProrroga(0);
        setNuevaFechaFin(c.fechaFin || todayIso());
      }
    }
    setShowModal(true);
  };

  const handleExecute = () => {
    if (!AuthService.guard('editar')) return;
    if (!justificacion.trim()) return alert('Ingrese la justificación');

    const before = JSON.parse(JSON.stringify(c));
    const modId = uid('MD');
    const actaId = uid('AC');
    const modNum = `MOD-${actionType.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const actaNum = `ACT-${actionType.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    if (actionType === 'Suspensión') {
      const newMod: Modification = {
        id: modId,
        contractId: cid,
        numero: modNum,
        tipo: 'Suspensión',
        fecha,
        justificacion,
        soporte: soporte || `${modNum}.pdf`,
        fechaAnterior: c.fechaFin
      };
      Store.insert('modifications', newMod);

      const newActa: Acta = {
        id: actaId,
        contractId: cid,
        tipo: 'Acta de suspensión',
        numero: actaNum,
        fecha,
        descripcion: justificacion,
        firmantes: `${c.contratista} / ${c.supervisor || 'Supervisor'}`,
        estado: 'Firmada',
        archivo: soporte || `${actaNum}.pdf`
      };
      Store.insert('actas', newActa);

      Store.update('contracts', cid, { estado: 'Suspendido' });
      Audit.diff('Contratos', cid, before, { ...c, estado: 'Suspendido' }, {
        estado: 'Estado contractual'
      });
    } else {
      // Reinicio
      const newMod: Modification = {
        id: modId,
        contractId: cid,
        numero: modNum,
        tipo: 'Reinicio',
        fecha,
        justificacion: `${justificacion} (Ampliación por suspensión: ${diasProrroga} días)`,
        soporte: soporte || `${modNum}.pdf`,
        fechaAnterior: c.fechaFin,
        fechaNueva: nuevaFechaFin
      };
      Store.insert('modifications', newMod);

      const newActa: Acta = {
        id: actaId,
        contractId: cid,
        tipo: 'Acta de reinicio',
        numero: actaNum,
        fecha,
        descripcion: justificacion,
        firmantes: `${c.contratista} / ${c.supervisor || 'Supervisor'}`,
        estado: 'Firmada',
        archivo: soporte || `${actaNum}.pdf`
      };
      Store.insert('actas', newActa);

      const patch: Partial<Contract> = { estado: 'Activo' };
      if (nuevaFechaFin) patch.fechaFin = nuevaFechaFin;

      Store.update('contracts', cid, patch);
      Audit.diff('Contratos', cid, before, { ...c, ...patch }, {
        estado: 'Estado contractual',
        fechaFin: 'Fecha de terminación'
      });
    }

    setShowModal(false);
  };

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      { l: 'Número', k: 'numero' },
      { l: 'Tipo', k: 'tipo' },
      { l: 'Fecha', k: 'fecha', r: (r: any) => fdate(r.fecha) },
      { l: 'Justificación', k: 'justificacion' },
      { l: 'Fecha nueva fin', k: 'fechaNueva', r: (r: any) => (r.fechaNueva ? fdate(r.fechaNueva) : '—') }
    ];
    exportRows('Suspensiones - ' + c.numero, cols, modSusp, format);
  };

  return (
    <div className="panel">
      <div className="panel-h" style={{ borderTop: 0 }}>
        <div>
          <h3>Suspensiones y reinicios</h3>
          <span className="sub">
            {isSuspended ? (
              <span style={{ color: 'var(--warn)', fontWeight: 600 }}>
                <Icon name="pause" /> Contrato actualmente suspendido
              </span>
            ) : (
              'Ejecución activa normal'
            )}
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
          <button
            className={`btn sm pri`}
            style={isSuspended ? { background: '#2E7D32' } : { background: '#D97706' }}
            onClick={() => handleOpenAction(isSuspended ? 'Reinicio' : 'Suspensión')}
          >
            <Icon name={isSuspended ? 'play' : 'pause'} />
            {isSuspended ? 'Registrar reinicio' : 'Registrar suspensión'}
          </button>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th className="nw">Número</th>
              <th>Tipo</th>
              <th className="nw">Fecha</th>
              <th>Justificación</th>
              <th className="nw">Fecha fin resultante</th>
              <th className="nw">Soporte</th>
            </tr>
          </thead>
          <tbody>
            {modSusp.map((item) => (
              <tr key={item.id}>
                <td className="nw">
                  <b>{item.numero}</b>
                </td>
                <td>
                  <Badge
                    text={item.tipo}
                    color={item.tipo === 'Suspensión' ? 'warn' : 'ok'}
                  />
                </td>
                <td className="nw">{fdate(item.fecha)}</td>
                <td className="clip" style={{ maxWidth: '380px' }} title={item.justificacion}>
                  {item.justificacion}
                </td>
                <td className="nw">{item.fechaNueva ? fdate(item.fechaNueva) : '—'}</td>
                <td className="nw">
                  {item.soporte ? (
                    <span className="link">
                      <Icon name="paperclip" /> {item.soporte}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            {modSusp.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  El contrato no registra suspensiones ni reinicios.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="panel-h" style={{ borderTop: '1px solid var(--line)', marginTop: '16px' }}>
        <h3>Actas de suspensión / reinicio</h3>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th className="nw">Número acta</th>
              <th>Tipo</th>
              <th className="nw">Fecha</th>
              <th>Descripción</th>
              <th>Firmantes</th>
              <th className="nw">Estado</th>
              <th className="nw">Soporte</th>
            </tr>
          </thead>
          <tbody>
            {actasSusp.map((a) => (
              <tr key={a.id}>
                <td className="nw">
                  <b>{a.numero}</b>
                </td>
                <td>{a.tipo}</td>
                <td className="nw">{fdate(a.fecha)}</td>
                <td className="clip" style={{ maxWidth: '300px' }} title={a.descripcion}>
                  {a.descripcion}
                </td>
                <td>{a.firmantes || '—'}</td>
                <td className="nw">
                  <Badge text={a.estado} color={a.estado === 'Firmada' ? 'ok' : 'default'} />
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
              </tr>
            ))}
            {actasSusp.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  No se registran actas asociadas a suspensiones o reinicios.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal
          title={
            actionType === 'Suspensión'
              ? 'Registrar suspensión del contrato'
              : 'Registrar reinicio del contrato'
          }
          onClose={() => setShowModal(false)}
          size="md"
          footer={
            <>
              <button className="btn" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button
                className="btn pri"
                style={actionType === 'Reinicio' ? { background: '#2E7D32' } : { background: '#D97706' }}
                onClick={handleExecute}
              >
                <Icon name={actionType === 'Reinicio' ? 'play' : 'pause'} />
                Confirmar {actionType.toLowerCase()}
              </button>
            </>
          }
        >
          <div className="grid g-1" style={{ gap: '14px' }}>
            <div>
              <label className="lbl required">Fecha de {actionType.toLowerCase()}</label>
              <input
                type="date"
                className="inp"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>

            {actionType === 'Reinicio' && (
              <>
                <div>
                  <label className="lbl">Días de suspensión a reponer en plazo</label>
                  <input
                    type="number"
                    className="inp"
                    value={diasProrroga}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setDiasProrroga(val);
                      setNuevaFechaFin(addDays(c.fechaFin || todayIso(), val));
                    }}
                  />
                </div>
                <div>
                  <label className="lbl required">Nueva fecha de terminación</label>
                  <input
                    type="date"
                    className="inp"
                    value={nuevaFechaFin}
                    onChange={(e) => setNuevaFechaFin(e.target.value)}
                  />
                  <div className="small muted mt-1">
                    Fecha original: {fdate(c.fechaFin)} (+{diasProrroga} días)
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="lbl required">Justificación</label>
              <textarea
                className="inp"
                rows={3}
                value={justificacion}
                placeholder={`Motivo detallado para la ${actionType.toLowerCase()} del contrato...`}
                onChange={(e) => setJustificacion(e.target.value)}
              />
            </div>

            <div>
              <label className="lbl">Documento soporte (archivo)</label>
              <input
                className="inp"
                value={soporte}
                placeholder="Nombre del archivo adjunto (ej. acta_suspension.pdf)"
                onChange={(e) => setSoporte(e.target.value)}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
