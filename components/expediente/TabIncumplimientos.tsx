'use client';

import { useState } from 'react';
import { PBar } from '../ui/PBar';
import { Select, Input, Textarea } from '../ui/Controls';
import { notify, confirmAction } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, FormGrid, Field, EmptyState } from '../ui/Workspace';
import type { Breach, Plan, Obligation } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { fdate, todayIso, uid, pct } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const TabIncumplimientos = ({ cid }: { cid: string }) => {
  const [showBreachModal, setShowBreachModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [managingBreach, setManagingBreach] = useState<Breach | null>(null);
  const [managingPlan, setManagingPlan] = useState<Plan | null>(null);

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
  if (!c) {
    return (
      <EmptyState
        title="Contrato no encontrado"
        description="No se encontró el contrato especificado para consultar incumplimientos."
      />
    );
  }

  const breaches = (Store.byContract('breaches', cid) as Breach[]).sort((a, b) =>
    ((a.fecha || '') < (b.fecha || '') ? 1 : -1)
  );
  const plans = (Store.byContract('plans', cid) as Plan[]).sort((a, b) =>
    ((a.fecha || '') < (b.fecha || '') ? 1 : -1)
  );
  const obligations = Store.byContract('obligations', cid) as Obligation[];

  // Estadísticas KPI
  const totalBreaches = breaches.length;
  const abiertos = breaches.filter((b) => b.estado === 'Abierto' || b.estado === 'En análisis' || b.estado === 'En gestión').length;
  const altos = breaches.filter((b) => b.impacto === 'Alto' && b.estado !== 'Cerrado' && b.estado !== 'Subsanado').length;
  const subsanados = breaches.filter((b) => b.estado === 'Subsanado' || b.estado === 'Cerrado').length;
  const totalPlanes = plans.length;

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
    if (!breachForm.descripcion.trim()) return notify('Ingrese la descripción del incumplimiento');

    const newBreach: Breach = {
      id: uid('IN'),
      contractId: cid,
      fecha: breachForm.fecha,
      obligationId: breachForm.obligationId || undefined,
      tipo: breachForm.tipo,
      descripcion: breachForm.descripcion.trim(),
      responsable: breachForm.responsable.trim() || c.responsable || 'Supervisor',
      impacto: breachForm.impacto,
      estado: breachForm.estado,
      medida: breachForm.medida.trim(),
      multa: Number(breachForm.multa) || undefined,
      plan: breachForm.plan.trim()
    };

    Store.insert('breaches', newBreach);
    Audit.log({
      contractId: cid,
      modulo: 'Incumplimientos',
      accion: 'Creación',
      campo: 'Nuevo incumplimiento ' + newBreach.id,
      nuevo: `${newBreach.tipo}: ${newBreach.descripcion.slice(0, 40)}`
    });

    notify(`Incumplimiento registrado correctamente`);
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

  const handleUpdateBreach = () => {
    if (!AuthService.guard('editar')) return;
    if (!managingBreach) return;

    Store.update('breaches', managingBreach.id, {
      tipo: managingBreach.tipo,
      descripcion: managingBreach.descripcion?.trim(),
      impacto: managingBreach.impacto,
      estado: managingBreach.estado,
      medida: managingBreach.medida?.trim(),
      multa: Number(managingBreach.multa) || undefined,
      plan: managingBreach.plan?.trim()
    });

    Audit.log({
      contractId: cid,
      modulo: 'Incumplimientos',
      accion: 'Edición',
      campo: 'Incumplimiento ' + managingBreach.id,
      nuevo: `Estado: ${managingBreach.estado} · Medida: ${managingBreach.medida || '—'}`
    });

    notify(`Incumplimiento ${managingBreach.id} actualizado`);
    setManagingBreach(null);
  };

  const handleDeleteBreach = async (b: Breach) => {
    if (!AuthService.guard('editar')) return;
    const ok = await confirmAction(`¿Está seguro de eliminar el registro de incumplimiento ${b.id}?`);
    if (!ok) return;

    const db = Store.getDB();
    db.breaches = (db.breaches || []).filter((item) => item.id !== b.id);
    Store.persist();
    Audit.log({
      contractId: cid,
      modulo: 'Incumplimientos',
      accion: 'Eliminación',
      campo: 'Incumplimiento ' + b.id,
      anterior: b.tipo
    });
    notify(`Incumplimiento ${b.id} eliminado`);
  };

  const handleCreatePlan = () => {
    if (!AuthService.guard('crear')) return;
    if (!planForm.hallazgo.trim()) return notify('Ingrese el hallazgo');
    if (!planForm.accion.trim()) return notify('Ingrese la acción correctiva');

    const newPlan: Plan = {
      id: uid('PM'),
      contractId: cid,
      fecha: planForm.fecha,
      hallazgo: planForm.hallazgo.trim(),
      causa: planForm.causa.trim(),
      accion: planForm.accion.trim(),
      responsable: planForm.responsable.trim() || c.supervisor || 'Supervisor',
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

    notify(`Plan de mejoramiento registrado`);
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

  const handleUpdatePlan = () => {
    if (!AuthService.guard('editar')) return;
    if (!managingPlan) return;

    Store.update('plans', managingPlan.id, {
      hallazgo: managingPlan.hallazgo?.trim(),
      causa: managingPlan.causa?.trim(),
      accion: managingPlan.accion?.trim(),
      responsable: managingPlan.responsable?.trim(),
      avance: Number(managingPlan.avance) || 0,
      estado: managingPlan.estado
    });

    Audit.log({
      contractId: cid,
      modulo: 'Planes',
      accion: 'Edición',
      campo: 'Plan ' + managingPlan.id,
      nuevo: `Avance: ${managingPlan.avance}% (${managingPlan.estado})`
    });

    notify(`Plan de mejoramiento actualizado`);
    setManagingPlan(null);
  };

  const handleDeletePlan = async (p: Plan) => {
    if (!AuthService.guard('editar')) return;
    const ok = await confirmAction(`¿Está seguro de eliminar el plan de mejoramiento ${p.id}?`);
    if (!ok) return;

    const db = Store.getDB();
    db.plans = (db.plans || []).filter((item) => item.id !== p.id);
    Store.persist();
    notify(`Plan ${p.id} eliminado`);
  };

  return (
    <div className="tab-incumplimientos-container">
      {/* Encabezado */}
      <div className="panel-h mb-3 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-[var(--ink)]">Gestión de incumplimientos y planes de mejoramiento</h3>
          <span className="sub text-xs text-[var(--muted)]">
            Registro formal de faltas contractuales, medidas administrativas, requerimientos y compromisos
          </span>
        </div>
        <div className="row-flex">
          <div className="exp-actions">
            <Button className="btn sm" onClick={() => handleExportBreaches('xlsx')} title="Exportar a Excel" aria-label="Exportar Excel">
              <Icon name="file-excel" /> Excel
            </Button>
            <Button className="btn sm" onClick={() => handleExportBreaches('pdf')} title="Exportar a PDF" aria-label="Exportar PDF">
              <Icon name="file-pdf" /> PDF
            </Button>
            <Button className="btn sm" onClick={() => handleExportBreaches('csv')} title="Exportar a CSV" aria-label="Exportar CSV">
              <Icon name="file-csv" /> CSV
            </Button>
          </div>
          <Button className="btn sm pri" onClick={() => setShowBreachModal(true)} aria-label="Registrar incumplimiento">
            <Icon name="plus" /> Registrar incumplimiento
          </Button>
        </div>
      </div>

      {/* KPI Cards canónicas */}
      <div className="kpis mb [&_.kpi]:!p-2 sm:[&_.kpi]:!p-[14px_16px] [&_.kpi-ic]:!w-7 [&_.kpi-ic]:!h-7 sm:[&_.kpi-ic]:!w-[34px] sm:[&_.kpi-ic]:!h-[34px] [&_.kpi.kpi-v2]:!gap-2 sm:[&_.kpi.kpi-v2]:!gap-3 [&_.kpi-v]:!whitespace-nowrap [&_.kpi-v]:!text-[13.5px] sm:[&_.kpi-v]:!text-[23px] [&_.kpi-s]:!whitespace-nowrap [&_.kpi-s]:!text-[9.5px] sm:[&_.kpi-s]:!text-[11.5px]">
        <Kpi
          label="Total incumplimientos"
          value={totalBreaches}
          sub="Expediente disciplinario"
          color="brand"
          icon="alert-triangle"
        />
        <Kpi
          label="Casos abiertos / trámite"
          value={abiertos}
          sub={abiertos > 0 ? 'En gestión activa' : 'Sin casos pendientes'}
          color={abiertos > 0 ? 'crit' : 'ok'}
          icon="alert-circle"
        />
        <Kpi
          label="Casos de impacto alto"
          value={altos}
          sub={altos > 0 ? 'Riesgo para el contrato' : 'Ningún caso crítico'}
          color={altos > 0 ? 'risk' : 'ok'}
          icon="shield-alert"
        />
        <Kpi
          label="Casos subsanados"
          value={subsanados}
          sub="Con plan o cierre formal"
          color="ok"
          icon="check-circle"
        />
        <Kpi
          label="Planes de mejoramiento"
          value={totalPlanes}
          sub="Acciones comprometidas"
          color="info"
          icon="list-checks"
        />
      </div>

      {/* Tabla detallada de Incumplimientos */}
      <Surface className="panel mb-4">
        <div className="panel-h flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Registro de faltas contractuales e infracciones</h3>
            <span className="sub text-xs text-[var(--muted)]">{totalBreaches} caso(s) registrado(s)</span>
          </div>
        </div>

        {breaches.length === 0 ? (
          <EmptyState
            title="Sin incumplimientos registrados"
            description="El contrato presenta un récord de ejecución conforme a los términos y obligaciones pactadas."
            action={
              <Button className="btn pri sm" onClick={() => setShowBreachModal(true)}>
                <Icon name="plus" /> Registrar reporte
              </Button>
            }
          />
        ) : (
          <TableViewport className="tbl-wrap">
            <DataTable className="tbl">
              <thead>
                <tr>
                  <th className="nw">Fecha reporte</th>
                  <th>Tipo de falta</th>
                  <th>Descripción de los hechos</th>
                  <th className="nw">Obligación asociada</th>
                  <th className="nw">Impacto</th>
                  <th className="nw">Estado</th>
                  <th>Medida / Sanción</th>
                  <th className="nw text-right" style={{ width: '120px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {breaches.map((b) => {
                  const obl = obligations.find((o) => o.id === b.obligationId);
                  return (
                    <tr key={b.id} className="hover:bg-[var(--surface-2)] transition-colors">
                      <td className="nw text-xs text-[var(--muted)]">{fdate(b.fecha)}</td>
                      <td className="nw font-bold text-xs text-[var(--ink)]">
                        {b.tipo}
                      </td>
                      <td className="clip" style={{ maxWidth: '300px' }} title={b.descripcion}>
                        <span className="text-xs text-[var(--ink)] block">{b.descripcion}</span>
                        {b.plan && (
                          <div className="small text-[var(--muted)] line-clamp-1 mt-0.5">
                            <b>Plan:</b> {b.plan}
                          </div>
                        )}
                      </td>
                      <td className="nw">
                        {obl ? (
                          <span className="link text-xs" title={obl.descripcion}>
                            {obl.id}
                          </span>
                        ) : (
                          <span className="text-[var(--muted)] text-xs">—</span>
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
                      <td className="clip text-xs text-[var(--ink-2)]" style={{ maxWidth: '180px' }}>
                        {b.medida || (b.multa ? `Multa: $${b.multa}` : '—')}
                      </td>
                      <td className="nw text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          <Button
                            className="btn ghost xs"
                            onClick={() => setManagingBreach({ ...b })}
                            title="Gestionar estado o medida"
                            aria-label={`Gestionar incumplimiento ${b.id}`}
                          >
                            <Icon name="pencil" size={13} />
                          </Button>
                          <Button
                            className="btn ghost xs text-[var(--crit)] hover:bg-[var(--crit-bg)]"
                            onClick={() => handleDeleteBreach(b)}
                            title="Eliminar registro"
                            aria-label={`Eliminar incumplimiento ${b.id}`}
                          >
                            <Icon name="trash" size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </TableViewport>
        )}
      </Surface>

      {/* Planes de Mejoramiento */}
      <Surface className="panel">
        <div className="panel-h flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Planes de mejoramiento y compromisos suscritos</h3>
            <span className="sub text-xs text-[var(--muted)]">{totalPlanes} plan(es) formalizado(s)</span>
          </div>
          <div className="row-flex">
            <Button className="btn sm pri" onClick={() => setShowPlanModal(true)} aria-label="Crear nuevo plan de mejoramiento">
              <Icon name="plus" /> Nuevo plan
            </Button>
          </div>
        </div>

        {plans.length === 0 ? (
          <EmptyState
            title="Sin planes de mejoramiento suscritos"
            description="No se han requerido planes de acción correctiva para este contrato."
            action={
              <Button className="btn pri sm" onClick={() => setShowPlanModal(true)}>
                <Icon name="plus" /> Registrar plan
              </Button>
            }
          />
        ) : (
          <TableViewport className="tbl-wrap">
            <DataTable className="tbl">
              <thead>
                <tr>
                  <th>Hallazgo observado</th>
                  <th>Causa raíz</th>
                  <th>Acción correctiva pactada</th>
                  <th>Responsable</th>
                  <th className="nw">Compromiso</th>
                  <th className="nw" style={{ minWidth: '130px' }}>% Avance</th>
                  <th className="nw">Estado</th>
                  <th className="nw text-right" style={{ width: '120px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} className="hover:bg-[var(--surface-2)] transition-colors">
                    <td className="clip" style={{ maxWidth: '200px' }} title={p.hallazgo}>
                      <b className="text-xs text-[var(--ink)] block">{p.hallazgo}</b>
                    </td>
                    <td className="clip text-xs text-[var(--muted)]" style={{ maxWidth: '160px' }} title={p.causa}>
                      {p.causa || '—'}
                    </td>
                    <td className="clip text-xs text-[var(--ink-2)]" style={{ maxWidth: '240px' }} title={p.accion}>
                      {p.accion}
                    </td>
                    <td className="text-xs text-[var(--ink)]">{p.responsable || '—'}</td>
                    <td className="nw text-xs text-[var(--muted)]">{fdate(p.fecha)}</td>
                    <td className="nw">
                      <PBar value={p.avance || 0} />
                    </td>
                    <td className="nw">
                      <Badge
                        text={p.estado}
                        color={
                          p.estado === 'Cerrado' || p.estado === 'Cumplido'
                            ? 'ok'
                            : p.estado === 'En ejecución'
                            ? 'brand'
                            : 'warn'
                        }
                      />
                    </td>
                    <td className="nw text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <Button
                          className="btn ghost xs"
                          onClick={() => setManagingPlan({ ...p })}
                          title="Actualizar avance del plan"
                          aria-label={`Gestionar plan ${p.id}`}
                        >
                          <Icon name="pencil" size={13} />
                        </Button>
                        <Button
                          className="btn ghost xs text-[var(--crit)] hover:bg-[var(--crit-bg)]"
                          onClick={() => handleDeletePlan(p)}
                          title="Eliminar plan"
                          aria-label={`Eliminar plan ${p.id}`}
                        >
                          <Icon name="trash" size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableViewport>
        )}
      </Surface>

      {/* Modal Registrar Incumplimiento */}
      {showBreachModal && (
        <Modal
          title="Registrar incumplimiento contractual"
          onClose={() => setShowBreachModal(false)}
          size="lg"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button className="btn ghost" onClick={() => setShowBreachModal(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleCreateBreach}>
                <Icon name="check" /> Guardar Incumplimiento
              </Button>
            </div>
          }
        >
          <FormGrid className="form-grid">
            <Field className="f">
              <label className="req font-medium text-xs">Tipo de falta</label>
              <Select
                value={breachForm.tipo}
                onChange={(e) => setBreachForm({ ...breachForm, tipo: e.target.value })}
              >
                <option value="Retraso en cronograma">Retraso en cronograma</option>
                <option value="Calidad de entregable">Deficiencia en calidad de entregable</option>
                <option value="No aporte de pólizas">No aporte o no renovación de pólizas</option>
                <option value="Incumplimiento de pagos a personal">Incumplimiento pagos/seguridad social</option>
                <option value="Inobservancia técnica">Inobservancia técnica o ambiental</option>
                <option value="Otro">Otro incumplimiento</option>
              </Select>
            </Field>

            <Field className="f">
              <label className="req font-medium text-xs">Fecha de reporte formal</label>
              <Input
                type="date"
                value={breachForm.fecha}
                onChange={(e) => setBreachForm({ ...breachForm, fecha: e.target.value })}
                required
              />
            </Field>

            <Field className="f">
              <label className="font-medium text-xs">Obligación contractual asociada</label>
              <Select
                value={breachForm.obligationId}
                onChange={(e) => setBreachForm({ ...breachForm, obligationId: e.target.value })}
              >
                <option value="">— Ninguna en particular —</option>
                {obligations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} · {o.descripcion.slice(0, 50)}...
                  </option>
                ))}
              </Select>
            </Field>

            <Field className="f">
              <label className="font-medium text-xs">Nivel de impacto</label>
              <Select
                value={breachForm.impacto}
                onChange={(e) => setBreachForm({ ...breachForm, impacto: e.target.value })}
              >
                <option value="Bajo">Bajo</option>
                <option value="Medio">Medio</option>
                <option value="Alto">Alto</option>
              </Select>
            </Field>

            <Field className="f span2">
              <label className="req font-medium text-xs">Descripción detallada de los hechos</label>
              <Textarea
                rows={3}
                value={breachForm.descripcion}
                placeholder="Detalle los hechos verificados, requerimientos desatendidos o evidencias recogidas..."
                onChange={(e) => setBreachForm({ ...breachForm, descripcion: e.target.value })}
                required
              />
            </Field>

            <Field className="f">
              <label className="font-medium text-xs">Medida administrativa adoptada</label>
              <Input
                value={breachForm.medida}
                placeholder="Ej. Requerimiento formal con apercibimiento"
                onChange={(e) => setBreachForm({ ...breachForm, medida: e.target.value })}
              />
            </Field>

            <Field className="f">
              <label className="font-medium text-xs">Valor tasado de sanción/multa (COP)</label>
              <Input
                type="number"
                min="0"
                value={breachForm.multa || ''}
                placeholder="0"
                onChange={(e) => setBreachForm({ ...breachForm, multa: Number(e.target.value) })}
              />
            </Field>

            <Field className="f span2">
              <label className="font-medium text-xs">Plan de mitigación o acción de choque exigida</label>
              <Input
                value={breachForm.plan}
                placeholder="Ej. Radicación de cronograma acelerado en 5 días hábiles"
                onChange={(e) => setBreachForm({ ...breachForm, plan: e.target.value })}
              />
            </Field>
          </FormGrid>
        </Modal>
      )}

      {/* Modal Gestionar Incumplimiento */}
      {managingBreach && (
        <Modal
          title={`Gestionar incumplimiento · ${managingBreach.id}`}
          onClose={() => setManagingBreach(null)}
          size="lg"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button className="btn ghost" onClick={() => setManagingBreach(null)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleUpdateBreach}>
                <Icon name="check" /> Guardar Estado
              </Button>
            </div>
          }
        >
          <FormGrid className="form-grid">
            <Field className="f">
              <label className="req font-medium text-xs">Estado de trámite</label>
              <Select
                value={managingBreach.estado}
                onChange={(e) => setManagingBreach({ ...managingBreach, estado: e.target.value })}
              >
                <option value="Abierto">Abierto</option>
                <option value="En análisis">En análisis jurídico</option>
                <option value="En gestión">En gestión de descargos</option>
                <option value="Subsanado">Subsanado a conformidad</option>
                <option value="Cerrado">Cerrado con sanción</option>
              </Select>
            </Field>

            <Field className="f">
              <label className="req font-medium text-xs">Nivel de impacto</label>
              <Select
                value={managingBreach.impacto}
                onChange={(e) => setManagingBreach({ ...managingBreach, impacto: e.target.value as any })}
              >
                <option value="Bajo">Bajo</option>
                <option value="Medio">Medio</option>
                <option value="Alto">Alto</option>
              </Select>
            </Field>

            <Field className="f span2">
              <label className="req font-medium text-xs">Descripción</label>
              <Textarea
                rows={2}
                value={managingBreach.descripcion || ''}
                onChange={(e) => setManagingBreach({ ...managingBreach, descripcion: e.target.value })}
                required
              />
            </Field>

            <Field className="f">
              <label className="font-medium text-xs">Medida administrativa aplicada</label>
              <Input
                value={managingBreach.medida || ''}
                onChange={(e) => setManagingBreach({ ...managingBreach, medida: e.target.value })}
              />
            </Field>

            <Field className="f">
              <label className="font-medium text-xs">Multa o descuento liquidado (COP)</label>
              <Input
                type="number"
                min="0"
                value={managingBreach.multa || ''}
                onChange={(e) => setManagingBreach({ ...managingBreach, multa: Number(e.target.value) })}
              />
            </Field>

            <Field className="f span2">
              <label className="font-medium text-xs">Plan de contingencia / acuerdo de subsanación</label>
              <Input
                value={managingBreach.plan || ''}
                onChange={(e) => setManagingBreach({ ...managingBreach, plan: e.target.value })}
              />
            </Field>
          </FormGrid>
        </Modal>
      )}

      {/* Modal Registrar Plan de Mejoramiento */}
      {showPlanModal && (
        <Modal
          title="Nuevo plan de mejoramiento"
          onClose={() => setShowPlanModal(false)}
          size="lg"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button className="btn ghost" onClick={() => setShowPlanModal(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleCreatePlan}>
                <Icon name="check" /> Registrar Plan
              </Button>
            </div>
          }
        >
          <FormGrid className="form-grid">
            <Field className="f span2">
              <label className="req font-medium text-xs">Hallazgo o hecho observado</label>
              <Textarea
                rows={2}
                value={planForm.hallazgo}
                placeholder="Hallazgo documentado en informe de supervisión o auditoría..."
                onChange={(e) => setPlanForm({ ...planForm, hallazgo: e.target.value })}
                required
              />
            </Field>

            <Field className="f span2">
              <label className="font-medium text-xs">Causa raíz identificada</label>
              <Textarea
                rows={2}
                value={planForm.causa}
                placeholder="Causa técnica, logística o administrativa que originó la desviación..."
                onChange={(e) => setPlanForm({ ...planForm, causa: e.target.value })}
              />
            </Field>

            <Field className="f span2">
              <label className="req font-medium text-xs">Acción correctiva comprometida</label>
              <Textarea
                rows={2}
                value={planForm.accion}
                placeholder="Acciones verificables para corregir el hallazgo y prevenir su recurrencia..."
                onChange={(e) => setPlanForm({ ...planForm, accion: e.target.value })}
                required
              />
            </Field>

            <Field className="f">
              <label className="req font-medium text-xs">Fecha límite de cumplimiento</label>
              <Input
                type="date"
                value={planForm.fecha}
                onChange={(e) => setPlanForm({ ...planForm, fecha: e.target.value })}
                required
              />
            </Field>

            <Field className="f">
              <label className="font-medium text-xs">Responsable asignado</label>
              <Input
                value={planForm.responsable}
                placeholder={c.contratista || 'Supervisor / Contratista'}
                onChange={(e) => setPlanForm({ ...planForm, responsable: e.target.value })}
              />
            </Field>
          </FormGrid>
        </Modal>
      )}

      {/* Modal Gestionar Plan de Mejoramiento */}
      {managingPlan && (
        <Modal
          title={`Gestionar avance de plan · ${managingPlan.id}`}
          onClose={() => setManagingPlan(null)}
          size="lg"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button className="btn ghost" onClick={() => setManagingPlan(null)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleUpdatePlan}>
                <Icon name="check" /> Guardar Avance
              </Button>
            </div>
          }
        >
          <FormGrid className="form-grid">
            <Field className="f">
              <label className="req font-medium text-xs">Estado de implementación</label>
              <Select
                value={managingPlan.estado}
                onChange={(e) => setManagingPlan({ ...managingPlan, estado: e.target.value })}
              >
                <option value="Abierto">Abierto</option>
                <option value="En ejecución">En ejecución</option>
                <option value="Cumplido">Cumplido a satisfacción</option>
                <option value="Incumplido">Incumplido</option>
                <option value="Cerrado">Cerrado formalmente</option>
              </Select>
            </Field>

            <Field className="f">
              <label className="req font-medium text-xs">% Avance implementado (0-100)</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={managingPlan.avance}
                onChange={(e) => setManagingPlan({ ...managingPlan, avance: Number(e.target.value) })}
                required
              />
            </Field>

            <Field className="f span2">
              <label className="req font-medium text-xs">Acción correctiva en curso</label>
              <Textarea
                rows={2}
                value={managingPlan.accion || ''}
                onChange={(e) => setManagingPlan({ ...managingPlan, accion: e.target.value })}
                required
              />
            </Field>

            <Field className="f span2">
              <label className="font-medium text-xs">Responsable del seguimiento</label>
              <Input
                value={managingPlan.responsable || ''}
                onChange={(e) => setManagingPlan({ ...managingPlan, responsable: e.target.value })}
              />
            </Field>
          </FormGrid>
        </Modal>
      )}
    </div>
  );
};
