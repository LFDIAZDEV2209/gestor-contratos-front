'use client';
import { Store } from '../../lib/store';

export const TabModificaciones = ({ cid }: { cid: string }) => {
  const items = Store.byContract('modifications', cid);
  return (
    <div className="panel">
      <div className="panel-h"><h3>Modificaciones</h3></div>
      <table className="tbl">
        <thead><tr><th>Tipo</th><th>Fecha</th><th>Valor</th><th>Días</th></tr></thead>
        <tbody>
          {items.map(m => (
            <tr key={m.id}><td>{m.type}</td><td>{m.date}</td><td>{m.valChange}</td><td>{m.daysChange}</td></tr>
          ))}
          {items.length === 0 && <tr><td colSpan={4} className="empty">Sin modificaciones</td></tr>}
        </tbody>
      </table>
    </div>
  );
};
