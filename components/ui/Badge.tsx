'use client';

import React from 'react';
import { STATE_BADGE } from '../../lib/catalog';

export interface BadgeProps {
  text?: string | null;
  state?: string | null;
  color?: string;
  dot?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  text,
  state,
  color,
  dot = true,
  className = '',
  style
}) => {
  const val = text || state;
  if (!val) return null;

  const c = color || STATE_BADGE[val] || 'na';

  return (
    <span className={`badge b-${c} ${className}`} style={style}>
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: 'currentColor',
            display: 'inline-block',
            flexShrink: 0
          }}
        />
      )}
      {val}
    </span>
  );
};
