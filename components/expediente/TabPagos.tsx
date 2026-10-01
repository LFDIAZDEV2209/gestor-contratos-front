'use client';
import { Store } from '../../lib/store';
import { money } from '../../lib/format';

export const TabPagos = ({ cid }: { cid: string }) => {
  const pays = Store.byContract('payments', cid);
  return (
    <div className="panel">
      <div className="panel-h"><h3>Pagos Realizados</h3></div>
      <table className="tbl">
        <thead><tr><th>Fecha</th><th>Valor Neto</th><th>Referencia</th><th>Estado</th></tr></thead>
        <tbody>
          {pays.map(p => (
            <tr key={p.id}><td>{p.date}</td><td>{money(p.val)}</td><td>{p.ref}</td><td>{p.status}</td></tr>
          ))}
          {pays.length === 0 && <tr><td colSpan={4} className="empty">Sin pagos</td></tr>}
        </tbody>
      </table>
    </div>
  );
};
