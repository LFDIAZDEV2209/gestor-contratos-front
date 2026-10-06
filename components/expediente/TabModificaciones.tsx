'use client';

import { useState } from 'react';
import { notify, confirmAction } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, EmptyState } from '../ui/Workspace';
import type { Modification, Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { M } from '../../lib/metrics';
import { money, moneyM, fdate, diffDays, todayIso, uid } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Icon } from '../icons';
import Link from 'next/link';
import { nuevoHref } from './routes';
import { SectionHeader } from '../ui/SectionHeader';

export const TabModificaciones = ({ cid }: { cid: string }) => {
  const c = Store.get('contracts', cid) as Contract | undefined;
  if (!c) {
    return (
      <EmptyState
        title="Contrato no encontrado"
        description="No se encontró el contrato especificado para consultar sus modificaciones."
      />
    );
  }

  const m = M(c);
  const modifications = (Store.byContract('modifications', cid) as Modification[]).sort((a, b) =>
    (a.fecha || '') < (b.fecha || '') ? 1 : -1
  );

  const totalAdiciones = modifications
    .filter((x) => x.tipo === 'Adición' && !x.anulada)
    .reduce((acc, curr) => acc + (Number(curr.valorNuevo) - Number(curr.valorAnterior || 0)), 0);

  const totalReducciones = modifications
    .filter((x) => x.tipo === 'Reducción' && !x.anulada)
    .reduce((acc, curr) => acc + (Number(curr.valorAnterior || 0) - Number(curr.valorNuevo)), 0);

  const prorrogas = modifications.filter((x) => x.tipo === 'Prórroga' && !x.anulada);

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      { l: 'Número', k: 'numero' },
      { l: 'Tipo', k: 'tipo' },
      { l: 'Fecha', k: 'fecha', r: (r: any) => fdate(r.fecha) },
      { l: 'Justificación', k: 'justificacion' },
      { l: 'Valor nuevo', k: 'valorNuevo', r: (r: any) => (r.valorNuevo ? money(r.valorNuevo) : '—') },
      { l: 'Fecha nueva', k: 'fechaNueva', r: (r: any) => (r.fechaNueva ? fdate(r.fechaNueva) : '—') },
      { l: 'Nuevo valor/texto', k: 'nuevoTexto' },
      { l: 'Estado', k: 'anulada', r: (r: any) => (r.anulada ? 'Anulada' : 'Vigente') }
    ];
    exportRows('Modificaciones - ' + c.numero, cols, modifications, format);
  };

  const handleAnular = async (mItem: Modification) => {
    if (!AuthService.guard('editar')) return;
    const ok = await confirmAction(
      `¿Está seguro de anular la modificación ${mItem.numero} (${mItem.tipo})? Esta acción revertirá los impactos aplicados al contrato.`
    );
    if (!ok) return;

    const before = JSON.parse(JSON.stringify(c));
    const patch: Partial<Contract> = {};

    // Revertir efectos en el contrato
    if (mItem.tipo === 'Adición' && mItem.valorNuevo && mItem.valorAnterior) {
      const added = Number(mItem.valorNuevo) - Number(mItem.valorAnterior);
      patch.adiciones = Math.max(0, (Number(c.adiciones) || 0) - added);
    } else if (mItem.tipo === 'Reducción' && mItem.valorNuevo && mItem.valorAnterior) {
      const reduced = Number(mItem.valorAnterior) - Number(mItem.valorNuevo);
      patch.reducciones = Math.max(0, (Number(c.reducciones) || 0) - reduced);
    } else if (mItem.tipo === 'Prórroga' && mItem.fechaAnterior) {
      patch.fechaFin = mItem.fechaAnterior;
    } else if (mItem.tipo === 'Suspensión') {
      patch.estado = 'Activo';
    }

    Store.update('modifications', mItem.id, { anulada: true });
    if (Object.keys(patch).length > 0) {
      Store.update('contracts', cid, patch);
      Audit.diff('Modificaciones', cid, before, { ...c, ...patch }, {
        adiciones: 'Reversión adición por anulación',
        reducciones: 'Reversión reducción por anulación',
        fechaFin: 'Reversión fecha fin por anulación',
        estado: 'Reversión estado por anulación'
      });
    }

    Audit.log({
      contractId: cid,
      modulo: 'Modificaciones',
      accion: 'Anulación',
      campo: 'Modificación ' + mItem.numero,
      anterior: 'Vigente',
      nuevo: 'Anulada'
    });

    notify(`Modificación ${mItem.numero} anulada y contrato actualizado`);
  };

  const handleDelete = async (mItem: Modification) => {
    if (!AuthService.guard('editar')) return;
    const ok = await confirmAction(
      `¿Desea eliminar definitivamente el registro de la modificación ${mItem.numero}?`
    );
    if (!ok) return;

    const db = Store.getDB();
    db.modifications = (db.modifications || []).filter((item) => item.id !== mItem.id);
    Store.persist();
    Audit.log({
      contractId: cid,
      modulo: 'Modificaciones',
      accion: 'Eliminación',
      campo: 'Modificación ' + mItem.numero,
      anterior: mItem.tipo
    });
    notify(`Modificación ${mItem.numero} eliminada`);
  };

  return (
    <div className="ws-tab-pane">
      {/* Encabezado */}
      <SectionHeader as="h3"
        icon="file-signature"
        title="Modificaciones y otrosíes contractuales"
        description="Adiciones presupuestales, prórrogas de plazo, suspensiones, cesiones y modificaciones de cláusulas."
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
            <Link className="btn sm pri" href={nuevoHref(cid, 'modificaciones')} aria-label="Registrar nueva modificación">
              <Icon name="plus" /> Nueva modificación
            </Link>
          </div>
        }
      />

      {/* Tarjetas KPI canónicas */}
      <div className="kpis">
        <Kpi
          label="Total modificaciones"
          value={modifications.length}
          sub={`${modifications.filter((m) => m.anulada).length} anulada(s)`}
          color="brand"
          icon="file-signature"
        />
        <Kpi
          label="Total adiciones"
          value={moneyM(totalAdiciones || Number(c.adiciones) || 0).replace(/\s/g, '\u00A0')}
          sub={money(totalAdiciones || Number(c.adiciones) || 0).replace(/\s/g, '\u00A0')}
          color={totalAdiciones > 0 ? 'ok' : 'na'}
          icon="plus-circle"
        />
        <Kpi
          label="Total reducciones"
          value={moneyM(totalReducciones || Number(c.reducciones) || 0).replace(/\s/g, '\u00A0')}
          sub={money(totalReducciones || Number(c.reducciones) || 0).replace(/\s/g, '\u00A0')}
          color={totalReducciones > 0 ? 'risk' : 'na'}
          icon="minus-circle"
        />
        <Kpi
          label="Prórrogas de plazo"
          value={prorrogas.length}
          sub={
            prorrogas.length > 0 && prorrogas[0].fechaAnterior
              ? `+${diffDays(prorrogas[0].fechaAnterior, c.fechaFin)} días acumulados`
              : 'Sin prórrogas'
          }
          color={prorrogas.length > 0 ? 'info' : 'na'}
          icon="calendar-plus"
        />
      </div>

      {/* Aviso normativo permanente de garantías */}
      <div className="ws-t-banner warn" role="status">
        <Icon name="triangle-exclamation" />
        <span className="flex-1 font-medium">
          Al aplicar una adición, prórroga o reinicio revisa el valor asegurado y la vigencia de las pólizas
          suscritas (puede exigir otrosí en las garantías).
        </span>
      </div>

      {/* Tabla detallada de Modificaciones */}
      <Surface className="panel">
        <SectionHeader className="dt-panel-title" as="h3" icon="file-text" title="Historial de actos modificatorios" description={<>{modifications.length} modificación(es)</>} />

        {modifications.length === 0 ? (
          <EmptyState
            title="Sin modificaciones registradas"
            description="El contrato se mantiene con las condiciones y plazos pactados inicialmente."
            action={
              <Link className="btn pri sm" href={nuevoHref(cid, 'modificaciones')}>
                <Icon name="plus" /> Registrar primer otrosí o modificación
              </Link>
            }
          />
        ) : (
          <TableViewport className="tbl-wrap">
            <DataTable className="tbl" responsiveProfile="modificaciones" aria-label="Historial de actos modificatorios">
              <thead>
                <tr>
                  <th className="nw">Número</th>
                  <th>Tipo</th>
                  <th className="nw">Fecha trámite</th>
                  <th>Justificación / Impacto</th>
                  <th className="nw">Impacto económico</th>
                  <th className="nw">Impacto plazo</th>
                  <th>Detalle / Sujeto</th>
                  <th className="nw">Soporte</th>
                  <th className="nw text-right" style={{ width: '110px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {modifications.map((mItem) => {
                  const diffVal =
                    mItem.valorNuevo && mItem.valorAnterior
                      ? Number(mItem.valorNuevo) - Number(mItem.valorAnterior)
                      : null;
                  const daysExt =
                    mItem.fechaNueva && mItem.fechaAnterior
                      ? diffDays(mItem.fechaAnterior, mItem.fechaNueva)
                      : null;
                  return (
                    <tr
                      key={mItem.id}
                      className={`hover:bg-[var(--surface-2)] transition-colors ${mItem.anulada ? 'opacity-60 line-through' : ''}`}
                    >
                      <td className="nw">
                        <b className="text-[var(--ink)]">{mItem.numero}</b>
                        {mItem.anulada && (
                          <span className="ml-2 badge b-crit text-[10px]">ANULADA</span>
                        )}
                      </td>
                      <td className="nw">
                        <Badge
                          text={mItem.tipo}
                          color={
                            mItem.anulada
                              ? 'na'
                              : mItem.tipo === 'Adición'
                              ? 'ok'
                              : mItem.tipo === 'Reducción'
                              ? 'warn'
                              : mItem.tipo === 'Suspensión'
                              ? 'crit'
                              : mItem.tipo === 'Reinicio'
                              ? 'brand'
                              : 'info'
                          }
                        />
                      </td>
                      <td className="nw text-xs text-[var(--muted)]">{fdate(mItem.fecha)}</td>
                      <td className="clip" style={{ maxWidth: '300px' }} title={mItem.justificacion}>
                        <span className="text-xs text-[var(--ink)]">{mItem.justificacion}</span>
                        {mItem.impacto && <div className="small text-[var(--muted)]">{mItem.impacto}</div>}
                      </td>
                      <td className="nw">
                        {mItem.valorNuevo ? (
                          <div>
                            <div className="font-semibold text-xs text-[var(--ink)]">{money(mItem.valorNuevo)}</div>
                            {diffVal != null && (
                              <div
                                className="small font-medium"
                                style={{ color: diffVal > 0 ? 'var(--ok-text)' : 'var(--crit-text)' }}
                              >
                                {diffVal > 0 ? '+' : ''}
                                {money(diffVal)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="nw">
                        {mItem.fechaNueva ? (
                          <div>
                            <div className="font-medium text-xs text-[var(--ink)]">{fdate(mItem.fechaNueva)}</div>
                            {daysExt != null && daysExt !== 0 && (
                              <div className="small text-[var(--muted)] font-mono">+{daysExt} días</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="clip text-xs text-[var(--ink-2)]" style={{ maxWidth: '180px' }}>
                        {mItem.nuevoTexto || '—'}
                      </td>
                      <td className="nw">
                        {mItem.soporte ? (
                          <span className="link inline-flex items-center gap-1 text-xs" title="Ver documento adjunto">
                            <Icon name="paperclip" size={12} /> {mItem.soporte}
                          </span>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="nw text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          {!mItem.anulada && (
                            <Button
                              className="btn ghost xs text-[var(--warn-text)] hover:bg-[var(--warn-bg)]"
                              onClick={() => handleAnular(mItem)}
                              title="Anular modificación"
                              aria-label={`Anular modificación ${mItem.numero}`}
                            >
                              <Icon name="ban" size={13} />
                            </Button>
                          )}
                          <Button
                            className="btn ghost xs text-[var(--crit)] hover:bg-[var(--crit-bg)]"
                            onClick={() => handleDelete(mItem)}
                            title="Eliminar modificación"
                            aria-label={`Eliminar modificación ${mItem.numero}`}
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
    </div>
  );
};
