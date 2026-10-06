'use client';
import Link from 'next/link';
import { notify, requestReason } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, EmptyState } from '../ui/Workspace';
import { useState } from 'react';
import type { Acta } from '../../lib/types';
import { Store, AuthService } from '../../lib/store';
import { fdate } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Icon } from '../icons';
import { nuevoHref } from './routes';

import { SectionHeader } from '../ui/SectionHeader';
import { Kpi } from '../ui/Kpi';

export const TabActas = ({ cid }: { cid: string }) => {
  const [filterTipo, setFilterTipo] = useState('');

  const c = Store.get('contracts', cid);
  if (!c) return <div className="empty">Contrato no encontrado</div>;

  const actas = (Store.byContract('actas', cid) as Acta[]).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const tipos = Array.from(new Set(actas.map((a) => a.tipo)));

  const firmadas = actas.filter((a) => a.estado === 'Firmada').length;
  const enFirmas = actas.filter((a) => a.estado === 'En firmas').length;
  const anuladas = actas.filter((a) => a.estado === 'Anulada').length;

  const filtered = filterTipo ? actas.filter((a) => a.tipo === filterTipo) : actas;

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      { l: 'Número', k: 'numero' },
      { l: 'Tipo', k: 'tipo' },
      { l: 'Fecha', k: 'fecha', r: (r: any) => fdate(r.fecha) },
      { l: 'Descripción', k: 'descripcion' },
      { l: 'Firmantes', k: 'firmantes' },
      { l: 'Estado', k: 'estado' }
    ];
    exportRows('Actas - ' + c.numero, cols, filtered, format);
  };

  /* Anulación con motivo obligatorio (files/08): pide permiso ANULAR y el motivo queda en auditoría. */
  const handleAnular = async (acta: Acta) => {
    if (!AuthService.guard('anular')) return;
    const mot = await requestReason(`Motivo de anulación del acta ${acta.numero}:`, `Error en la radicación del acta ${acta.numero}`);
    if (!mot) return;

    Store.anular('actas', acta.id, mot);
    notify(`Acta ${acta.numero} anulada`);
  };

  return (
    <div className="ws-tab-pane">
      <SectionHeader as="h3"
        icon="file-signature"
        title="Actas suscritas del contrato"
        description={`${actas.length} acta(s) registrada(s) · Inicio, avance, suspensión, reinicio y liquidación.`}
        action={
          <div className="row-flex" style={{ gap: 8 }}>
            <div className="exp-actions">
              <Button className="btn sm" onClick={() => handleExport('xlsx')} title="Exportar a Excel" aria-label="Exportar a Excel">
                <Icon name="file-excel" /> Excel
              </Button>
              <Button className="btn sm" onClick={() => handleExport('pdf')} title="Exportar a PDF" aria-label="Exportar a PDF">
                <Icon name="file-pdf" /> PDF
              </Button>
              <Button className="btn sm" onClick={() => handleExport('csv')} title="Exportar a CSV" aria-label="Exportar a CSV">
                <Icon name="file-csv" /> CSV
              </Button>
            </div>
            <Link className="btn sm pri" href={nuevoHref(cid, 'actas')} aria-label="Registrar nueva acta">
              <Icon name="plus" /> Nueva acta
            </Link>
          </div>
        }
      />

      <div className="kpis">
        <Kpi
          label="Total actas"
          value={actas.length}
          sub="Expediente formal"
          color="brand"
          icon="file-signature"
        />
        <Kpi
          label="Actas firmadas"
          value={firmadas}
          sub="Formalizadas"
          color="ok"
          sem="ok"
          icon="check-circle"
        />
        <Kpi
          label="En trámite de firmas"
          value={enFirmas}
          sub="Pendientes de suscripción"
          color={enFirmas > 0 ? 'warn' : 'ok'}
          sem={enFirmas > 0 ? 'warn' : 'ok'}
          icon="clock"
        />
        <Kpi
          label="Actas anuladas"
          value={anuladas}
          sub="Conservadas en auditoría"
          color="na"
          icon="ban"
        />
      </div>

      {tipos.length > 0 && (
        <div className="ws-t-filters">
          <Button
            className={`btn sm ${filterTipo === '' ? 'pri' : 'ghost'}`}
            onClick={() => setFilterTipo('')}
            aria-pressed={filterTipo === ''}
          >
            Todas ({actas.length})
          </Button>
          {tipos.map((t) => (
            <Button
              key={t}
              className={`btn sm ${filterTipo === t ? 'pri' : 'ghost'}`}
              onClick={() => setFilterTipo(t)}
              aria-pressed={filterTipo === t}
            >
              {t} ({actas.filter((a) => a.tipo === t).length})
            </Button>
          ))}
        </div>
      )}

      <Surface className="panel">
        <TableViewport className="tbl-wrap">
        <DataTable className="tbl" aria-label="Actas suscritas del contrato">
          <thead>
            <tr>
              <th className="nw">Número</th>
              <th>Tipo</th>
              <th className="nw">Fecha</th>
              <th>Descripción</th>
              <th>Firmantes</th>
              <th className="nw">Estado</th>
              <th className="nw">Soporte</th>
              <th className="nw">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const isVoid = a.estado === 'Anulada';
              return (
                <tr key={a.id} className={isVoid ? 'void' : ''}>
                  <td className="nw mono">
                    <b>{a.numero}</b>
                  </td>
                  <td>{a.tipo}</td>
                  <td className="nw">{fdate(a.fecha)}</td>
                  <td className="clip" style={{ maxWidth: '280px' }} title={a.descripcion}>
                    {a.descripcion || '—'}
                  </td>
                  <td className="clip" style={{ maxWidth: '200px' }} title={a.firmantes}>
                    {a.firmantes || '—'}
                  </td>
                  <td className="nw">
                    <Badge
                      text={a.estado}
                      color={
                        a.estado === 'Firmada'
                          ? 'ok'
                          : a.estado === 'En firmas'
                          ? 'warn'
                          : a.estado === 'Anulada'
                          ? 'na'
                          : 'default'
                      }
                    />
                  </td>
                  <td className="nw">
                    {a.archivo ? (
                      <span className="link" title="Ver documento soporte">
                        <Icon name="file-text" /> {a.archivo}
                      </span>
                    ) : (
                      <span className="badge b-crit">Sin soporte</span>
                    )}
                  </td>
                  <td className="nw">
                    {!isVoid && (
                      <Button
                        className="icon-btn"
                        onClick={() => handleAnular(a)}
                        title="Anular acta (conserva el historial)"
                        aria-label={`Anular acta ${a.numero}`}
                        style={{ color: 'var(--crit)' }}
                      >
                        <Icon name="circle-xmark" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="empty">
                  {filterTipo ? 'No hay actas de ese tipo.' : 'El contrato no registra actas.'}
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </TableViewport>

      {actas.length === 0 && (
        <EmptyState
          title="Sin actas registradas"
          description="Registra el acta de inicio y las actas parciales para soportar la ejecución del contrato."
          action={
            <Link className="btn sm pri" href={nuevoHref(cid, 'actas')}>
              <Icon name="plus" /> Registrar primera acta
            </Link>
          }
        />
      )}
      </Surface>
    </div>
  );
};
