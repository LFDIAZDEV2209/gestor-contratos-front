'use client';
import { useState } from 'react';
import type { Breach, Plan, Obligation } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { fdate, todayIso, uid, pct } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const TabIncumplimientos = ({ cid }: { cid: string }) => {
  const [showBreachModal, setShowBreachModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);

  const [breachForm, setBreachForm] = useState({
    fecha: todayIso(),
    obligationId: '',
    tipo: 'Retraso en cronograma',
    descripcion: '',
    responsable: '',
    impacto: 'Medio',
    estado: 'Abierto',
    medida: '',
    multa: 0,
    plan: ''
  });

  const [planForm, setPlanForm] = useState({
    fecha: todayIso(),
    hallazgo: '',
    causa: '',
    accion: '',
    responsable: '',
    avance: 0,
    estado: 'Abierto'
  });

  const c = Store.get('contracts', cid);
  if (!c) return <div className="empty">Contrato no encontrado</div>;

  const breaches = (Store.byContract('breaches', cid) as Breach[]).sort((a, b) =>
    (a.fecha || '') < (b.fecha || '') ? 1 : -1
  );
  const plans = (Store.byContract('plans', cid) as Plan[]).sort((a, b) =>
    (a.fecha || '') < (b.fecha || '') ? 1 : -1
  );
  const obligations = Store.byContract('obligations', cid) as Obligation[];

  const handleExportBreaches = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      { l: 'Fecha', k: 'fecha', r: (r: any) => fdate(r.fecha) },
      { l: 'Tipo', k: 'tipo' },
      { l: 'Descripción', k: 'descripcion' },
      { l: 'Responsable', k: 'responsable' },
      { l: 'Impacto', k: 'impacto' },
      { l: 'Estado', k: 'estado' },
      { l: 'Medida / Sanción', k: 'medida' }
    ];
    exportRows('Incumplimientos - ' + c.numero, cols, breaches, format);
  };

  const handleCreateBreach = () => {
    if (!AuthService.guard('crear')) return;
    if (!breachForm.descripcion.trim()) return alert('Ingrese la descripción del incumplimiento');

    const newBreach: Breach = {
      id: uid('IN'),
      contractId: cid,
      fecha: breachForm.fecha,
      obligationId: breachForm.obligationId || undefined,
      tipo: breachForm.tipo,
      descripcion: breachForm.descripcion.trim(),
      responsable: breachForm.responsable || c.responsable || 'Supervisor',
      impacto: breachForm.impacto,
      estado: breachForm.estado,
      medida: breachForm.medida,
      multa: Number(breachForm.multa) || undefined,
      plan: breachForm.plan
    };

    Store.insert('breaches', newBreach);
    Audit.log({
      contractId: cid,
      modulo: 'Incumplimientos',
      accion: 'Creación',
      campo: 'Nuevo incumplimiento ' + newBreach.id,
      nuevo: `${newBreach.tipo}: ${newBreach.descripcion.slice(0, 40)}`
    });

    setShowBreachModal(false);
    setBreachForm({
      fecha: todayIso(),
      obligationId: '',
      tipo: 'Retraso en cronograma',
      descripcion: '',
      responsable: '',
      impacto: 'Medio',
      estado: 'Abierto',
      medida: '',
      multa: 0,
      plan: ''
    });
  };

  const handleCreatePlan = () => {
    if (!AuthService.guard('crear')) return;
    if (!planForm.hallazgo.trim()) return alert('Ingrese el hallazgo');
    if (!planForm.accion.trim()) return alert('Ingrese la acción correctiva');

    const newPlan: Plan = {
      id: uid('PM'),
      contractId: cid,
      fecha: planForm.fecha,
      hallazgo: planForm.hallazgo.trim(),
      causa: planForm.causa.trim(),
      accion: planForm.accion.trim(),
      responsable: planForm.responsable || c.supervisor || 'Supervisor',
      estado: planForm.estado,
      avance: Number(planForm.avance) || 0
    };

    Store.insert('plans', newPlan);
    Audit.log({
      contractId: cid,
      modulo: 'Planes',
      accion: 'Creación',
      campo: 'Nuevo plan de mejoramiento ' + newPlan.id,
      nuevo: `${(newPlan.hallazgo || newPlan.accion || '').slice(0, 40)}`
    });

    setShowPlanModal(false);
    setPlanForm({
      fecha: todayIso(),
      hallazgo: '',
      causa: '',
      accion: '',
      responsable: '',
      avance: 0,
      estado: 'Abierto'
    });
  };

  return (
    <div className="panel">
      {/* Incumplimientos Section */}
      <div className="panel-h" style={{ borderTop: 0 }}>
        <div>
          <h3>Incumplimientos</h3>
          <span className="sub">{breaches.length} caso(s) registrado(s)</span>
        </div>
        <div className="row-flex">
          <div className="exp-actions">
            <button className="btn sm" onClick={() => handleExportBreaches('xlsx')}>
              <Icon name="file-excel" /> Excel
            </button>
            <button className="btn sm" onClick={() => handleExportBreaches('pdf')}>
              <Icon name="file-pdf" /> PDF
            </button>
            <button className="btn sm" onClick={() => handleExportBreaches('csv')}>
              <Icon name="file-csv" /> CSV
            </button>
          </div>
          <button className="btn sm pri" onClick={() => setShowBreachModal(true)}>
            <Icon name="plus" /> Registrar incumplimiento
          </button>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th className="nw">Fecha</th>
              <th>Tipo</th>
              <th>Descripción</th>
              <th className="nw">Obligación</th>
              <th className="nw">Impacto</th>
              <th className="nw">Estado</th>
              <th>Medida tomada</th>
            </tr>
          </thead>
          <tbody>
            {breaches.map((b) => {
              const obl = obligations.find((o) => o.id === b.obligationId);
              return (
                <tr key={b.id}>
                  <td className="nw">{fdate(b.fecha)}</td>
                  <td className="nw">
                    <b>{b.tipo}</b>
                  </td>
                  <td className="clip" style={{ maxWidth: '320px' }} title={b.descripcion}>
                    {b.descripcion}
                    {b.plan && <div className="small muted">Plan: {b.plan}</div>}
                  </td>
                  <td className="nw">
                    {obl ? (
                      <span className="link" title={obl.descripcion}>
                        {obl.id}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="nw">
                    <Badge
                      text={b.impacto}
                      color={
                        b.impacto === 'Alto'
                          ? 'crit'
                          : b.impacto === 'Medio'
                          ? 'warn'
                          : 'default'
                      }
                    />
                  </td>
                  <td className="nw">
                    <Badge
                      text={b.estado}
                      color={
                        b.estado === 'Cerrado' || b.estado === 'Subsanado'
                          ? 'ok'
                          : b.estado === 'En análisis'
                          ? 'warn'
                          : 'risk'
                      }
                    />
                  </td>
                  <td className="clip" style={{ maxWidth: '200px' }}>
                    {b.medida || (b.multa ? `Multa: $${b.multa}` : '—')}
                  </td>
                </tr>
              );
            })}
            {breaches.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  El contrato no registra incumplimientos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Planes de Mejoramiento Section */}
      <div className="panel-h" style={{ borderTop: '1px solid var(--line)', marginTop: '20px' }}>
        <div>
          <h3>Planes de mejoramiento</h3>
          <span className="sub">{plans.length} plan(es)</span>
        </div>
        <div className="row-flex">
          <button className="btn sm pri" onClick={() => setShowPlanModal(true)}>
            <Icon name="plus" /> Nuevo plan
          </button>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Hallazgo</th>
              <th>Causa</th>
              <th>Acción correctiva</th>
              <th>Responsable</th>
              <th className="nw">Compromiso</th>
              <th className="nw" style={{ minWidth: '130px' }}>
                % Avance
              </th>
              <th className="nw">Estado</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <td className="clip" style={{ maxWidth: '220px' }} title={p.hallazgo}>
                  <b>{p.hallazgo}</b>
                </td>
                <td className="clip" style={{ maxWidth: '180px' }} title={p.causa}>
                  {p.causa || '—'}
                </td>
                <td className="clip" style={{ maxWidth: '260px' }} title={p.accion}>
                  {p.accion}
                </td>
                <td>{p.responsable || '—'}</td>
                <td className="nw">{fdate(p.fecha)}</td>
                <td className="nw">
                  <div className="row-flex" style={{ gap: '8px' }}>
                    <div className="bar" style={{ flex: 1, minWidth: '60px' }}>
                      <i style={{ width: pct(p.avance || 0) }}></i>
                    </div>
                    <span className="small">{pct(p.avance || 0)}</span>
                  </div>
                </td>
                <td className="nw">
                  <Badge
                    text={p.estado}
                    color={
                      p.estado === 'Cerrado'
                        ? 'ok'
                        : p.estado === 'En ejecución'
                        ? 'brand'
                        : 'warn'
                    }
                  />
                </td>
              </tr>
            ))}
            {plans.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  Sin planes de mejoramiento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Breach Modal */}
      {showBreachModal && (
        <Modal
          title="Registrar incumplimiento contractual"
          onClose={() => setShowBreachModal(false)}
          size="lg"
          footer={
            <>
              <button className="btn" onClick={() => setShowBreachModal(false)}>
                Cancelar
              </button>
              <button className="btn pri" onClick={handleCreateBreach}>
                <Icon name="save" /> Guardar incumplimiento
              </button>
            </>
          }
        >
          <div className="grid g-2" style={{ gap: '14px' }}>
            <div>
              <label className="lbl required">Tipo de incumplimiento</label>
              <select
                className="inp"
                value={breachForm.tipo}
                onChange={(e) => setBreachForm({ ...breachForm, tipo: e.target.value })}
              >
                <option value="Retraso en cronograma">Retraso en cronograma</option>
                <option value="Calidad de entregable">Calidad de entregable</option>
                <option value="No aporte de pólizas">No aporte de pólizas</option>
                <option value="Incumplimiento de pagos a personal">Incumplimiento pagos/seguridad social</option>
                <option value="Inobservancia técnica">Inobservancia técnica o ambiental</option>
                <option value="Otro">Otro incumplimiento</option>
              </select>
            </div>
            <div>
              <label className="lbl required">Fecha de reporte</label>
              <input
                type="date"
                className="inp"
                value={breachForm.fecha}
                onChange={(e) => setBreachForm({ ...breachForm, fecha: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl">Obligación asociada (opcional)</label>
              <select
                className="inp"
                value={breachForm.obligationId}
                onChange={(e) => setBreachForm({ ...breachForm, obligationId: e.target.value })}
              >
                <option value="">— Ninguna —</option>
                {obligations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} · {o.descripcion.slice(0, 50)}...
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl">Nivel de impacto</label>
              <select
                className="inp"
                value={breachForm.impacto}
                onChange={(e) => setBreachForm({ ...breachForm, impacto: e.target.value })}
              >
                <option value="Bajo">Bajo</option>
                <option value="Medio">Medio</option>
                <option value="Alto">Alto</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl required">Descripción de los hechos</label>
              <textarea
                className="inp"
                rows={3}
                value={breachForm.descripcion}
                placeholder="Detalle detallado del incumplimiento evidenciado..."
                onChange={(e) => setBreachForm({ ...breachForm, descripcion: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl">Medida administrativa o correctiva</label>
              <input
                className="inp"
                value={breachForm.medida}
                placeholder="Ej. Requerimiento formal escrito / Audiencia"
                onChange={(e) => setBreachForm({ ...breachForm, medida: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl">Valor de multa tasada (si aplica)</label>
              <input
                type="number"
                className="inp"
                value={breachForm.multa}
                onChange={(e) => setBreachForm({ ...breachForm, multa: Number(e.target.value) })}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Plan Modal */}
      {showPlanModal && (
        <Modal
          title="Nuevo plan de mejoramiento"
          onClose={() => setShowPlanModal(false)}
          size="lg"
          footer={
            <>
              <button className="btn" onClick={() => setShowPlanModal(false)}>
                Cancelar
              </button>
              <button className="btn pri" onClick={handleCreatePlan}>
                <Icon name="save" /> Registrar plan
              </button>
            </>
          }
        >
          <div className="grid g-2" style={{ gap: '14px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl required">Hallazgo / Hecho observado</label>
              <textarea
                className="inp"
                rows={2}
                value={planForm.hallazgo}
                placeholder="Hallazgo identificado en supervisión o auditoría..."
                onChange={(e) => setPlanForm({ ...planForm, hallazgo: e.target.value })}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl">Causa raíz</label>
              <textarea
                className="inp"
                rows={2}
                value={planForm.causa}
                placeholder="Causa raíz que originó el problema..."
                onChange={(e) => setPlanForm({ ...planForm, causa: e.target.value })}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl required">Acción correctiva comprometida</label>
              <textarea
                className="inp"
                rows={2}
                value={planForm.accion}
                placeholder="Acciones específicas para subsanar el hallazgo..."
                onChange={(e) => setPlanForm({ ...planForm, accion: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl required">Fecha límite de compromiso</label>
              <input
                type="date"
                className="inp"
                value={planForm.fecha}
                onChange={(e) => setPlanForm({ ...planForm, fecha: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl">Responsable del cumplimiento</label>
              <input
                className="inp"
                value={planForm.responsable}
                placeholder={c.contratista || 'Contratista'}
                onChange={(e) => setPlanForm({ ...planForm, responsable: e.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
