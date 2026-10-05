'use client';
import Link from 'next/link';
import { obligationHref } from '../app/routes';
import { nuevoHref } from './routes';
import { Input } from '../ui/Controls';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, EmptyState } from '../ui/Workspace';
import { useState } from 'react';
import type { Obligation } from '../../lib/types';
import { Store } from '../../lib/store';
import { effOblig } from '../../lib/metrics';
import { fdate, pct, todayIso, sum, diffDays } from '../../lib/format';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Icon } from '../icons';

type VistaRapida = 'todas' | 'vencidas' | 'porVencer' | 'sinVerificar';

export const TabObligaciones = ({ cid }: { cid: string }) => {
  const [vista, setVista] = useState<VistaRapida>('todas');
  const [q, setQ] = useState('');

  const obligations = Store.byContract('obligations', cid) as Obligation[];
  const hoy = todayIso();

  const esVencida = (o: Obligation) => {
    const e = effOblig(o);
    return e === 'Vencida' || e === 'Incumplida';
  };
  const cumplidas = obligations.filter((o) => o.estado === 'Cumplida').length;
  const vencidas = obligations.filter(esVencida).length;
  const porVencer = obligations.filter(
    (o) => !esVencida(o) && o.estado !== 'Cumplida' && o.fechaLimite && diffDays(hoy, o.fechaLimite) <= 15 && diffDays(hoy, o.fechaLimite) >= 0
  ).length;
  const sinVerificar = obligations.filter((o) => o.estado === 'Cumplida' && !o.verificadoPor).length;
  const avgCumpl = obligations.length ? sum(obligations, (o) => Number(o.cumplimiento || 0)) / obligations.length : 0;

  const texto = q.trim().toLowerCase();
  const filtered = obligations.filter((o) => {
    if (vista === 'vencidas' && !esVencida(o)) return false;
    if (vista === 'porVencer' && (esVencida(o) || o.estado === 'Cumplida' || !o.fechaLimite || diffDays(hoy, o.fechaLimite) > 15 || diffDays(hoy, o.fechaLimite) < 0)) return false;
    if (vista === 'sinVerificar' && !(o.estado === 'Cumplida' && !o.verificadoPor)) return false;
    if (texto) {
      const heno = `${o.descripcion} ${o.responsable} ${o.tipo} ${o.evidencia || ''}`.toLowerCase();
      if (!heno.includes(texto)) return false;
    }
    return true;
  });

  const hayFiltro = vista !== 'todas' || texto.length > 0;
  const limpiarFiltros = () => {
    setVista('todas');
    setQ('');
  };

  const nuevaObligacionHref = nuevoHref(cid, 'obligaciones');

  return (
    <div>
      <div className="panel-h mb-3">
        <div>
          <h3>Obligaciones contractuales</h3>
          <span className="sub">{obligations.length} obligaciones pactadas</span>
        </div>
        <div className="row-flex">
          <Link className="btn sm pri" href={nuevaObligacionHref}>
            <Icon name="plus" /> Nueva obligación
          </Link>
        </div>
      </div>

      <div className="kpis mb">
        <Kpi label="Total obligaciones" value={obligations.length} color="na" />
        <Kpi label="Cumplidas" value={cumplidas} sem="ok" color={cumplidas ? undefined : 'na'} />
        <Kpi label="Vencidas / incumplidas" value={vencidas} sem={vencidas ? 'crit' : 'ok'} color={vencidas ? undefined : 'na'} />
        <Kpi label="% Cumplimiento promedio" value={pct(avgCumpl)} color="na" />
      </div>

      {/* Buscador + vistas rápidas */}
      <div className="row-flex px-4 py-2" style={{ gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por descripción, responsable o evidencia…"
          aria-label="Buscar obligaciones"
          style={{ maxWidth: 260, height: 30, fontSize: 12.5 }}
        />
        <Button className={`btn sm ${vista === 'todas' ? 'pri' : 'ghost'}`} onClick={() => setVista('todas')} aria-pressed={vista === 'todas'}>
          Todas ({obligations.length})
        </Button>
        <Button className={`btn sm ${vista === 'vencidas' ? 'pri' : 'ghost'}`} onClick={() => setVista('vencidas')} aria-pressed={vista === 'vencidas'}>
          Vencidas / incumplidas ({vencidas})
        </Button>
        <Button className={`btn sm ${vista === 'porVencer' ? 'pri' : 'ghost'}`} onClick={() => setVista('porVencer')} aria-pressed={vista === 'porVencer'}>
          Vencen en 15 días ({porVencer})
        </Button>
        <Button className={`btn sm ${vista === 'sinVerificar' ? 'pri' : 'ghost'}`} onClick={() => setVista('sinVerificar')} aria-pressed={vista === 'sinVerificar'}>
          Cumplidas sin verificar ({sinVerificar})
        </Button>
        {hayFiltro && (
          <Button className="btn sm ghost" onClick={limpiarFiltros} title="Limpiar filtros">
            <Icon name="xmark" /> Limpiar filtros
          </Button>
        )}
      </div>

      {obligations.length === 0 ? (
        <EmptyState
          title="Sin obligaciones registradas"
          description="Registra las obligaciones pactadas para hacer seguimiento de su cumplimiento."
          action={
            <Link className="btn sm pri" href={nuevaObligacionHref} style={{ marginTop: 12 }}>
              <Icon name="plus" /> Registrar primera obligación
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          description="Ninguna obligación coincide con la vista rápida o el texto buscado."
          action={
            <Button className="btn sm" onClick={limpiarFiltros} style={{ marginTop: 12 }}>
              <Icon name="filter" /> Limpiar filtros
            </Button>
          }
        />
      ) : (
        <Surface className="panel" style={{ paddingTop: 0 }}>
          <TableViewport className="tbl-wrap">
            <DataTable className="tbl" aria-label="Obligaciones contractuales">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th>Tipo</th>
                  <th>Periodicidad</th>
                  <th>Fecha límite</th>
                  <th>Estado</th>
                  <th>Cumplimiento</th>
                  <th>Responsable</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const eff = effOblig(o);
                  const compl = Number(o.cumplimiento || 0);
                  return (
                    <tr key={o.id}>
                      <td>
                        <Link className="link font-medium cursor-pointer" href={obligationHref(o.id)}>
                          {o.descripcion}
                        </Link>
                        {o.evidencia && (
                          <div className="small muted flex items-center gap-1 mt-1">
                            <Icon name="file-text" /> {o.evidencia}
                          </div>
                        )}
                      </td>
                      <td><span className="badge b-info">{o.tipo}</span></td>
                      <td>{o.periodicidad || '—'}</td>
                      <td>{fdate(o.fechaLimite)}</td>
                      <td>
                        <Badge text={eff} />
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <div className="pbar">
                          <div className="bar">
                            <i
                              style={{
                                width: `${compl}%`,
                                background: compl >= 100 ? 'var(--ok)' : compl >= 50 ? 'var(--warn)' : 'var(--crit)'
                              }}
                            />
                          </div>
                          <span className="small mono">{compl}%</span>
                        </div>
                      </td>
                      <td>{o.responsable}</td>
                      <td>
                        <div className="acts">
                          <Link
                            className="btn xs ghost"
                            href={obligationHref(o.id)}
                            title="Abrir ficha con checklist, comentarios y verificación"
                          >
                            <Icon name="eye" /> Ficha
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </TableViewport>
        </Surface>
      )}
    </div>
  );
};
