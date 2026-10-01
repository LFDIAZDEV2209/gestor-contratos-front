'use client';

import React from 'react';
import { clamp, pctFmt } from '@/lib/format';

export interface PBarProps {
  value: number;
  max?: number;
  color?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
}

export const PBar: React.FC<PBarProps> = ({
  value,
  max = 100,
  color,
  showLabel = false,
  size = 'md',
  className = '',
  style = {}
}) => {
  // Si value vino en escala fraccionaria 0..1 (ej. pExecFin = 0.89) con max=100
  let pct = max > 0 ? (value / max) * 100 : 0;
  if (value > 0 && value <= 1.0 && max === 100) {
    pct = value * 100;
  }

  const clamped = clamp(pct, 0, 100);
  const exceeds = pct > 100;
  const excessPct = Math.round(pct - 100);

  const barColor = exceeds
    ? 'var(--crit)'
    : color || undefined;

  return (
    <div className={`pbar ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, width: '100%', ...style }}>
      <div
        className={`bar ${size === 'lg' ? 'lg' : ''}`}
        style={{ flex: 1 }}
        title={`${pct.toLocaleString('es-CO', { maximumFractionDigits: 1 })}%`}
      >
        <i
          style={{
            width: `${clamped}%`,
            background: barColor
          }}
        />
      </div>

      {showLabel && (
        <span className="mono">
          {pctFmt(pct)}
        </span>
      )}

      {exceeds && (
        <span
          className="badge b-crit"
          style={{ fontSize: '10px', padding: '1px 6px', fontWeight: 700 }}
          title={`La ejecución supera el valor presupuestado en un ${excessPct}%`}
        >
          Excede {excessPct}%
        </span>
      )}
    </div>
  );
};
