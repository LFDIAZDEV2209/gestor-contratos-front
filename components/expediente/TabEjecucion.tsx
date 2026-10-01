'use client';
import { Store } from '../../lib/store';

export const TabEjecucion = ({ cid }: { cid: string }) => {
  const execs = Store.byContract('execs', cid);
  return (
    <div className="panel">
      <div className="panel-h"><h3>Registro de Ejecución</h3></div>
      <table className="tbl">
        <thead><tr><th>Fecha</th><th>Valor</th><th>Porcentaje</th><th>Observación</th></tr></thead>
        <tbody>
          {execs.map(e => (
            <tr key={e.id}><td>{e.date}</td><td>{e.val}</td><td>{e.pct}%</td><td>{e.obs}</td></tr>
          ))}
          {execs.length === 0 && <tr><td colSpan={4} className="empty">Sin registros</td></tr>}
        </tbody>
      </table>
    </div>
  );
};
