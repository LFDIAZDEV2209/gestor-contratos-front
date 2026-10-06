'use client';

import { notify, confirmAction } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, EmptyState } from '../ui/Workspace';
import type { Modification, Acta, Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { fdate, diffDays } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Icon } from '../icons';
import Link from 'next/link';
import { nuevoHref } from './routes';
import { SectionHeader } from '../ui/SectionHeader';

export const TabSuspensiones = ({ cid }: { cid: string }) => {
  const c = Store.get('contracts', cid) as Contract | undefined;
  if (!c) {
    return (
      <EmptyState
        title="Contrato no encontrado"
        description="No se encontró el contrato especificado para consultar suspensiones."
      />
    );
  }

  const isSuspended = c.estado === 'Suspendido';

  const modSusp = (Store.byContract('modifications', cid) as Modification[])
    .filter((x) => x.tipo === 'Suspensión' || x.tipo === 'Reinicio')
    .sort((a, b) => ((a.fecha || '') < (b.fecha || '') ? 1 : -1));

  const actasSusp = (Store.byContract('actas', cid) as Acta[])
    .filter((a) => /suspensión|reinicio/i.test(a.tipo || ''))
    .sort((a, b) => ((a.fecha || '') < (b.fecha || '') ? 1 : -1));

  // Cálculo de suspensiones
  const totalSusp = modSusp.filter((m) => m.tipo === 'Suspensión' && !m.anulada).length;
  const totalRein = modSusp.filter((m) => m.tipo === 'Reinicio' && !m.anulada).length;

  let totalDiasSusp = 0;
  for (let i = 0; i < modSusp.length; i++) {
    if (modSusp[i].tipo === 'Reinicio' && modSusp[i].fechaAnterior && modSusp[i].fechaNueva) {
      totalDiasSusp += Math.max(0, diffDays(modSusp[i].fechaAnterior, modSusp[i].fechaNueva));
    }
  }

  const handleAnular = async (item: Modification) => {
    if (!AuthService.guard('editar')) return;
    const ok = await confirmAction(
      `¿Está seguro de anular el registro de ${item.tipo} ${item.numero}? Se recalculará el estado del contrato.`
    );
    if (!ok) return;

    Store.update('modifications', item.id, { anulada: true });

    if (item.tipo === 'Suspensión') {
      Store.update('contracts', cid, { estado: 'Activo' });
    } else if (item.tipo === 'Reinicio' && item.fechaAnterior) {
      Store.update('contracts', cid, { fechaFin: item.fechaAnterior });
    }

    Audit.log({
      contractId: cid,
      modulo: 'Suspensiones',
      accion: 'Anulación',
      campo: 'Actuación ' + item.numero,
      anterior: 'Vigente',
      nuevo: 'Anulada'
    });

    notify(`Registro de ${item.tipo} anulado correctamente`);
  };

  const handleDelete = async (item: Modification) => {
    if (!AuthService.guard('editar')) return;
    const ok = await confirmAction(`¿Desea eliminar definitivamente el registro ${item.numero}?`);
    if (!ok) return;

    const db = Store.getDB();
    db.modifications = (db.modifications || []).filter((m) => m.id !== item.id);
    Store.persist();
    Audit.log({
      contractId: cid,
      modulo: 'Suspensiones',
      accion: 'Eliminación',
      campo: 'Actuación ' + item.numero,
      anterior: item.tipo
    });
    notify(`Registro ${item.numero} eliminado`);
  };

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      { l: 'Número', k: 'numero' },
      { l: 'Tipo', k: 'tipo' },
      { l: 'Fecha', k: 'fecha', r: (r: any) => fdate(r.fecha) },
      { l: 'Justificación', k: 'justificacion' },
      { l: 'Fecha nueva fin', k: 'fechaNueva', r: (r: any) => (r.fechaNueva ? fdate(r.fechaNueva) : '—') },
      { l: 'Estado', k: 'anulada', r: (r: any) => (r.anulada ? 'Anulada' : 'Vigente') }
    ];
    exportRows('Suspensiones - ' + c.numero, cols, modSusp, format);
  };

  return (
    <div className="ws-tab-pane">
      {/* Encabezado */}
      <SectionHeader as="h3"
        icon="pause"
        title="Suspensiones y reinicios de ejecución"
        description={
          isSuspended
            ? 'Contrato actualmente en suspensión de ejecución · Plazo formal detenido.'
            : 'Ejecución activa normal del contrato · Historial de eventos y actas.'
        }
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
            {isSuspended ? (
              <Link
                className="btn sm btn-ok pri"
                href={nuevoHref(cid, 'reinicios')}
                aria-label="Registrar reinicio"
              >
                <Icon name="play" /> Registrar reinicio
              </Link>
            ) : (
              <Link
                className="btn sm btn-warn pri"
                href={nuevoHref(cid, 'suspensiones')}
                aria-label="Registrar suspensión"
              >
                <Icon name="pause" /> Registrar suspensión
              </Link>
            )}
          </div>
        }
      />

      {/* KPI Cards canónicas */}
      <div className="kpis">
        <Kpi
          label="Estado de ejecución"
          value={c.estado}
          sub={isSuspended ? 'Plazo temporalmente detenido' : 'Ejecución en curso'}
          color={isSuspended ? 'warn' : 'ok'}
          sem={isSuspended ? 'warn' : 'ok'}
          icon={isSuspended ? 'pause' : 'play'}
        />
        <Kpi
          label="Suspensiones suscritas"
          value={totalSusp}
          sub="Actas de suspensión"
          color={totalSusp > 0 ? 'warn' : 'na'}
          icon="pause-circle"
        />
        <Kpi
          label="Reinicios formalizados"
          value={totalRein}
          sub="Actas de reinicio"
          color="ok"
          icon="play-circle"
        />
        <Kpi
          label="Días compensados"
          value={`+${totalDiasSusp} días`}
          sub="Tiempo compensado"
          color={totalDiasSusp > 0 ? 'info' : 'na'}
          icon="clock"
        />
      </div>

      {/* Tabla detallada de Modificaciones de suspensión/reinicio */}
      <Surface className="panel mb-4">
        <SectionHeader className="dt-panel-title" as="h3" icon="pause-circle" title="Registro de actos de suspensión y reinicio" description={<>{modSusp.length} evento(s)</>} />

        {modSusp.length === 0 ? (
          <EmptyState
            title="Sin suspensiones ni reinicios"
            description="El contrato se ha ejecutado de manera continua sin interrupciones formales."
            action={
              <Link className="btn pri sm" href={nuevoHref(cid, 'suspensiones')}>
                <Icon name="pause" /> Registrar suspensión
              </Link>
            }
          />
        ) : (
          <TableViewport className="tbl-wrap">
            <DataTable className="tbl" aria-label="Actas y eventos de suspensión del contrato">
              <thead>
                <tr>
                  <th className="nw">Número</th>
                  <th>Tipo</th>
                  <th className="nw">Fecha acta</th>
                  <th>Justificación / Hechos</th>
                  <th className="nw">Término resultante</th>
                  <th className="nw">Soporte</th>
                  <th className="nw text-right" style={{ width: '110px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {modSusp.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-[var(--surface-2)] transition-colors ${item.anulada ? 'opacity-60 line-through' : ''}`}
                  >
                    <td className="nw">
                      <b className="text-[var(--ink)]">{item.numero}</b>
                      {item.anulada && (
                        <span className="ml-2 badge b-crit text-[10px]">ANULADA</span>
                      )}
                    </td>
                    <td>
                      <Badge
                        text={item.tipo}
                        color={item.anulada ? 'na' : item.tipo === 'Suspensión' ? 'warn' : 'ok'}
                      />
                    </td>
                    <td className="nw text-xs text-[var(--muted)]">{fdate(item.fecha)}</td>
                    <td className="clip" style={{ maxWidth: '380px' }} title={item.justificacion}>
                      <span className="text-xs text-[var(--ink)]">{item.justificacion}</span>
                    </td>
                    <td className="nw font-medium text-xs">
                      {item.fechaNueva ? fdate(item.fechaNueva) : <span className="text-[var(--muted)]">—</span>}
                    </td>
                    <td className="nw">
                      {item.soporte ? (
                        <span className="link inline-flex items-center gap-1 text-xs" title="Ver documento adjunto">
                          <Icon name="paperclip" size={12} /> {item.soporte}
                        </span>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="nw text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        {!item.anulada && (
                          <Button
                            className="btn ghost xs text-[var(--warn-text)] hover:bg-[var(--warn-bg)]"
                            onClick={() => handleAnular(item)}
                            title={`Anular ${item.tipo}`}
                            aria-label={`Anular ${item.tipo} ${item.numero}`}
                          >
                            <Icon name="ban" size={13} />
                          </Button>
                        )}
                        <Button
                          className="btn ghost xs text-[var(--crit)] hover:bg-[var(--crit-bg)]"
                          onClick={() => handleDelete(item)}
                          title="Eliminar registro"
                          aria-label={`Eliminar registro ${item.numero}`}
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

      {/* Actas asociadas de suspensión y reinicio */}
      <Surface className="panel">
        <SectionHeader className="dt-panel-title" as="h3" icon="file-text" title="Actas bilaterales formalizadas" description={<>{actasSusp.length} acta(s) radicada(s)</>} />

        {actasSusp.length === 0 ? (
          <EmptyState
            title="Sin actas de suspensión o reinicio"
            description="No se encuentran actas suscritas en el repositorio de documentos."
          />
        ) : (
          <TableViewport className="tbl-wrap">
            <DataTable className="tbl" aria-label="Actas suscritas de suspensión o reinicio">
              <thead>
                <tr>
                  <th className="nw">Número acta</th>
                  <th>Tipo de acta</th>
                  <th className="nw">Fecha suscripción</th>
                  <th>Descripción del motivo</th>
                  <th>Firmantes registrados</th>
                  <th className="nw">Archivo</th>
                </tr>
              </thead>
              <tbody>
                {actasSusp.map((a) => (
                  <tr key={a.id} className="hover:bg-[var(--surface-2)] transition-colors">
                    <td className="nw font-bold text-[var(--ink)]">{a.numero}</td>
                    <td className="nw">
                      <Badge
                        text={a.tipo}
                        color={/suspensión/i.test(a.tipo) ? 'warn' : 'ok'}
                      />
                    </td>
                    <td className="nw text-xs text-[var(--muted)]">{fdate(a.fecha)}</td>
                    <td className="clip text-xs text-[var(--ink)]" style={{ maxWidth: '300px' }} title={a.descripcion}>
                      {a.descripcion}
                    </td>
                    <td className="text-xs text-[var(--ink-2)]">{a.firmantes || '—'}</td>
                    <td className="nw">
                      {a.archivo ? (
                        <span className="link inline-flex items-center gap-1 text-xs">
                          <Icon name="paperclip" size={12} /> {a.archivo}
                        </span>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableViewport>
        )}
      </Surface>

      {/* Actuaciones desde vistas dedicadas: /suspensiones/nueva y /reinicios/nueva (modal cero) */}
    </div>
  );
};
