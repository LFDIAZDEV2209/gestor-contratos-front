'use client';
import { Store } from '../../lib/store';

export const TabActas = ({ cid }: { cid: string }) => {
  const items = Store.byContract('actas', cid);
  return (
    <div className="panel">
      <div className="panel-h"><h3>Actas</h3></div>
      <table className="tbl">
        <thead><tr><th>Tipo</th><th>Fecha</th><th>Estado</th><th>Usuario</th></tr></thead>
        <tbody>
          {items.map(a => (
            <tr key={a.id}><td>{a.type}</td><td>{a.date}</td><td>{a.status}</td><td>{a.by}</td></tr>
          ))}
          {items.length === 0 && <tr><td colSpan={4} className="empty">Sin actas</td></tr>}
        </tbody>
      </table>
    </div>
  );
};
