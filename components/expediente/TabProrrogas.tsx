'use client';
import { Store } from '../../lib/store';

export const TabProrrogas = ({ cid }: { cid: string }) => {
  const items = Store.byContract('modifications', cid).filter(m => m.type === 'Prórroga');
  return (
    <div className="panel">
      <div className="panel-h"><h3>Prórrogas</h3></div>
      <table className="tbl">
        <thead><tr><th>Fecha</th><th>Días Adicionados</th></tr></thead>
        <tbody>
          {items.map(m => (
            <tr key={m.id}><td>{m.date}</td><td>{m.daysChange}</td></tr>
          ))}
          {items.length === 0 && <tr><td colSpan={2} className="empty">Sin prórrogas</td></tr>}
        </tbody>
      </table>
    </div>
  );
};
