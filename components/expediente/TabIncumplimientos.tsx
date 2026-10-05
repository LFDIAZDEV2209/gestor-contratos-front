'use client';

import { PBar } from '../ui/PBar';
import { notify, confirmAction } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, EmptyState } from '../ui/Workspace';
import type { Breach, Plan, Obligation } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { fdate, pct } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Icon } from '../icons';
import Link from 'next/link';
import { nuevoHref, editarHref } from './routes';

export const TabIncumplimientos = ({ cid }: { cid: string }) => {
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

  /* Alta y gestión de incumplimientos/planes en VISTAS dedicadas (modales cero). */
  const documentosExportPlanes = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      { l: 'Fecha límite', k: 'fecha', r: (r: any) => fdate(r.fecha) },
      { l: 'Hallazgo', k: 'hallazgo' },
      { l: 'Causa', k: 'causa' },
      { l: 'Acción', k: 'accion' },
      { l: 'Responsable', k: 'responsable' },
      { l: 'Avance %', k: 'avance' },
      { l: 'Estado', k: 'estado' }
    ];
    exportRows('Planes de mejoramiento - ' + c.numero, cols, plans, format);
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

  const handleDeletePlan = async (p: Plan) => {
    if (!AuthService.guard('editar')) return;
    const ok = await confirmAction(`¿Está seguro de eliminar el plan de mejoramiento ${p.id}?`);
    if (!ok) return;

    const db = Store.getDB();
    db.plans = (db.plans || []).filter((item) => item.id !== p.id);
    Store.persist();
    Audit.log({
      contractId: cid,
      modulo: 'Planes',
      accion: 'Eliminación',
      campo: 'Plan ' + p.id,
      anterior: p.hallazgo || p.accion || ''
    });
    notify(`Plan ${p.id} eliminado`);
  };

  return (
    <div className="tab-incumplimientos-container">
      {/* Encabezado */}
      <div className="panel-h mb-3 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-[var(--ink)] flex items-center gap-2"><Icon name="alert-triangle" size={16} /> Gestión de incumplimientos y planes de mejoramiento</h3>
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
          <Link className="btn sm pri" href={nuevoHref(cid, 'incumplimientos')} aria-label="Registrar incumplimiento">
            <Icon name="plus" /> Registrar incumplimiento
          </Link>
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
            <h3 className="font-semibold text-sm flex items-center gap-2"><Icon name="alert-circle" size={15} /> Registro de faltas contractuales e infracciones</h3>
            <span className="sub text-xs text-[var(--muted)]">{totalBreaches} caso(s) registrado(s)</span>
          </div>
        </div>

        {breaches.length === 0 ? (
          <EmptyState
            title="Sin incumplimientos registrados"
            description="El contrato presenta un récord de ejecución conforme a los términos y obligaciones pactadas."
            action={
              <Link className="btn pri sm" href={nuevoHref(cid, 'incumplimientos')}>
                <Icon name="plus" /> Registrar reporte
              </Link>
            }
          />
        ) : (
          <TableViewport className="tbl-wrap">
            <DataTable className="tbl" aria-label="Incumplimientos registrados del contrato">
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
                          <Link
                            className="btn ghost xs"
                            href={editarHref(cid, 'incumplimientos', b.id)}
                            title="Gestionar estado o medida"
                            aria-label={`Gestionar incumplimiento ${b.id}`}
                          >
                            <Icon name="pencil" size={13} />
                          </Link>
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
            <h3 className="font-semibold text-sm flex items-center gap-2"><Icon name="list-check" size={15} /> Planes de mejoramiento y compromisos suscritos</h3>
            <span className="sub text-xs text-[var(--muted)]">{totalPlanes} plan(es) formalizado(s)</span>
          </div>
          <div className="row-flex">
            <Link className="btn sm pri" href={nuevoHref(cid, 'planes')} aria-label="Crear nuevo plan de mejoramiento">
              <Icon name="plus" /> Nuevo plan
            </Link>
          </div>
        </div>

        {plans.length === 0 ? (
          <EmptyState
            title="Sin planes de mejoramiento suscritos"
            description="No se han requerido planes de acción correctiva para este contrato."
            action={
              <Link className="btn pri sm" href={nuevoHref(cid, 'planes')}>
                <Icon name="plus" /> Registrar plan
              </Link>
            }
          />
        ) : (
          <TableViewport className="tbl-wrap">
            <DataTable className="tbl" aria-label="Planes de mejoramiento del contrato">
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
                        <Link
                          className="btn ghost xs"
                          href={editarHref(cid, 'planes', p.id)}
                          title="Actualizar avance del plan"
                          aria-label={`Gestionar plan ${p.id}`}
                        >
                          <Icon name="pencil" size={13} />
                        </Link>
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
    </div>
  );
};
