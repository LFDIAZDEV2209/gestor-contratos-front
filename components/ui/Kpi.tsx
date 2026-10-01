'use client';
export const Kpi = ({ label, value, sub, color }: { label: string, value: string, sub?: string, color?: string }) => (
  <div className="kpi">
    <div className="l">{label}</div>
    <div className="v">{value}</div>
    {sub && <div className="s">{sub}</div>}
    {color && <div className={`sem ${color}`}></div>}
  </div>
);
