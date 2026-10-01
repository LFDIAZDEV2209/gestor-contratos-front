'use client';
import type { CSSProperties } from 'react';
export interface PBarProps { value: number; max?: number; scale?: 'percent' | 'fraction'; color?: string; showLabel?: boolean; size?: 'sm' | 'md' | 'lg'; className?: string; style?: CSSProperties; }
// Escala explícita: 0,5 puntos porcentuales no equivale a 50%.
export function PBar({ value, max = 100, scale = 'percent', color, showLabel = true, size = 'md', className = '', style }: PBarProps) {
  const percent = scale === 'fraction' ? value * 100 : max > 0 ? value / max * 100 : NaN;
  const valid = Number.isFinite(percent);
  const bounded = valid ? Math.min(100, Math.max(0, percent)) : 0;
  const label = valid ? percent.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + '%' : 'Sin datos';
  return <div className={`pbar ${className}`} style={style}><div className={`bar ${size}`} role="progressbar" aria-label="Avance" aria-valuemin={0} aria-valuemax={100} aria-valuenow={valid ? bounded : undefined} aria-valuetext={label} title={label}><i style={{ width: bounded + '%', background: percent > 100 ? 'var(--crit)' : color }} /></div>{showLabel && <span className="mono">{label}</span>}{percent > 100 && <span className="badge b-crit">Excede {(percent-100).toLocaleString('es-CO', { maximumFractionDigits: 1 })}%</span>}</div>;
}
