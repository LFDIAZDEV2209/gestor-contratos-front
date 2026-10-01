'use client';
import { Store } from '../../lib/store';
import { money } from '../../lib/format';

export const TabSubcontratos = ({ cid }: { cid: string }) => {
  const items = Store.byContract('subcontracts', cid);
  return (
    <div className="panel">
      <div className="panel-h"><h3>Subcontratos</h3></div>
      <table className="tbl">
        <thead><tr><th>Empresa</th><th>Objeto</th><th>Valor</th><th>Estado</th></tr></thead>
        <tbody>
          {items.map(s => (
            <tr key={s.id}><td>{s.company}</td><td>{s.obj}</td><td>{money(s.val)}</td><td>{s.status}</td></tr>
          ))}
          {items.length === 0 && <tr><td colSpan={4} className="empty">Sin subcontratos</td></tr>}
        </tbody>
      </table>
    </div>
  );
};
