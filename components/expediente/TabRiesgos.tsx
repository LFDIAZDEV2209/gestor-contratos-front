'use client';
import { useState } from 'react';
import type { Risk } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { CAT } from '../../lib/catalog';
import { riskClass, riskLevel } from '../../lib/metrics';
import { fdate, todayIso, uid } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const TabRiesgos = ({ cid }: { cid: string }) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ p: number; i: number } | null>(null);
  const [form, setForm] = useState({
    categoria: 'Operativo',
    riesgo: '',
    prob: 3,
    impacto: 3,
    responsable: '',
    tratamiento: 'Mitigar',
    mitigacion: '',
    estado: 'Abierto',
    evidencia: ''
  });

  const c = Store.get('contracts', cid);
  if (!c) return <div className="empty">Contrato no encontrado</div>;

  const risks = (Store.byContract('risks', cid) as Risk[]).sort((a, b) => {
    const na = Number(a.prob) * Number(a.impacto);
    const nb = Number(b.prob) * Number(b.impacto);
    return nb - na;
  });

  const activeRisks = risks.filter((r) => r.estado !== 'Cerrado');

  const filteredRisks = selectedCell
    ? risks.filter((r) => Number(r.prob) === selectedCell.p && Number(r.impacto) === selectedCell.i)
    : risks;

  const handleCellClick = (p: number, i: number) => {
    if (selectedCell && selectedCell.p === p && selectedCell.i === i) {
      setSelectedCell(null);
    } else {
      setSelectedCell({ p, i });
    }
  };

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      { l: 'Riesgo', k: 'riesgo' },
      { l: 'Categoría', k: 'categoria' },
      { l: 'Probabilidad', k: 'prob' },
      { l: 'Impacto', k: 'impacto' },
      { l: 'Nivel', k: 'nivel', r: (r: any) => `${r.prob * r.impacto} (${riskLevel(r.prob * r.impacto)})` },
      { l: 'Responsable', k: 'responsable' },
      { l: 'Tratamiento', k: 'tratamiento' },
      { l: 'Estado', k: 'estado' },
      { l: 'Mitigación', k: 'mitigacion' }
    ];
    exportRows('Matriz de Riesgos - ' + c.numero, cols, filteredRisks, format);
  };

  const handleCreate = () => {
    if (!AuthService.guard('crear')) return;
    if (!form.riesgo.trim()) return alert('Ingrese la descripción del riesgo');

    const newRisk: Risk = {
      id: uid('RG'),
      contractId: cid,
      categoria: form.categoria,
      riesgo: form.riesgo.trim(),
      prob: Number(form.prob),
      impacto: Number(form.impacto),
      responsable: form.responsable || c.responsable || 'Supervisor',
      tratamiento: form.tratamiento,
      mitigacion: form.mitigacion,
      fecha: todayIso(),
      estado: form.estado,
      evidencia: form.evidencia
    };

    Store.insert('risks', newRisk);
    Audit.log({
      contractId: cid,
      modulo: 'Riesgos',
      accion: 'Creación',
      campo: 'Nuevo riesgo ' + newRisk.id,
      nuevo: `${newRisk.categoria}: ${newRisk.riesgo.slice(0, 40)} (P${newRisk.prob}xI${newRisk.impacto})`
    });

    setShowModal(false);
    setForm({
      categoria: 'Operativo',
      riesgo: '',
      prob: 3,
      impacto: 3,
      responsable: '',
      tratamiento: 'Mitigar',
      mitigacion: '',
      estado: 'Abierto',
      evidencia: ''
    });
  };

  const handleUpdateStatus = (risk: Risk, newEstado: string) => {
    if (!AuthService.guard('editar')) return;
    Store.update('risks', risk.id, { estado: newEstado });
    Audit.log({
      contractId: cid,
      modulo: 'Riesgos',
      accion: 'Edición',
      campo: 'Estado del riesgo ' + risk.id,
      anterior: risk.estado,
      nuevo: newEstado
    });
  };

  return (
    <div className="panel">
      <div className="panel-h" style={{ borderTop: 0 }}>
        <div>
          <h3>Matriz de riesgos</h3>
          <span className="sub">Probabilidad × impacto</span>
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
          <button className="btn sm pri" onClick={() => setShowModal(true)}>
            <Icon name="plus" /> Nuevo riesgo
          </button>
        </div>
      </div>

      <div className="grid g-12 p-4" style={{ gap: '20px' }}>
        {/* Heatmap Column */}
        <div>
          <h4 style={{ fontSize: '13px', marginBottom: '10px', color: 'var(--text)' }}>
            Mapa de calor (activos: {activeRisks.length})
          </h4>
          <div className="heat">
            {[5, 4, 3, 2, 1].map((p) => (
              <div key={`row-${p}`} style={{ display: 'contents' }}>
                <div className="ax">P{p}</div>
                {[1, 2, 3, 4, 5].map((i) => {
                  const score = p * i;
                  const count = activeRisks.filter(
                    (r) => Number(r.prob) === p && Number(r.impacto) === i
                  ).length;
                  const isSelected = selectedCell?.p === p && selectedCell?.i === i;
                  return (
                    <div
                      key={`c-${p}-${i}`}
                      className={`c ${riskClass(score)} ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleCellClick(p, i)}
                      title={`Probabilidad ${p} × Impacto ${i} = ${score}`}
                      style={{
                        opacity: count ? 1 : 0.35,
                        cursor: 'pointer',
                        outline: isSelected ? '2px solid var(--text)' : 'none',
                        transform: isSelected ? 'scale(1.08)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {count || ''}
                    </div>
                  );
                })}
              </div>
            ))}
            <div></div>
            {[1, 2, 3, 4, 5].map((j) => (
              <div key={`ax-${j}`} className="ax">
                I{j}
              </div>
            ))}
          </div>

          <div className="legend mt-3" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '12px' }}>
            <span>
              <span className="sem" style={{ background: '#7FBF93' }}></span> Bajo (1–4)
            </span>
            <span>
              <span className="sem" style={{ background: '#D9C255' }}></span> Moderado (5–9)
            </span>
            <span>
              <span className="sem" style={{ background: '#E49A52' }}></span> Alto (10–14)
            </span>
            <span>
              <span className="sem" style={{ background: '#D0543F' }}></span> Extremo (15–25)
            </span>
          </div>

          {selectedCell && (
            <div className="mt-3 p-2 small" style={{ background: 'var(--bg-sub)', borderRadius: '4px' }}>
              Filtrando celda: <b>P{selectedCell.p} × I{selectedCell.i}</b> (
              {filteredRisks.length} riesgos)
              <button
                className="btn ghost sm"
                style={{ marginLeft: '8px', padding: '2px 6px' }}
                onClick={() => setSelectedCell(null)}
              >
                Limpiar filtro
              </button>
            </div>
          )}
        </div>

        {/* Risks Table Column */}
        <div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Riesgo</th>
                  <th>Categoría</th>
                  <th className="nw">P</th>
                  <th className="nw">I</th>
                  <th className="nw">Nivel</th>
                  <th>Tratamiento</th>
                  <th className="nw">Estado</th>
                  <th className="nw">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredRisks.map((r) => {
                  const score = Number(r.prob) * Number(r.impacto);
                  const lvl = riskLevel(score);
                  return (
                    <tr key={r.id}>
                      <td className="clip" style={{ maxWidth: '240px' }} title={r.riesgo}>
                        <b>{r.riesgo}</b>
                        {r.mitigacion && (
                          <div className="small muted">Mitigación: {r.mitigacion}</div>
                        )}
                      </td>
                      <td>{r.categoria}</td>
                      <td className="nw">{r.prob}</td>
                      <td className="nw">{r.impacto}</td>
                      <td className="nw">
                        <span
                          className={`badge ${
                            lvl === 'Extremo'
                              ? 'crit'
                              : lvl === 'Alto'
                              ? 'risk'
                              : lvl === 'Moderado'
                              ? 'warn'
                              : 'ok'
                          }`}
                        >
                          {score} · {lvl}
                        </span>
                      </td>
                      <td>{r.tratamiento || '—'}</td>
                      <td className="nw">
                        <Badge
                          text={r.estado}
                          color={
                            r.estado === 'Cerrado'
                              ? 'na'
                              : r.estado === 'Controlado'
                              ? 'ok'
                              : 'risk'
                          }
                        />
                      </td>
                      <td className="nw">
                        {r.estado !== 'Cerrado' ? (
                          <button
                            className="btn ghost sm"
                            onClick={() => handleUpdateStatus(r, 'Cerrado')}
                            title="Cerrar riesgo"
                          >
                            Cerrar
                          </button>
                        ) : (
                          <button
                            className="btn ghost sm"
                            onClick={() => handleUpdateStatus(r, 'Abierto')}
                            title="Reabrir riesgo"
                          >
                            Reabrir
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredRisks.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty">
                      No hay riesgos registrados en esta vista.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <Modal
          title="Nuevo riesgo contractual"
          onClose={() => setShowModal(false)}
          size="lg"
          footer={
            <>
              <button className="btn" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button className="btn pri" onClick={handleCreate}>
                <Icon name="save" /> Registrar riesgo
              </button>
            </>
          }
        >
          <div className="grid g-2" style={{ gap: '14px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl required">Descripción del riesgo</label>
              <textarea
                className="inp"
                rows={2}
                value={form.riesgo}
                placeholder="Descripción del evento de riesgo que podría impactar el contrato..."
                onChange={(e) => setForm({ ...form, riesgo: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl required">Categoría</label>
              <select
                className="inp"
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              >
                {CAT('categoriasRiesgo').map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl">Responsable</label>
              <input
                className="inp"
                value={form.responsable}
                placeholder={c.responsable || 'Supervisor asignado'}
                onChange={(e) => setForm({ ...form, responsable: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl required">Probabilidad (1 a 5)</label>
              <select
                className="inp"
                value={form.prob}
                onChange={(e) => setForm({ ...form, prob: Number(e.target.value) })}
              >
                <option value={1}>1 - Muy baja</option>
                <option value={2}>2 - Baja</option>
                <option value={3}>3 - Media</option>
                <option value={4}>4 - Alta</option>
                <option value={5}>5 - Muy alta</option>
              </select>
            </div>
            <div>
              <label className="lbl required">Impacto (1 a 5)</label>
              <select
                className="inp"
                value={form.impacto}
                onChange={(e) => setForm({ ...form, impacto: Number(e.target.value) })}
              >
                <option value={1}>1 - Leve</option>
                <option value={2}>2 - Menor</option>
                <option value={3}>3 - Moderado</option>
                <option value={4}>4 - Mayor</option>
                <option value={5}>5 - Catastrófico</option>
              </select>
            </div>
            <div>
              <label className="lbl">Tratamiento sugerido</label>
              <select
                className="inp"
                value={form.tratamiento}
                onChange={(e) => setForm({ ...form, tratamiento: e.target.value })}
              >
                <option value="Mitigar">Mitigar</option>
                <option value="Transferir">Transferir</option>
                <option value="Aceptar">Aceptar</option>
                <option value="Evitar">Evitar</option>
              </select>
            </div>
            <div>
              <label className="lbl">Estado</label>
              <select
                className="inp"
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
              >
                <option value="Abierto">Abierto</option>
                <option value="Controlado">Controlado</option>
                <option value="Cerrado">Cerrado</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl">Plan de mitigación / controles</label>
              <textarea
                className="inp"
                rows={3}
                value={form.mitigacion}
                placeholder="Acciones preventivas y correctivas para gestionar este riesgo..."
                onChange={(e) => setForm({ ...form, mitigacion: e.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
