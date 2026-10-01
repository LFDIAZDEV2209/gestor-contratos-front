'use client';
import { Store } from '../../lib/store';
import { money, fdate } from '../../lib/format';

export const TabInformacion = ({ cid }: { cid: string }) => {
  const c = Store.get('contracts', cid);
  if (!c) return null;
  return (
    <div className="panel">
      <div className="panel-h"><h3>Información Contractual</h3></div>
      <div className="panel-b np">
        <div className="dl">
          <div><span>Número</span><b>{c.num}</b></div>
          <div><span>Tipo</span><b>{c.type}</b></div>
          <div><span>Estado</span><b>{c.status}</b></div>
          <div><span>Valor Base</span><b>{money(c.val)}</b></div>
          <div><span>Fecha Firma</span><b>{fdate(c.signDate)}</b></div>
          <div><span>Fecha Inicio</span><b>{fdate(c.startDate)}</b></div>
          <div><span>Fecha Fin</span><b>{fdate(c.endDate)}</b></div>
          <div><span>Responsable</span><b>{c.supervisor}</b></div>
          <div><span>Objeto</span><b>{c.obj}</b></div>
        </div>
      </div>
    </div>
  );
};
