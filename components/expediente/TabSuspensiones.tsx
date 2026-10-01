'use client';
import { Store } from '../../lib/store';

export const TabSuspensiones = ({ cid }: { cid: string }) => {
  const items = Store.byContract('modifications', cid).filter(m => m.type === 'Suspensión' || m.type === 'Reinicio');
  return (
    <div className="panel">
      <div className="panel-h"><h3>Suspensiones y Reinicios</h3></div>
      <table className="tbl">
        <thead><tr><th>Tipo</th><th>Fecha</th><th>Días</th></tr></thead>
        <tbody>
          {items.map(m => (
            <tr key={m.id}><td>{m.type}</td><td>{m.date}</td><td>{m.daysChange}</td></tr>
          ))}
          {items.length === 0 && <tr><td colSpan={3} className="empty">Sin suspensiones</td></tr>}
        </tbody>
      </table>
    </div>
  );
};
