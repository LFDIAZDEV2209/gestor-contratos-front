'use client';

import { notify, confirmAction } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, EmptyState } from '../ui/Workspace';
import type { Modification, Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { fdate, diffDays } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Icon } from '../icons';
import Link from 'next/link';
import { nuevoHref } from './routes';

export const TabProrrogas = ({ cid }: { cid: string }) => {
  const c = Store.get('contracts', cid) as Contract | undefined;
  if (!c) {
    return (
      <EmptyState
        title="Contrato no encontrado"
        description="No se encontró el contrato especificado para consultar sus prórrogas."
      />
    );
  }

  const prorrogas = (Store.byContract('modifications', cid) as Modification[])
    .filter((x) => x.tipo === 'Prórroga')
    .sort((a, b) => ((a.fecha || '') < (b.fecha || '') ? 1 : -1));

  const first = prorrogas[prorrogas.length - 1];
  const originalEnd = first?.fechaAnterior || c.fechaFin;
  const totalDays = originalEnd && c.fechaFin ? diffDays(originalEnd, c.fechaFin) : 0;
  const activeProrrogas = prorrogas.filter((p) => !p.anulada);

  const handleAnular = async (p: Modification) => {
    if (!AuthService.guard('editar')) return;
    const ok = await confirmAction(
      `¿Está seguro de anular la prórroga ${p.numero}? Se restaurará la fecha de vencimiento anterior (${fdate(p.fechaAnterior)}).`
    );
    if (!ok) return;

    const before = JSON.parse(JSON.stringify(c));
    Store.update('modifications', p.id, { anulada: true });

    if (p.fechaAnterior) {
      Store.update('contracts', cid, { fechaFin: p.fechaAnterior });
      Audit.diff('Contratos', cid, before, { ...c, fechaFin: p.fechaAnterior }, {
        fechaFin: 'Reversión fecha de terminación por anulación de prórroga'
      });
    }

    notify(`Prórroga ${p.numero} anulada y fecha de terminación revertida`);
  };

  const handleDelete = async (p: Modification) => {
    if (!AuthService.guard('editar')) return;
    const ok = await confirmAction(`¿Desea eliminar definitivamente el registro de la prórroga ${p.numero}?`);
    if (!ok) return;

    const db = Store.getDB();
    db.modifications = (db.modifications || []).filter((item) => item.id !== p.id);
    Store.persist();
    Audit.log({
      contractId: cid,
      modulo: 'Prórrogas',
      accion: 'Eliminación',
      campo: 'Prórroga ' + p.numero,
      anterior: fdate(p.fechaNueva)
    });
    notify(`Prórroga ${p.numero} eliminada`);
  };

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      { l: 'Número', k: 'numero' },
      { l: 'Fecha trámite', k: 'fecha', r: (r: any) => fdate(r.fecha) },
      { l: 'Término anterior', k: 'fechaAnterior', r: (r: any) => fdate(r.fechaAnterior) },
      { l: 'Nuevo término', k: 'fechaNueva', r: (r: any) => fdate(r.fechaNueva) },
      { l: 'Días prorrogados', k: 'dias', r: (r: any) => diffDays(r.fechaAnterior, r.fechaNueva) },
      { l: 'Justificación', k: 'justificacion' },
      { l: 'Estado', k: 'anulada', r: (r: any) => (r.anulada ? 'Anulada' : 'Vigente') }
    ];
    exportRows('Prorrogas - ' + c.numero, cols, prorrogas, format);
  };

  return (
    <div className="tab-prorrogas-container">
      {/* Encabezado */}
      <div className="panel-h mb-3 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-[var(--ink)]">Prórrogas y ampliaciones de plazo</h3>
          <span className="sub text-xs text-[var(--muted)]">
            Control cronológico de adiciones en tiempo sobre el plazo contractual pactado
          </span>
        </div>
        <div className="row-flex">
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
          <Link className="btn sm pri" href={nuevoHref(cid, 'prorrogas')} aria-label="Crear prórroga">
            <Icon name="calendar-plus" /> Crear prórroga
          </Link>
        </div>
      </div>

      {/* KPI Cards con datos del plazo */}
      <div className="kpis mb [&_.kpi]:!p-2 sm:[&_.kpi]:!p-[14px_16px] [&_.kpi-ic]:!w-7 [&_.kpi-ic]:!h-7 sm:[&_.kpi-ic]:!w-[34px] sm:[&_.kpi-ic]:!h-[34px] [&_.kpi.kpi-v2]:!gap-2 sm:[&_.kpi.kpi-v2]:!gap-3 [&_.kpi-v]:!whitespace-nowrap [&_.kpi-v]:!text-[13.5px] sm:[&_.kpi-v]:!text-[23px] [&_.kpi-s]:!whitespace-nowrap [&_.kpi-s]:!text-[9.5px] sm:[&_.kpi-s]:!text-[11.5px]">
        <Kpi
          label="Total prórrogas"
          value={prorrogas.length}
          sub={`${activeProrrogas.length} vigentes · ${prorrogas.length - activeProrrogas.length} anuladas`}
          color="brand"
          icon="calendar-plus"
        />
        <Kpi
          label="Plazo inicial pactado"
          value={fdate(originalEnd)}
          sub="Vencimiento sin otrosíes"
          color="na"
          icon="calendar"
        />
        <Kpi
          label="Vencimiento contractual actual"
          value={fdate(c.fechaFin)}
          sub={c.estado}
          color="info"
          icon="clock"
        />
        <Kpi
          label="Días totales prorrogados"
          value={`+${Math.max(0, totalDays)} días`}
          sub={totalDays > 0 ? `${Math.round(totalDays / 30)} mes(es) adicional(es)` : 'Sin adición de tiempo'}
          color={totalDays > 0 ? 'warn' : 'ok'}
          icon="plus-circle"
        />
      </div>

      {/* Tabla detallada de Prórrogas */}
      <Surface className="panel">
        <div className="panel-h flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Historial de prórrogas suscritas</h3>
            <span className="sub text-xs text-[var(--muted)]">{prorrogas.length} registro(s)</span>
          </div>
        </div>

        {prorrogas.length === 0 ? (
          <EmptyState
            title="El contrato no registra prórrogas"
            description="El plazo de ejecución se mantiene según la fecha de terminación estipulada originalmente."
            action={
              <Link className="btn pri sm" href={nuevoHref(cid, 'prorrogas')}>
                <Icon name="calendar-plus" /> Crear primera prórroga
              </Link>
            }
          />
        ) : (
          <TableViewport className="tbl-wrap">
            <DataTable className="tbl">
              <thead>
                <tr>
                  <th className="nw">Número Otrosí</th>
                  <th className="nw">Fecha trámite</th>
                  <th className="nw">Término anterior</th>
                  <th className="nw">Nuevo término</th>
                  <th className="nw">Días adicionales</th>
                  <th>Justificación técnica</th>
                  <th className="nw">Soporte</th>
                  <th className="nw text-right" style={{ width: '110px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {prorrogas.map((p) => {
                  const days = diffDays(p.fechaAnterior, p.fechaNueva);
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-[var(--surface-2)] transition-colors ${p.anulada ? 'opacity-60 line-through' : ''}`}
                    >
                      <td className="nw">
                        <b className="text-[var(--ink)]">{p.numero}</b>
                        {p.anulada && (
                          <span className="ml-2 badge b-crit text-[10px]">ANULADA</span>
                        )}
                      </td>
                      <td className="nw text-xs text-[var(--muted)]">{fdate(p.fecha)}</td>
                      <td className="nw text-xs text-[var(--muted)]">{fdate(p.fechaAnterior)}</td>
                      <td className="nw">
                        <b className="text-xs text-[var(--ink)]">{fdate(p.fechaNueva)}</b>
                      </td>
                      <td className="nw">
                        <Badge
                          text={`+${days} días`}
                          color={p.anulada ? 'na' : 'brand'}
                        />
                      </td>
                      <td className="clip" style={{ maxWidth: '350px' }} title={p.justificacion}>
                        <span className="text-xs text-[var(--ink)]">{p.justificacion}</span>
                      </td>
                      <td className="nw">
                        {p.soporte ? (
                          <span className="link inline-flex items-center gap-1 text-xs" title="Ver documento adjunto">
                            <Icon name="paperclip" size={12} /> {p.soporte}
                          </span>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="nw text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          {!p.anulada && (
                            <Button
                              className="btn ghost xs text-[var(--warn-text)] hover:bg-[var(--warn-bg)]"
                              onClick={() => handleAnular(p)}
                              title="Anular prórroga"
                              aria-label={`Anular prórroga ${p.numero}`}
                            >
                              <Icon name="ban" size={13} />
                            </Button>
                          )}
                          <Button
                            className="btn ghost xs text-[var(--crit)] hover:bg-[var(--crit-bg)]"
                            onClick={() => handleDelete(p)}
                            title="Eliminar prórroga"
                            aria-label={`Eliminar prórroga ${p.numero}`}
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

      {/* Aviso normativo: prórroga desde vista dedicada /contrato/[id]/prorrogas/nueva (modal cero) */}
    </div>
  );
};
