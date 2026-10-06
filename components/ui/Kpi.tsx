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

// Tarjeta estadística canónica (idéntica en toda la plataforma).
// - `color` semántico: ok | warn | risk | crit | na | info | brand
// - `brand` renderiza la variante destacada invertida (gradiente de marca, texto blanco).
//   Las demás: superficie blanca + acento superior + tile de icono tintado.
const Kpi: React.FC<KpiProps> = ({
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
  const tone = color || sem || 'brand';
  const isInverse = tone === 'brand';

  // Delta (▲/▼) como chip compacto junto a la etiqueta
  let deltaNode: React.ReactNode = null;
  if (delta) {
    if (typeof delta === 'string') {
      const isUp = delta.startsWith('+') || delta.includes('▲');
      const isDown = delta.startsWith('-') || delta.includes('▼');
      const deltaClass = isUp ? 'b-ok' : isDown ? 'b-crit' : 'b-na';
      deltaNode = <span className={`badge kpi-delta ${deltaClass}`}>{delta}</span>;
    } else {
      const deltaClass = delta.type === 'up' ? 'b-ok' : delta.type === 'down' ? 'b-crit' : 'b-na';
      const direction = delta.type === 'up' ? 'Aumento' : delta.type === 'down' ? 'Disminución' : 'Variación';
      deltaNode = (
        <span className={`badge kpi-delta ${deltaClass}`} aria-label={`${direction}: ${delta.value}`}>
          {delta.type && delta.type !== 'neutral' && (
            <span className={`kpi-delta-icon ${delta.type}`} aria-hidden="true">
              <Icon name="chevron-down" size={11} />
            </span>
          )}
          {delta.value}
        </span>
      );
    }
  }

  return (
    <div
      className={`kpi kpi-v2 ${isInverse ? 'inv' : `c-${tone}` || ''} ${onClick ? 'click' : ''} ${className}`.replace('  ', ' ')}
      style={style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="kpi-bd">
        <div className="kpi-l">
          <span className="kpi-lt">{label || title}</span>
          {deltaNode}
        </div>
        <div className="kpi-metric">
          <div className="kpi-figures">
            <div className={`kpi-v ${String(value).length > 10 ? 'numeric-long' : ''}`}>{value}</div>
            {sub != null && sub !== '' && <div className="kpi-s">{sub}</div>}
          </div>
          {icon && (
            <span className="kpi-ic" aria-hidden="true">
              <Icon name={icon} size={16} />
            </span>
          )}
        </div>
      </div>
      {sem && <span className={`sem ${sem === 'brand' ? 'brand-dot' : sem}`} aria-hidden="true" />}
    </div>
  );
};

export { Kpi as default, Kpi };
