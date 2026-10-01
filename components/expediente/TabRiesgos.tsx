'use client';
import { Store } from '../../lib/store';

export const TabRiesgos = ({ cid }: { cid: string }) => {
  const items = Store.byContract('risks', cid);
  return (
    <div className="panel">
      <div className="panel-h"><h3>Matriz de Riesgos</h3></div>
      <div className="panel-b">
        <div className="heat mb">
          <div className="ax">Prob</div>
          <div className="c h1">1</div><div className="c h2">2</div><div className="c h3">3</div><div className="c h4">4</div><div className="c h4">5</div>
        </div>
        <table className="tbl mt-4">
          <thead><tr><th>Tipo</th><th>Probabilidad</th><th>Impacto</th><th>Puntaje</th><th>Estado</th></tr></thead>
          <tbody>
            {items.map(r => (
              <tr key={r.id}><td>{r.type}</td><td>{r.prob}</td><td>{r.impact}</td><td>{r.score}</td><td>{r.status}</td></tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="empty">Sin riesgos</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};
