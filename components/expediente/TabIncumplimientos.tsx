'use client';
import { Store } from '../../lib/store';

export const TabIncumplimientos = ({ cid }: { cid: string }) => {
  const items = Store.byContract('breaches', cid);
  return (
    <div className="panel">
      <div className="panel-h"><h3>Incumplimientos</h3></div>
      <table className="tbl">
        <thead><tr><th>Fecha</th><th>Severidad</th><th>Estado</th><th>Penalidad</th></tr></thead>
        <tbody>
          {items.map(b => (
            <tr key={b.id}><td>{b.date}</td><td>{b.severity}</td><td>{b.status}</td><td>{b.penalty}</td></tr>
          ))}
          {items.length === 0 && <tr><td colSpan={4} className="empty">Sin incumplimientos</td></tr>}
        </tbody>
      </table>
    </div>
  );
};
