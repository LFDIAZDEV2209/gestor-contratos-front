'use client';
import { Store } from '../../lib/store';
import { fdate } from '../../lib/format';

export const TabEntregables = ({ cid }: { cid: string }) => {
  const delivs = Store.byContract('deliverables', cid);
  return (
    <div className="panel">
      <div className="panel-h"><h3>Entregables (Gantt)</h3></div>
      <div className="panel-b gantt">
        {delivs.map((d, i) => (
          <div className="gr" key={d.id}>
            <div className="gl">{d.name}</div>
            <div className="gt">
              <div className="gb" style={{ left: `${i * 10}%`, width: '20%' }}><i></i></div>
              <div className="gm" style={{ left: '50%' }}></div>
            </div>
          </div>
        ))}
        {delivs.length === 0 && <div className="empty">Sin entregables</div>}
      </div>
    </div>
  );
};
