'use client';
import type { Risk } from '@/lib/types';
import { Button } from './button';
export function RiskMatrix({ risks, selected, onSelect }: { risks: Risk[]; selected: { p: number; i: number } | null; onSelect: (cell: { p: number; i: number } | null) => void }) {
  return <div className="risk-matrix" role="group" aria-label="Matriz de probabilidad e impacto"><span className="matrix-axis">P / I</span>{[1,2,3,4,5].map(i=><span className="matrix-axis" key={`i${i}`}>I{i}</span>)}{[5,4,3,2,1].map(p=><div className="matrix-row" key={p}><span className="matrix-axis">P{p}</span>{[1,2,3,4,5].map(i=>{ const score=p*i; const count=risks.filter(r=>(r.prob ?? r.probabilidad)===p && r.impacto===i).length; const active=selected?.p===p && selected.i===i; return <Button key={i} className={`heat-cell h${score<5?1:score<10?2:score<15?3:4}`} aria-pressed={active} aria-label={`Probabilidad ${p}, impacto ${i}: ${count} riesgos`} onClick={()=>onSelect(active?null:{p,i})}>{count || '—'}</Button>; })}</div>)}</div>;
}
