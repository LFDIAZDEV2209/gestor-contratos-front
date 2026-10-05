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

export const TabActas = ({ cid }: { cid: string }) => {
  const [filterTipo, setFilterTipo] = useState('');

  const c = Store.get('contracts', cid);
  if (!c) return <div className="empty">Contrato no encontrado</div>;

  const actas = (Store.byContract('actas', cid) as Acta[]).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const tipos = Array.from(new Set(actas.map((a) => a.tipo)));

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
    <Surface className="panel">
      <div className="panel-h" style={{ borderTop: 0 }}>
        <div>
          <h3>Actas</h3>
          <span className="sub">{actas.length} acta(s) registrada(s)</span>
        </div>
        <div className="row-flex">
          <div className="exp-actions">
            <Button className="btn sm" onClick={() => handleExport('xlsx')} title="Exportar a Excel">
              <Icon name="file-excel" /> Excel
            </Button>
            <Button className="btn sm" onClick={() => handleExport('pdf')} title="Exportar a PDF">
              <Icon name="file-pdf" /> PDF
            </Button>
            <Button className="btn sm" onClick={() => handleExport('csv')} title="Exportar a CSV">
              <Icon name="file-csv" /> CSV
            </Button>
          </div>
          <Link className="btn sm pri" href={nuevoHref(cid, 'actas')}>
            <Icon name="plus" /> Nueva acta
          </Link>
        </div>
      </div>

      {tipos.length > 0 && (
        <div className="row-flex px-4 py-2" style={{ gap: '6px', borderBottom: '1px solid var(--line)' }}>
          <Button
            className={`btn sm ${filterTipo === '' ? 'pri' : 'ghost'}`}
            onClick={() => setFilterTipo('')}
          >
            Todas ({actas.length})
          </Button>
          {tipos.map((t) => (
            <Button
              key={t}
              className={`btn sm ${filterTipo === t ? 'pri' : 'ghost'}`}
              onClick={() => setFilterTipo(t)}
            >
              {t} ({actas.filter((a) => a.tipo === t).length})
            </Button>
          ))}
        </div>
      )}

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
  );
};
