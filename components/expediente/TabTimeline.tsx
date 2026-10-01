'use client';
import { Store } from '../../lib/store';

export const TabTimeline = ({ cid }: { cid: string }) => {
  const actas = Store.byContract('actas', cid).map(a => ({ date: a.date, title: `Acta: ${a.type}` }));
  const mods = Store.byContract('modifications', cid).map(m => ({ date: m.date, title: `Modificación: ${m.type}` }));
  
  const events = [...actas, ...mods].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  return (
    <div className="panel">
      <div className="panel-h"><h3>Línea de Tiempo</h3></div>
      <div className="panel-b tl">
        {events.map((e, i) => (
          <div className="tl-i" key={i}>
            <div className="tl-d">{e.date}</div>
            <div className="tl-t">{e.title}</div>
          </div>
        ))}
        {events.length === 0 && <div className="empty">Sin eventos relevantes</div>}
      </div>
    </div>
  );
};
