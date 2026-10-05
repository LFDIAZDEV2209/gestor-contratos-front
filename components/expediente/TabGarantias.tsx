'use client';
import Link from 'next/link';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, EmptyState } from '../ui/Workspace';
import type { Guarantee, Cupo } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { M, contractInsurers, cupoStats } from '../../lib/metrics';
import { money, moneyM, fdate, diffDays, todayIso, sum } from '../../lib/format';
import { CAT } from '../../lib/catalog';
import { Badge } from '../ui/Badge';
import { Icon } from '../icons';
import { nuevoHref } from './routes';

export const TabGarantias = ({ cid }: { cid: string }) => {
  const c = Store.get('contracts', cid);
  if (!c) return <EmptyState title="Contrato no encontrado" description="No se encontró el expediente del contrato solicitado." />;

  const m = M(c);
  const guarantees = (Store.byContract('guarantees', cid) as Guarantee[]).sort((a, b) =>
    a.fechaVenc < b.fechaVenc ? -1 : 1
  );

  const insurers = contractInsurers(c);
  const byAseg: Record<string, Guarantee[]> = {};
  guarantees
    .filter((g) => g.estado !== 'Anulada' && g.estado !== 'Rechazada')
    .forEach((g) => {
      byAseg[g.aseguradora] = byAseg[g.aseguradora] || [];
      byAseg[g.aseguradora].push(g);
    });

  const cum = guarantees.find((g) => g.tipo === 'Cumplimiento' && g.estado === 'Aprobada');

  const handleApprove = (g: Guarantee) => {
    if (!AuthService.guard('aprobar')) return;
    Store.update('guarantees', g.id, { estado: 'Aprobada' });
    Audit.log({
      contractId: cid,
      modulo: 'Garantías',
      accion: 'Aprobación',
      campo: 'Póliza ' + g.poliza,
      nuevo: 'Aprobada'
    });
    notify(`Póliza ${g.poliza} aprobada`);
  };

  const allCupos = Store.all('cupos') as Cupo[];

  return (
    <div>
      <div className="panel-h mb-3">
        <div>
          <h3>Seguros y garantías del contrato</h3>
          <span className="sub">
            {insurers.length} aseguradora(s) · alertas a 30, 15, 10, 5, 3 y 1 día
          </span>
        </div>
        <div className="row-flex">
          <Link className="btn sm pri" href={nuevoHref(cid, 'garantias')} aria-label="Registrar nueva póliza de garantía">
            <Icon name="plus" /> Nueva póliza
          </Link>
        </div>
      </div>

      {/* Tarjetas resumen por aseguradora */}
      {Object.keys(byAseg).length > 0 && (
        <div className="grid g3 mb-4">
          {Object.keys(byAseg).map((aseg) => {
            const pols = byAseg[aseg];
            const cu = pols.filter((g) => g.modalidadPoliza === 'Póliza por cupo');
            const totalVal = sum(pols, (g) => +g.valor || 0);

            return (
              <div
                key={aseg}
                className="p-3 rounded"
                style={{ border: '1px solid var(--line)', borderLeft: '4px solid var(--brand)', background: 'var(--bg-sub)' }}
              >
                <div className="row-flex" style={{ flexWrap: 'nowrap' }}>
                  <Icon name="umbrella" />
                  <b>{aseg}</b>
                </div>
                <div className="small muted mt-1">
                  {pols.length} póliza(s): {pols.map((g) => g.tipo).join(', ')}
                </div>
                <div className="row-flex justify-between items-center mt-2">
                  <b className="mono">{money(totalVal)}</b>
                  {cu.length > 0 ? (
                    <span className="badge b-info">
                      Por cupo {cu.map((g) => (Store.get('cupos', g.cupoId || '') as Cupo)?.numero || '').filter(Boolean).join(', ')}
                    </span>
                  ) : (
                    <span className="badge">Individual</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Nota de cobertura de la póliza de cumplimiento */}
      {cum && (
        <div className="readonly-note mb-4 flex items-center gap-2">
          <Icon name="shield-halved" />
          <div>
            Póliza de cumplimiento <b>{cum.poliza}</b>: cubre <b className="mono">{money(cum.valor)}</b>
            {cum.porcentaje ? ` (${cum.porcentaje}% del valor; requerido hoy ${money((m.valorActual * cum.porcentaje) / 100)})` : ''} hasta{' '}
            {fdate(cum.fechaVenc)}
            {c.fechaFin && cum.fechaVenc < c.fechaFin ? (
              <span style={{ color: 'var(--crit)', fontWeight: 'bold' }}>
                {' '}
                — no cubre el plazo actual del contrato ({fdate(c.fechaFin)})
              </span>
            ) : (
              <span className="text-green-700 dark:text-green-400 font-medium"> — vigencia adecuada</span>
            )}
            .
          </div>
        </div>
      )}

      {/* Tabla de pólizas */}
      <Surface className="panel">
        <TableViewport className="tbl-wrap">
          <DataTable className="tbl" aria-label="Pólizas y amparos de garantía del contrato">
            <thead>
              <tr>
                <th>Póliza</th>
                <th>Tipo de garantía</th>
                <th>Aseguradora</th>
                <th>Modalidad</th>
                <th className="num">Valor asegurado</th>
                <th>Vigencia</th>
                <th>Días</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {guarantees.map((g) => {
                const d = diffDays(todayIso(), g.fechaVenc);
                const vencida = g.fechaVenc < todayIso();
                return (
                  <tr key={g.id}>
                    <td>
                      <b>{g.poliza}</b>
                      {g.documento && (
                        <div className="small muted flex items-center gap-1 mt-1">
                          <Icon name="file-pdf" /> {g.documento}
                        </div>
                      )}
                    </td>
                    <td>{g.tipo}</td>
                    <td>{g.aseguradora}</td>
                    <td>
                      {g.modalidadPoliza === 'Póliza por cupo' ? (
                        <span className="badge b-info">Por cupo</span>
                      ) : (
                        <span className="badge">Individual</span>
                      )}
                    </td>
                    <td className="num mono font-semibold">{money(g.valor)}</td>
                    <td>
                      {fdate(g.fechaInicio)} → {fdate(g.fechaVenc)}
                    </td>
                    <td>
                      {vencida ? (
                        <span className="badge b-crit">Venció hace {Math.abs(d)} d</span>
                      ) : d <= 15 ? (
                        <span className="badge b-warn">{d} días</span>
                      ) : (
                        <span className="mono">{d} días</span>
                      )}
                    </td>
                    <td>
                      <Badge text={g.estado} />
                    </td>
                    <td>
                      <div className="acts">
                        {g.estado === 'Pendiente' && (
                          <Button
                            className="btn xs pri"
                            onClick={() => handleApprove(g)}
                            title="Aprobar póliza"
                          >
                            Aprobar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </TableViewport>
      </Surface>

      {guarantees.length === 0 && (
        <EmptyState
          title="Este contrato no tiene pólizas"
          description={
            ['Terminado', 'En liquidación', 'Liquidado', 'Anulado'].includes(c.estado)
              ? 'Contrato cerrado: el validador no exigirá garantías.'
              : 'Un contrato en curso exige al menos la garantía de cumplimiento. Registra la primera póliza.'
          }
          action={
            <Link className="btn sm pri" href={nuevoHref(cid, 'garantias')}>
              <Icon name="plus" /> Registrar primera póliza
            </Link>
          }
        />
      )}
    </div>
  );
};
