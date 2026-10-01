'use client';
import { notify, requestReason } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, MetricCard, Surface, TableViewport, DataTable, FormGrid } from '../ui/Workspace';

import React, { useState } from 'react';
import { Store, AuthService, Audit } from '@/lib/store';
import { activeContracts } from '@/lib/metrics';
import { fdate, money, moneyM, todayIso } from '@/lib/format';
import { exportRows } from '@/lib/export';
import { Icon } from '../icons';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { PBar } from '../ui/PBar';
import type { Breach, Plan, Contract } from '@/lib/types';

interface IncumplimientosViewProps {
  onSelectContract?: (contractId: string, tab?: string) => void;
}

export const IncumplimientosView: React.FC<IncumplimientosViewProps> = ({ onSelectContract }) => {
  const [tick, setTick] = useState(0);

  // Modales
  const [breachModalOpen, setBreachModalOpen] = useState(false);
  const [editingBreach, setEditingBreach] = useState<Breach | null>(null);
  const [breachForm, setBreachForm] = useState({
    contractId: '',
    fecha: todayIso(),
    tipo: 'Retraso en cronograma',
    descripcion: '',
    impacto: 'Medio',
    multa: 0,
    planAccion: '',
    responsable: '',
    estado: 'Abierto'
  });

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState({
    contractId: '',
    accion: '',
    responsable: '',
    fechaInicio: todayIso(),
    fechaFin: todayIso(),
    avance: 0,
    estado: 'En curso'
  });

  const refresh = () => setTick((t) => t + 1);

  const contracts: Contract[] = activeContracts();
  const breaches: Breach[] = Store.all('breaches');
  const openBreaches = breaches.filter((b) => b.estado !== 'Cerrado' && b.estado !== 'Subsanado');
  const totalMultas = breaches.reduce((acc, b) => acc + (Number(b.multa) || 0), 0);

  const plans: Plan[] = Store.all('plans');
  const activePlans = plans.filter((p) => p.estado !== 'Cerrado');

  const exportBreaches = (format: 'xlsx' | 'pdf' | 'csv' | 'print') => {
    const cols = [
      { l: 'ID', k: 'id' },
      {
        l: 'Contrato',
        x: (b: Breach) => {
          const c = Store.get('contracts', b.contractId);
          return c ? c.numero : b.contractId;
        }
      },
      { l: 'Fecha', x: (b: Breach) => fdate(b.fecha) },
      { l: 'Tipo', k: 'tipo' },
      { l: 'Descripción', k: 'descripcion' },
      { l: 'Impacto', k: 'impacto' },
      { l: 'Multa', x: (b: Breach) => (b.multa ? money(b.multa) : '—') },
      { l: 'Plan de acción', k: 'planAccion' },
      { l: 'Responsable', k: 'responsable' },
      { l: 'Estado', k: 'estado' }
    ];
    exportRows('Incumplimientos', cols, breaches, format);
  };

  const exportPlans = (format: 'xlsx' | 'pdf' | 'csv' | 'print') => {
    const cols = [
      { l: 'ID', k: 'id' },
      {
        l: 'Contrato',
        x: (p: Plan) => {
          const c = Store.get('contracts', p.contractId);
          return c ? c.numero : p.contractId;
        }
      },
      { l: 'Acción', k: 'accion' },
      { l: 'Responsable', k: 'responsable' },
      { l: 'Fecha inicio', x: (p: Plan) => fdate(p.fechaInicio) },
      { l: 'Fecha fin', x: (p: Plan) => fdate(p.fechaFin) },
      { l: '% Avance', x: (p: Plan) => `${p.avance}%` },
      { l: 'Estado', k: 'estado' }
    ];
    exportRows('Planes de mejoramiento', cols, plans, format);
  };

  // Handlers Breach
  const openNewBreachModal = () => {
    if (!AuthService.guard('crear')) return;
    setEditingBreach(null);
    setBreachForm({
      contractId: contracts[0]?.id || '',
      fecha: todayIso(),
      tipo: 'Retraso en cronograma',
      descripcion: '',
      impacto: 'Medio',
      multa: 0,
      planAccion: '',
      responsable: '',
      estado: 'Abierto'
    });
    setBreachModalOpen(true);
  };

  const openEditBreachModal = (b: Breach) => {
    if (!AuthService.guard('editar')) return;
    setEditingBreach(b);
    setBreachForm({
      contractId: b.contractId || '',
      fecha: b.fecha || todayIso(),
      tipo: b.tipo || 'Retraso en cronograma',
      descripcion: b.descripcion || '',
      impacto: b.impacto || 'Medio',
      multa: Number(b.multa) || 0,
      planAccion: b.planAccion || '',
      responsable: b.responsable || '',
      estado: b.estado || 'Abierto'
    });
    setBreachModalOpen(true);
  };

  const handleSaveBreach = () => {
    if (!breachForm.descripcion.trim()) {
      notify('Ingresa la descripción del incumplimiento.');
      return;
    }
    if (editingBreach) {
      Store.update('breaches', editingBreach.id, breachForm);
      Audit.log({
        contractId: breachForm.contractId,
        modulo: 'Incumplimientos',
        accion: 'Modificación',
        campo: 'Incumplimiento ' + editingBreach.id,
        nuevo: breachForm.descripcion
      });
    } else {
      Store.insert('breaches', breachForm);
      Audit.log({
        contractId: breachForm.contractId,
        modulo: 'Incumplimientos',
        accion: 'Creación',
        campo: 'Incumplimiento',
        nuevo: breachForm.descripcion
      });
    }
    setBreachModalOpen(false);
    refresh();
  };

  const handleAnularBreach = async (b: Breach) => {
    if (!AuthService.guard('anular')) return;
    const motivo = await requestReason('Motivo del cierre / anulación del incumplimiento:');
    if (motivo == null) return;
    Store.update('breaches', b.id, { estado: 'Subsanado' });
    Audit.log({
      contractId: b.contractId,
      modulo: 'Incumplimientos',
      accion: 'Cierre de incumplimiento',
      campo: 'Estado',
      anterior: b.estado,
      nuevo: 'Subsanado',
      obs: motivo
    });
    refresh();
  };

  // Handlers Plan
  const openNewPlanModal = () => {
    if (!AuthService.guard('crear')) return;
    setEditingPlan(null);
    setPlanForm({
      contractId: contracts[0]?.id || '',
      accion: '',
      responsable: '',
      fechaInicio: todayIso(),
      fechaFin: todayIso(),
      avance: 0,
      estado: 'En curso'
    });
    setPlanModalOpen(true);
  };

  const openEditPlanModal = (p: Plan) => {
    if (!AuthService.guard('editar')) return;
    setEditingPlan(p);
    setPlanForm({
      contractId: p.contractId || '',
      accion: p.accion || '',
      responsable: p.responsable || '',
      fechaInicio: p.fechaInicio || todayIso(),
      fechaFin: p.fechaFin || todayIso(),
      avance: Number(p.avance) || 0,
      estado: p.estado || 'En curso'
    });
    setPlanModalOpen(true);
  };

  const handleSavePlan = () => {
    if (!planForm.accion.trim()) {
      notify('Ingresa la acción o título del plan de mejoramiento.');
      return;
    }
    if (editingPlan) {
      Store.update('plans', editingPlan.id, planForm);
      Audit.log({
        contractId: planForm.contractId,
        modulo: 'Incumplimientos',
        accion: 'Modificación',
        campo: 'Plan ' + editingPlan.id,
        nuevo: planForm.accion
      });
    } else {
      Store.insert('plans', planForm);
      Audit.log({
        contractId: planForm.contractId,
        modulo: 'Incumplimientos',
        accion: 'Creación',
        campo: 'Plan de mejoramiento',
        nuevo: planForm.accion
      });
    }
    setPlanModalOpen(false);
    refresh();
  };

  const handleAnularPlan = async (p: Plan) => {
    if (!AuthService.guard('anular')) return;
    const motivo = await requestReason('Motivo del cierre del plan de mejoramiento:');
    if (motivo == null) return;
    Store.update('plans', p.id, { estado: 'Cerrado' });
    Audit.log({
      contractId: p.contractId,
      modulo: 'Incumplimientos',
      accion: 'Cierre de plan',
      campo: 'Estado',
      anterior: p.estado,
      nuevo: 'Cerrado',
      obs: motivo
    });
    refresh();
  };

  return (
    <div className="view-content">
      {/* Header */}
      <PageHeader className="page-h">
        <div>
          <h1>Incumplimientos</h1>
          <p className="sub">Registro, plan de acción, medidas y multas. Incluye planes de mejoramiento.</p>
        </div>
        <div className="row-flex">
          <Button className="btn sm" onClick={openNewPlanModal}>
            <Icon name="plus" /> Plan de mejoramiento
          </Button>
          <Button className="btn pri sm" onClick={openNewBreachModal}>
            <Icon name="plus" /> Registrar incumplimiento
          </Button>
        </div>
      </PageHeader>

      {/* KPIs */}
      <div className="kpis mb">
        <MetricCard className="kpi-card">
          <div className="kpi-t">Incumplimientos</div>
          <div className="kpi-v">{breaches.length}</div>
          <div className="kpi-s">Registrados en total</div>
        </MetricCard>
        <MetricCard className="kpi-card">
          <div className="kpi-t">Abiertos</div>
          <div className="kpi-v" style={{ color: openBreaches.length > 0 ? 'var(--crit)' : 'var(--ok)' }}>
            {openBreaches.length}
          </div>
          <div className="kpi-s">Sin subsanar</div>
        </MetricCard>
        <MetricCard className="kpi-card">
          <div className="kpi-t">Impacto alto</div>
          <div className="kpi-v" style={{ color: 'var(--risk)' }}>
            {openBreaches.filter((b) => b.impacto === 'Alto').length}
          </div>
          <div className="kpi-s">Abiertos</div>
        </MetricCard>
        <MetricCard className="kpi-card">
          <div className="kpi-t">Multas / sanciones</div>
          <div className="kpi-v">{moneyM(totalMultas)}</div>
          <div className="kpi-s">{money(totalMultas)}</div>
        </MetricCard>
        <MetricCard className="kpi-card">
          <div className="kpi-t">Planes de mejoramiento</div>
          <div className="kpi-v">{plans.length}</div>
          <div className="kpi-s">{activePlans.length} en curso</div>
        </MetricCard>
      </div>

      {/* Panel 1: Incumplimientos */}
      <Surface className="panel mb">
        <div className="panel-h">
          <h3>Incumplimientos ({breaches.length})</h3>
          <div className="row-flex">
            <Button className="btn sm xs" onClick={() => exportBreaches('xlsx')}>
              <Icon name="file-spreadsheet" /> Excel
            </Button>
            <Button className="btn sm xs" onClick={() => exportBreaches('pdf')}>
              <Icon name="file-text" /> PDF
            </Button>
            <Button className="btn sm xs" onClick={() => exportBreaches('csv')}>
              <Icon name="file-text" /> CSV
            </Button>
            <Button className="btn sm xs" onClick={() => exportBreaches('print')}>
              <Icon name="printer" /> Imprimir
            </Button>
          </div>
        </div>

        <TableViewport className="tbl-wrap">
          <DataTable className="tbl">
            <thead>
              <tr>
                <th>ID</th>
                <th>Contrato</th>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Impacto</th>
                <th className="num">Multa</th>
                <th>Plan de acción</th>
                <th>Responsable</th>
                <th>Estado</th>
                <th className="acts">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {breaches.length === 0 ? (
                <tr>
                  <td colSpan={11} className="empty">
                    No se registran incumplimientos.
                  </td>
                </tr>
              ) : (
                breaches.map((b) => {
                  const c = Store.get('contracts', b.contractId);
                  return (
                    <tr key={b.id}>
                      <td className="strong">{b.id}</td>
                      <td>
                        {c ? (
                          <span
                            className="link"
                            style={{ cursor: 'pointer', color: 'var(--brand-2)', fontWeight: 600 }}
                            onClick={() => onSelectContract?.(c.id, 'incumplimientos')}
                          >
                            {c.numero}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{fdate(b.fecha)}</td>
                      <td>
                        <span className="badge b-info">{b.tipo}</span>
                      </td>
                      <td style={{ maxWidth: 240 }}>{b.descripcion}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor:
                              b.impacto === 'Alto'
                                ? 'var(--crit)'
                                : b.impacto === 'Medio'
                                ? 'var(--risk)'
                                : 'var(--ok)',
                            color: '#fff'
                          }}
                        >
                          {b.impacto}
                        </span>
                      </td>
                      <td className="num strong">{b.multa ? money(b.multa) : '—'}</td>
                      <td style={{ maxWidth: 200 }} className="clip">
                        {b.planAccion || '—'}
                      </td>
                      <td>{b.responsable || '—'}</td>
                      <td>
                        <Badge state={b.estado} />
                      </td>
                      <td className="acts">
                        <Button
                          className="icon-btn"
                          title="Editar"
                          onClick={() => openEditBreachModal(b)}
                        >
                          <Icon name="edit" />
                        </Button>
                        {b.estado !== 'Subsanado' && b.estado !== 'Cerrado' && (
                          <Button
                            className="icon-btn"
                            title="Marcar subsanado"
                            onClick={() => handleAnularBreach(b)}
                          >
                            <Icon name="check-circle" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </DataTable>
        </TableViewport>
      </Surface>

      {/* Panel 2: Planes de mejoramiento */}
      <Surface className="panel">
        <div className="panel-h">
          <h3>Planes de mejoramiento ({plans.length})</h3>
          <div className="row-flex">
            <Button className="btn sm xs" onClick={() => exportPlans('xlsx')}>
              <Icon name="file-spreadsheet" /> Excel
            </Button>
            <Button className="btn sm xs" onClick={() => exportPlans('pdf')}>
              <Icon name="file-text" /> PDF
            </Button>
            <Button className="btn sm xs" onClick={() => exportPlans('csv')}>
              <Icon name="file-text" /> CSV
            </Button>
            <Button className="btn sm xs" onClick={() => exportPlans('print')}>
              <Icon name="printer" /> Imprimir
            </Button>
          </div>
        </div>

        <TableViewport className="tbl-wrap">
          <DataTable className="tbl">
            <thead>
              <tr>
                <th>ID</th>
                <th>Contrato</th>
                <th>Acción / Compromiso</th>
                <th>Responsable</th>
                <th>Fecha inicio</th>
                <th>Fecha compromiso</th>
                <th style={{ width: 150 }}>% Avance</th>
                <th>Estado</th>
                <th className="acts">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty">
                    No se registran planes de mejoramiento.
                  </td>
                </tr>
              ) : (
                plans.map((p) => {
                  const c = Store.get('contracts', p.contractId);
                  return (
                    <tr key={p.id}>
                      <td className="strong">{p.id}</td>
                      <td>
                        {c ? (
                          <span
                            className="link"
                            style={{ cursor: 'pointer', color: 'var(--brand-2)', fontWeight: 600 }}
                            onClick={() => onSelectContract?.(c.id, 'incumplimientos')}
                          >
                            {c.numero}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ maxWidth: 260 }}>{p.accion}</td>
                      <td>{p.responsable || '—'}</td>
                      <td>{fdate(p.fechaInicio)}</td>
                      <td>{fdate(p.fechaFin)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <PBar value={Number(p.avance) || 0} max={100} />
                          <span className="small strong">{p.avance}%</span>
                        </div>
                      </td>
                      <td>
                        <Badge state={p.estado} />
                      </td>
                      <td className="acts">
                        <Button
                          className="icon-btn"
                          title="Editar plan"
                          onClick={() => openEditPlanModal(p)}
                        >
                          <Icon name="edit" />
                        </Button>
                        {p.estado !== 'Cerrado' && (
                          <Button
                            className="icon-btn"
                            title="Cerrar plan"
                            onClick={() => handleAnularPlan(p)}
                          >
                            <Icon name="check-circle" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </DataTable>
        </TableViewport>
      </Surface>

      {/* Modal Incumplimiento */}
      {breachModalOpen && (
        <Modal
          title={editingBreach ? 'Editar incumplimiento' : 'Registrar incumplimiento'}
          onClose={() => setBreachModalOpen(false)}
          footer={
            <>
              <Button className="btn" onClick={() => setBreachModalOpen(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleSaveBreach}>
                Guardar incumplimiento
              </Button>
            </>
          }
        >
          <FormGrid className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Contrato *</label>
              <select
                className="inp"
                value={breachForm.contractId}
                onChange={(e) => setBreachForm({ ...breachForm, contractId: e.target.value })}
              >
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero} — {c.contratista}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Fecha del hecho *</label>
              <input
                type="date"
                className="inp"
                value={breachForm.fecha}
                onChange={(e) => setBreachForm({ ...breachForm, fecha: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label">Tipo de incumplimiento *</label>
              <select
                className="inp"
                value={breachForm.tipo}
                onChange={(e) => setBreachForm({ ...breachForm, tipo: e.target.value })}
              >
                <option value="Retraso en cronograma">Retraso en cronograma</option>
                <option value="Calidad del entregable">Calidad del entregable</option>
                <option value="Incumplimiento de obligación">Incumplimiento de obligación</option>
                <option value="No renovación de garantía">No renovación de garantía</option>
                <option value="Falta de personal">Falta de personal</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Descripción detallada *</label>
              <textarea
                className="inp"
                rows={2}
                value={breachForm.descripcion}
                onChange={(e) => setBreachForm({ ...breachForm, descripcion: e.target.value })}
                placeholder="Hechos que configuran el presunto incumplimiento"
              />
            </div>

            <div>
              <label className="form-label">Nivel de impacto *</label>
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

            <div>
              <label className="form-label">Multa / sanción económica (COP)</label>
              <input
                type="number"
                min={0}
                className="inp"
                value={breachForm.multa}
                onChange={(e) => setBreachForm({ ...breachForm, multa: Number(e.target.value) })}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Plan de acción requerido</label>
              <textarea
                className="inp"
                rows={2}
                value={breachForm.planAccion}
                onChange={(e) => setBreachForm({ ...breachForm, planAccion: e.target.value })}
                placeholder="Medidas de mitigación o plan exigido al contratista"
              />
            </div>

            <div>
              <label className="form-label">Responsable del seguimiento</label>
              <input
                className="inp"
                value={breachForm.responsable}
                onChange={(e) => setBreachForm({ ...breachForm, responsable: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label">Estado</label>
              <select
                className="inp"
                value={breachForm.estado}
                onChange={(e) => setBreachForm({ ...breachForm, estado: e.target.value })}
              >
                <option value="Abierto">Abierto</option>
                <option value="En descargos">En descargos</option>
                <option value="Sancionado">Sancionado</option>
                <option value="Subsanado">Subsanado</option>
                <option value="Cerrado">Cerrado</option>
              </select>
            </div>
          </FormGrid>
        </Modal>
      )}

      {/* Modal Plan de Mejoramiento */}
      {planModalOpen && (
        <Modal
          title={editingPlan ? 'Editar plan de mejoramiento' : 'Nuevo plan de mejoramiento'}
          onClose={() => setPlanModalOpen(false)}
          footer={
            <>
              <Button className="btn" onClick={() => setPlanModalOpen(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleSavePlan}>
                Guardar plan
              </Button>
            </>
          }
        >
          <FormGrid className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Contrato *</label>
              <select
                className="inp"
                value={planForm.contractId}
                onChange={(e) => setPlanForm({ ...planForm, contractId: e.target.value })}
              >
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero} — {c.contratista}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Acción / Compromiso *</label>
              <textarea
                className="inp"
                rows={2}
                value={planForm.accion}
                onChange={(e) => setPlanForm({ ...planForm, accion: e.target.value })}
                placeholder="Descripción del compromiso de mejora o plan de choque"
              />
            </div>

            <div>
              <label className="form-label">Responsable *</label>
              <input
                className="inp"
                value={planForm.responsable}
                onChange={(e) => setPlanForm({ ...planForm, responsable: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label">% de Avance (0 a 100)</label>
              <input
                type="number"
                min={0}
                max={100}
                className="inp"
                value={planForm.avance}
                onChange={(e) => setPlanForm({ ...planForm, avance: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="form-label">Fecha de inicio</label>
              <input
                type="date"
                className="inp"
                value={planForm.fechaInicio}
                onChange={(e) => setPlanForm({ ...planForm, fechaInicio: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label">Fecha límite / compromiso</label>
              <input
                type="date"
                className="inp"
                value={planForm.fechaFin}
                onChange={(e) => setPlanForm({ ...planForm, fechaFin: e.target.value })}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Estado</label>
              <select
                className="inp"
                value={planForm.estado}
                onChange={(e) => setPlanForm({ ...planForm, estado: e.target.value })}
              >
                <option value="En curso">En curso</option>
                <option value="Cumplido">Cumplido</option>
                <option value="Incumplido">Incumplido</option>
                <option value="Cerrado">Cerrado</option>
              </select>
            </div>
          </FormGrid>
        </Modal>
      )}
    </div>
  );
};
