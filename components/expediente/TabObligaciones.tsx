'use client';
import { Store } from '../../lib/store';

export const TabObligaciones = ({ cid }: { cid: string }) => {
  const obs = Store.byContract('obligations', cid);
  return (
    <div className="panel">
      <div className="panel-h"><h3>Obligaciones</h3></div>
      <table className="tbl">
        <thead><tr><th>Descripción</th><th>Frecuencia</th><th>Estado</th><th>Vencimiento</th></tr></thead>
        <tbody>
          {obs.map(o => (
            <tr key={o.id}><td>{o.desc}</td><td>{o.freq}</td><td>{o.status}</td><td>{o.due}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
