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
//   Las demás: superficie blanca + acento superior + tile de icono con gradiente y sombra de color.
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
      deltaNode = <span className={`badge ${deltaClass}`} style={{ fontSize: '10px', padding: '1px 6px' }}>{delta}</span>;
    } else {
      const deltaClass = delta.type === 'up' ? 'b-ok' : delta.type === 'down' ? 'b-crit' : 'b-na';
      const arrow = delta.type === 'up' ? '▲ ' : delta.type === 'down' ? '▼ ' : '';
      deltaNode = <span className={`badge ${deltaClass}`} style={{ fontSize: '10px', padding: '1px 6px' }}>{arrow}{delta.value}</span>;
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
      {icon && (
        <span className="kpi-ic" aria-hidden="true">
          <Icon name={icon} style={{ width: 18, height: 18 }} />
        </span>
      )}
      <div className="kpi-bd">
        <div className="kpi-l">
          <span className="kpi-lt">{label || title}</span>
          {deltaNode}
        </div>
        <div className={`kpi-v ${typeof value === 'string' && value.length > 10 ? 'numeric-long' : ''}`}>{value}</div>
        {sub != null && sub !== '' && <div className="kpi-s">{sub}</div>}
      </div>
      {sem && <span className={`sem ${sem === 'brand' ? 'brand-dot' : sem}`} />}
    </div>
  );
};

export { Kpi as default, Kpi };
