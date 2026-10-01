'use client';

import React from 'react';
import { Icon } from '../icons';

export interface KpiProps {
  label?: string;
  title?: string;
  value: string | number;
  sub?: string | number | null;
  color?: string;
  sem?: string | null;
  icon?: string;
  delta?: {
    value: string | number;
    type?: 'up' | 'down' | 'neutral';
  } | string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export const Kpi: React.FC<KpiProps> = ({
  label,
  title,
  value,
  sub,
  color,
  sem,
  icon,
  delta,
  className = '',
  style,
  onClick
}) => {
  const semColor = sem || color;
  const textLabel = label || title || '';

  // Parse delta if provided
  let deltaNode: React.ReactNode = null;
  if (delta) {
    if (typeof delta === 'string') {
      const isUp = delta.startsWith('+') || delta.includes('▲');
      const isDown = delta.startsWith('-') || delta.includes('▼');
      const deltaClass = isUp ? 'b-ok' : isDown ? 'b-crit' : 'b-na';
      deltaNode = <span className={`badge ${deltaClass}`} style={{ fontSize: '10px', padding: '1px 6px' }}>{delta}</span>;
    } else {
      const deltaClass = delta.type === 'up' ? 'b-ok' : delta.type === 'down' ? 'b-crit' : 'b-na';
      const arrow = delta.type === 'up' ? '▲ ' : delta.type === 'down' ? '▼ ' : '';
      deltaNode = <span className={`badge ${deltaClass}`} style={{ fontSize: '10px', padding: '1px 6px' }}>{arrow}{delta.value}</span>;
    }
  }

  return (
    <div
      className={`kpi ${onClick ? 'click' : ''} ${className}`}
      style={style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      {semColor && <span className={`sem ${semColor === 'brand' ? 'brand-dot' : semColor}`} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div className="l">
          {icon && (
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                display: 'inline-grid',
                placeItems: 'center',
                background: 'var(--surface-2)',
                color: 'var(--brand)',
                marginRight: 4
              }}
            >
              <Icon name={icon} style={{ width: 12, height: 12 }} />
            </span>
          )}
          {textLabel}
        </div>
        {deltaNode}
      </div>

      <div className={`v ${typeof value === 'string' && value.length > 10 ? 'numeric-long' : ''}`}>{value}</div>
      {sub != null && sub !== '' && <div className="s">{sub}</div>}
    </div>
  );
};
