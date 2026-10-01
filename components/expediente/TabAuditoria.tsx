'use client';
import { Store } from '../../lib/store';

export const TabAuditoria = ({ cid }: { cid: string }) => {
  const items = Store.all('audits').filter(a => a.entityId === cid);
  return (
    <div className="panel">
      <div className="panel-h"><h3>Auditoría</h3></div>
      <table className="tbl">
        <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalles</th></tr></thead>
        <tbody>
          {items.map(a => (
            <tr key={a.id}><td>{a.date}</td><td>{a.user}</td><td>{a.action}</td><td>{a.details}</td></tr>
          ))}
          {items.length === 0 && <tr><td colSpan={4} className="empty">Sin registros</td></tr>}
        </tbody>
      </table>
    </div>
  );
};
