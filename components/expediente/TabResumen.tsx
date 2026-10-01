'use client';
import { M } from '../../lib/metrics';
import { money, pct } from '../../lib/format';
import { Kpi } from '../ui/Kpi';

export const TabResumen = ({ cid }: { cid: string }) => {
  const m = M(cid);
  return (
    <div className="grid g2">
      <div className="panel">
        <div className="panel-h"><h3>Estado de Salud</h3></div>
        <div className="panel-b flex gap-6 items-center">
          <div className="score-ring">
            <div style={{ border: `4px solid var(--${m.sem})` }}>{m.sem.toUpperCase()}</div>
          </div>
          <div className="flex-1">
            <div className="comp">
              <span>Riesgo</span>
              <div className="bar"><i style={{width:'80%'}}></i></div>
              <span>80/100</span>
            </div>
            <div className="comp">
              <span>Cumplimiento</span>
              <div className="bar"><i style={{width:'50%'}}></i></div>
              <span>50/100</span>
            </div>
          </div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-h"><h3>Financiero</h3></div>
        <div className="panel-b grid g2">
          <Kpi label="Ejecutado" value={money(m.valAct - m.saldo)} />
          <Kpi label="Saldo" value={money(m.saldo)} />
        </div>
      </div>
    </div>
  );
};
