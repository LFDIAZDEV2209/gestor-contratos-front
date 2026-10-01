'use client';
import { Store } from '../../lib/store';
import { money } from '../../lib/format';

export const TabGarantias = ({ cid }: { cid: string }) => {
  const gar = Store.byContract('guarantees', cid);
  return (
    <div className="panel">
      <div className="panel-h"><h3>Garantías / Pólizas</h3></div>
      <table className="tbl">
        <thead><tr><th>Tipo</th><th>Aseguradora</th><th>Número</th><th>Valor</th><th>Vigencia</th><th>Estado</th></tr></thead>
        <tbody>
          {gar.map(g => (
            <tr key={g.id}><td>{g.type}</td><td>{g.issuer}</td><td>{g.num}</td><td>{money(g.val)}</td><td>{g.from} a {g.to}</td><td>{g.status}</td></tr>
          ))}
          {gar.length === 0 && <tr><td colSpan={6} className="empty">Sin garantías</td></tr>}
        </tbody>
      </table>
    </div>
  );
};
