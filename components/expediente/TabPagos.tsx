'use client';
import Link from 'next/link';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, EmptyState } from '../ui/Workspace';
import { useState } from 'react';
import type { Payment } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { M } from '../../lib/metrics';
import { money, moneyM, pct, fdate, monthLabel, todayIso, sum } from '../../lib/format';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Icon } from '../icons';
import { nuevoHref } from './routes';

type VistaRapida = 'todas' | 'porGestionar' | 'pagadosSinSoporte';

// Formato compacto sin cortes de palabra en móvil ("mil M" indivisible).
const nb = (s: string) => s.replace('mil M', 'mil\u00A0M');

export const TabPagos = ({ cid }: { cid: string }) => {
  const [vista, setVista] = useState<VistaRapida>('todas');

  const c = Store.get('contracts', cid);
  if (!c)
    return <EmptyState title="Contrato no encontrado" description="No se encontró el expediente del contrato solicitado." />;

  const m = M(c);
  const payments = (Store.byContract('payments', cid) as Payment[]).sort((a, b) =>
    a.fecha < b.fecha ? 1 : -1
  );

  const pagados = payments.filter((p) => p.estado === 'Pagado');
  const pendientes = payments.filter((p) => p.estado === 'Pendiente' || p.estado === 'En revisión');
  const pagadosSinSoporte = pagados.filter((p) => !p.soporte).length;
  const totalNetoPagado = sum(pagados, (p) => +p.neto || 0);
  const totalRetenciones = sum(pagados, (p) => Number(p.retenciones || 0));
  const totalPendiente = sum(pendientes, (p) => +p.neto || 0);
  const pctPagVsEjec = m.ejecutado ? (m.pagado / m.ejecutado) * 100 : 0;

  // Vistas rápidas del prototipo: pendientes/en revisión · pagados sin soporte
  const filtered = payments.filter((p) => {
    if (vista === 'porGestionar') return p.estado === 'Pendiente' || p.estado === 'En revisión';
    if (vista === 'pagadosSinSoporte') return p.estado === 'Pagado' && !p.soporte;
    return true;
  });

  const handleUpdateStatus = (pay: Payment, newStatus: string) => {
    if (!AuthService.guard('aprobar')) return;
    const patch: any = { estado: newStatus };
    if (newStatus === 'Aprobado') patch.fechaAprob = todayIso();
    if (newStatus === 'Pagado') patch.fechaPago = todayIso();

    Store.update('payments', pay.id, patch);
    Audit.log({
      contractId: cid,
      modulo: 'Pagos',
      accion: 'Aprobación',
      campo: 'Estado del pago ' + pay.numero,
      anterior: pay.estado,
      nuevo: newStatus
    });
    notify(`Pago ${pay.numero} → ${newStatus}`);
  };

  return (
    <div>
      <div className="panel-h mb-3">
        <div>
          <h3>Pagos y Cuentas de Cobro</h3>
          <span className="sub">{payments.length} pagos registrados</span>
        </div>
        <div className="row-flex">
          <Link className="btn sm pri" href={nuevoHref(cid, 'pagos')} aria-label="Registrar nuevo pago o cuenta de cobro">
            <Icon name="plus" /> Registrar pago
          </Link>
        </div>
      </div>

      <div className="kpis mb">
        <Kpi label="Total Pagado (Neto)" value={nb(moneyM(totalNetoPagado))} sub={money(totalNetoPagado)} sem="ok" color={totalNetoPagado ? undefined : 'na'} />
        <Kpi
          label="Pendiente / en revisión"
          value={pendientes.length}
          sub={nb(moneyM(totalPendiente))}
          sem={pendientes.length ? 'warn' : 'ok'}
          color={pendientes.length ? undefined : 'na'}
        />
        <Kpi label="Retenciones practicadas" value={nb(moneyM(totalRetenciones))} sub={money(totalRetenciones)} color="na" />
        <Kpi label="% Pagado vs. ejecutado" value={pct(pctPagVsEjec)} sub={`Ejecutado ${nb(moneyM(m.ejecutado))}`} color="na" />
      </div>

      {/* Vistas rápidas */}
      <div className="row-flex px-4 py-2" style={{ gap: '6px', flexWrap: 'wrap' }}>
        <Button
          className={`btn sm ${vista === 'todas' ? 'pri' : 'ghost'}`}
          onClick={() => setVista('todas')}
          aria-pressed={vista === 'todas'}
        >
          Todos ({payments.length})
        </Button>
        <Button
          className={`btn sm ${vista === 'porGestionar' ? 'pri' : 'ghost'}`}
          onClick={() => setVista('porGestionar')}
          aria-pressed={vista === 'porGestionar'}
        >
          Pendientes / en revisión ({pendientes.length})
        </Button>
        <Button
          className={`btn sm ${vista === 'pagadosSinSoporte' ? 'pri' : 'ghost'}`}
          onClick={() => setVista('pagadosSinSoporte')}
          aria-pressed={vista === 'pagadosSinSoporte'}
        >
          Pagados sin soporte ({pagadosSinSoporte})
        </Button>
      </div>

      <Surface className="panel" style={{ paddingTop: 0 }}>
        <TableViewport className="tbl-wrap">
          <DataTable className="tbl">
            <thead>
              <tr>
                <th>Pago / Factura</th>
                <th>Fecha</th>
                <th>Periodo</th>
                <th className="num">Bruto</th>
                <th className="num">IVA</th>
                <th className="num">Retenciones</th>
                <th className="num">Neto a pagar</th>
                <th>Estado</th>
                <th>Soporte</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.numero}</b>
                    {p.factura && <div className="small muted mono">Factura: {p.factura}</div>}
                  </td>
                  <td>{fdate(p.fecha)}</td>
                  <td>{p.periodo ? monthLabel(p.periodo) : '—'}</td>
                  <td className="num mono">{money(p.bruto)}</td>
                  <td className="num mono">{money(p.iva)}</td>
                  <td className="num mono">{money(p.retenciones)}</td>
                  <td className="num mono font-semibold">{money(p.neto)}</td>
                  <td>
                    <Badge text={p.estado} />
                  </td>
                  <td>
                    {p.soporte ? (
                      <span className="small text-green-700 dark:text-green-400 flex items-center gap-1">
                        <Icon name="file-pdf" /> {p.soporte}
                      </span>
                    ) : (
                      <span className="badge b-crit">Sin soporte</span>
                    )}
                  </td>
                  <td>
                    <div className="acts">
                      {p.estado === 'Pendiente' && (
                        <Button
                          className="btn xs"
                          onClick={() => handleUpdateStatus(p, 'En revisión')}
                          title="Pasar a revisión"
                        >
                          Revisar
                        </Button>
                      )}
                      {(p.estado === 'Pendiente' || p.estado === 'En revisión') && (
                        <Button
                          className="btn xs pri"
                          onClick={() => handleUpdateStatus(p, 'Aprobado')}
                          title="Aprobar pago"
                        >
                          Aprobar
                        </Button>
                      )}
                      {p.estado === 'Aprobado' && (
                        <Button
                          className="btn xs"
                          style={{ background: 'var(--ok)', borderColor: 'var(--ok)', color: '#fff' }}
                          onClick={() => handleUpdateStatus(p, 'Pagado')}
                          title="Marcar como pagado"
                        >
                          Pagar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="empty">
                    {vista === 'todas'
                      ? 'No se registran pagos en este contrato.'
                      : 'No hay pagos que coincidan con esta vista rápida.'}
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </TableViewport>
      </Surface>

      {payments.length === 0 && (
        <EmptyState
          title="Sin pagos registrados"
          description="Radicar las cuentas de cobro u órdenes de pago del periodo permite trazar la ejecución presupuestal."
          action={
            <Link className="btn sm pri" href={nuevoHref(cid, 'pagos')}>
              <Icon name="plus" /> Registrar primer pago
            </Link>
          }
        />
      )}

      {/* Alta en vista dedicada: /contrato/[id]/pagos/nueva (modal cero) */}
    </div>
  );
};
