'use client';

import { PBar } from '../ui/PBar';
import { notify, confirmAction } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, EmptyState } from '../ui/Workspace';
import type { Subcontract, Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { M } from '../../lib/metrics';
import { money, moneyM, pct, fdate, sum } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Icon } from '../icons';
import Link from 'next/link';
import { nuevoHref, editarHref } from './routes';
import { SectionHeader } from '../ui/SectionHeader';

export const TabSubcontratos = ({ cid }: { cid: string }) => {
  const c = Store.get('contracts', cid) as Contract | undefined;
  if (!c) {
    return (
      <EmptyState
        title="Contrato no encontrado"
        description="No se encontró el contrato especificado en la base de datos."
      />
    );
  }

  const m = M(c);
  const subcontracts = (Store.byContract('subcontracts', cid) as Subcontract[]).sort((a, b) =>
    (a.fechaInicio || '') < (b.fechaInicio || '') ? -1 : 1
  );

  const sv = sum(subcontracts, (s) => Number(s.valor) || 0);
  const pctOfContract = m.valorActual ? (sv / m.valorActual) * 100 : 0;
  const company = Store.get('companies', c.companyId);

  // Estadísticas KPI
  const totalSubs = subcontracts.length;
  const activosSubs = subcontracts.filter((s) => s.estado === 'Activo').length;
  const ejecucionPromedio = totalSubs > 0
    ? subcontracts.reduce((acc, s) => acc + (Number(s.ejecucion) || 0), 0) / totalSubs
    : 0;

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      { l: 'Número', k: 'numero' },
      { l: 'Contratista', k: 'contratista' },
      { l: 'NIT', k: 'nit' },
      { l: 'Objeto', k: 'objeto' },
      { l: 'Valor', k: 'valor', r: (r: any) => money(r.valor) },
      { l: 'Inicio', k: 'fechaInicio', r: (r: any) => fdate(r.fechaInicio) },
      { l: 'Terminación', k: 'fechaFin', r: (r: any) => fdate(r.fechaFin) },
      { l: '% Ejecución', k: 'ejecucion', r: (r: any) => pct(r.ejecucion) },
      { l: 'Estado', k: 'estado' },
      { l: 'Responsable', k: 'responsable' }
    ];
    exportRows('Subcontratos - ' + c.numero, cols, subcontracts, format);
  };

  const handleDelete = async (s: Subcontract) => {
    if (!AuthService.guard('editar')) return;
    const ok = await confirmAction(`¿Está seguro de eliminar el subcontrato ${s.numero} (${s.contratista})? Esta acción no se puede deshacer.`);
    if (!ok) return;

    const db = Store.getDB();
    db.subcontracts = (db.subcontracts || []).filter((item) => item.id !== s.id);
    Store.persist();
    Audit.log({
      contractId: cid,
      modulo: 'Subcontratos',
      accion: 'Eliminación',
      campo: 'Subcontrato ' + s.numero,
      anterior: `${s.contratista} · ${money(s.valor)}`
    });
    notify(`Subcontrato ${s.numero} eliminado`);
  };

  return (
    <div className="ws-tab-pane">
      {/* Encabezado */}
      <SectionHeader as="h3"
        icon="diagram-project"
        title="Estructura de subcontratación y delegación"
        description="Registro de subcontratos derivados, autorizaciones de delegación y porcentaje de tercerización."
        action={
          <div className="row-flex" style={{ gap: 8 }}>
            <div className="exp-actions">
              <Button className="btn sm" onClick={() => handleExport('xlsx')} title="Exportar a Excel" aria-label="Exportar Excel">
                <Icon name="file-excel" /> Excel
              </Button>
              <Button className="btn sm" onClick={() => handleExport('pdf')} title="Exportar a PDF" aria-label="Exportar PDF">
                <Icon name="file-pdf" /> PDF
              </Button>
              <Button className="btn sm" onClick={() => handleExport('csv')} title="Exportar a CSV" aria-label="Exportar CSV">
                <Icon name="file-csv" /> CSV
              </Button>
            </div>
            <Link className="btn sm pri" href={nuevoHref(cid, 'subcontratos')} aria-label="Crear nuevo subcontrato">
              <Icon name="plus" /> Nuevo subcontrato
            </Link>
          </div>
        }
      />

      {/* Tarjetas KPI canónicas */}
      <div className="kpis">
        <Kpi
          label="Total subcontratos"
          value={totalSubs}
          sub="Empresas delegadas"
          color="brand"
          icon="diagram-project"
        />
        <Kpi
          label="Valor subcontratado"
          value={moneyM(sv).replace(/\s/g, '\u00A0')}
          sub={money(sv).replace(/\s/g, '\u00A0')}
          color="info"
          icon="wallet"
        />
        <Kpi
          label="% del contrato principal"
          value={pct(pctOfContract)}
          sub={pctOfContract > 50 ? 'Alerta: Tercerización > 50%' : 'Nivel autorizado'}
          color={pctOfContract > 50 ? 'warn' : 'ok'}
          sem={pctOfContract > 50 ? 'warn' : 'ok'}
          icon="pie-chart"
        />
        <Kpi
          label="Subcontratos activos"
          value={activosSubs}
          sub={`${totalSubs - activosSubs} inactivos`}
          color="ok"
          sem="ok"
          icon="check-circle"
        />
        <Kpi
          label="Ejecución promedio"
          value={pct(ejecucionPromedio, 0)}
          sub="Avance de obras/servicios"
          color="info"
          icon="percent"
        />
      </div>

      {/* Árbol Jerárquico Visual */}
      <Surface className="panel overflow-hidden">
        <SectionHeader className="dt-panel-title" as="h3" icon="diagram-project" title="Cadena de contratación y delegación" />
        <div className="p-4" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
          <div className="tree">
            <ul className="space-y-2">
              <li>
                <span className="node co inline-flex items-center gap-2 p-2.5 rounded border bg-[var(--surface)] shadow-xs" style={{ borderColor: 'var(--line)' }}>
                  <Icon name="building" style={{ color: 'var(--brand)' }} />
                  <span>
                    <b className="text-[var(--ink)] block">{company?.razon || 'Empresa Contratante'}</b>
                    <span className="m text-xs text-[var(--muted)]">NIT {company?.nit || '—'} · Contratante principal</span>
                  </span>
                </span>
                <ul className="pl-6 mt-2 border-l-2 border-[var(--line)] space-y-2">
                  <li>
                    <span className="node inline-flex items-center gap-2 p-2.5 rounded border bg-[var(--surface)] shadow-xs" style={{ borderColor: 'var(--line)' }}>
                      <Icon name="file-contract" style={{ color: 'var(--brand-2)' }} />
                      <span>
                        <b className="text-[var(--ink)] block">{c.numero} · {c.contratista}</b>
                        <span className="m text-xs text-[var(--muted)]">
                          <span className="whitespace-nowrap font-medium">{moneyM(m.valorActual)}</span> · {m.estado} · {totalSubs} subcontrato(s) registrado(s)
                        </span>
                      </span>
                    </span>
                    {totalSubs > 0 && (
                      <ul className="pl-6 mt-2 border-l-2 border-[var(--line)] space-y-2">
                        {subcontracts.map((s) => (
                          <li key={s.id}>
                            <span className="node inline-flex items-center gap-2 p-2 rounded border bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors" style={{ borderColor: 'var(--line)' }}>
                              <Icon name="diagram-project" style={{ color: 'var(--brand-3)' }} />
                              <span>
                                <b className="text-[var(--ink)] text-xs block">{s.numero} · {s.contratista}</b>
                                <span className="m text-[11px] text-[var(--muted)]">
                                  <span className="whitespace-nowrap font-medium">{moneyM(s.valor)}</span> · <span className="font-medium">{s.estado}</span> · {pct(Number(s.ejecucion) || 0)} ejecutado · Vence {fdate(s.fechaFin)}
                                </span>
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                </ul>
              </li>
            </ul>
          </div>
        </div>
      </Surface>

      {/* Tabla detallada de Subcontratos */}
      <Surface className="panel">
        <SectionHeader className="dt-panel-title" as="h3" icon="list" title="Registro detallado de subcontratistas" description={<>{totalSubs} subcontrato(s)</>} />

        {subcontracts.length === 0 ? (
          <EmptyState
            title="Sin subcontratos registrados"
            description="El contrato principal no registra subcontratos ni cesiones parciales de actividades."
            action={
              <Link className="btn pri sm" href={nuevoHref(cid, 'subcontratos')}>
                <Icon name="plus" /> Registrar primer subcontrato
              </Link>
            }
          />
        ) : (
          <TableViewport className="tbl-wrap">
            <DataTable className="tbl" responsiveProfile="subcontratos" aria-label="Subcontratos vinculados al contrato">
              <thead>
                <tr>
                  <th className="nw">Número</th>
                  <th>Contratista</th>
                  <th className="nw">NIT</th>
                  <th>Objeto</th>
                  <th className="nw num">Valor</th>
                  <th className="nw">Inicio</th>
                  <th className="nw">Terminación</th>
                  <th className="nw" style={{ minWidth: '120px' }}>
                    % Ejecución
                  </th>
                  <th className="nw">Estado</th>
                  <th>Responsable</th>
                  <th className="nw text-right" style={{ width: '120px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {subcontracts.map((s) => (
                  <tr key={s.id} className="hover:bg-[var(--surface-2)] transition-colors">
                    <td className="nw">
                      <b className="text-[var(--ink)]">{s.numero}</b>
                    </td>
                    <td className="clip" style={{ maxWidth: '200px' }} title={s.contratista}>
                      <span className="font-medium text-[var(--ink)]">{s.contratista}</span>
                    </td>
                    <td className="nw text-xs font-mono text-[var(--muted)]">{s.nit}</td>
                    <td className="clip" style={{ maxWidth: '240px' }} title={s.objeto}>
                      <span className="text-xs text-[var(--ink-2)] line-clamp-1">{s.objeto}</span>
                    </td>
                    <td className="nw num font-semibold text-[var(--ink)]">{money(s.valor)}</td>
                    <td className="nw text-xs text-[var(--muted)]">{fdate(s.fechaInicio)}</td>
                    <td className="nw text-xs text-[var(--muted)]">{fdate(s.fechaFin)}</td>
                    <td className="nw">
                      <PBar value={Number(s.ejecucion) || 0} />
                    </td>
                    <td className="nw">
                      <Badge
                        text={s.estado}
                        color={
                          s.estado === 'Activo'
                            ? 'ok'
                            : s.estado === 'Suspendido'
                            ? 'warn'
                            : 'default'
                        }
                      />
                    </td>
                    <td className="text-xs text-[var(--ink-2)]">{s.responsable || '—'}</td>
                    <td className="nw text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <Link
                          className="btn ghost xs"
                          href={editarHref(cid, 'subcontratos', s.id)}
                          title="Editar subcontrato"
                          aria-label={`Editar subcontrato ${s.numero}`}
                        >
                          <Icon name="pencil" size={13} />
                        </Link>
                        <Button
                          className="btn ghost xs text-[var(--crit)] hover:bg-[var(--crit-bg)]"
                          onClick={() => handleDelete(s)}
                          title="Eliminar subcontrato"
                          aria-label={`Eliminar subcontrato ${s.numero}`}
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

      {/* Alta/edición desde vistas dedicadas: /subcontratos/nueva y /subcontratos/[id]/editar (modal cero) */}
    </div>
  );
};
