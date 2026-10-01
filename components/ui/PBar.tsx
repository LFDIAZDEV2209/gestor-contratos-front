'use client';

import React from 'react';
import { clamp } from '@/lib/format';

interface PBarProps {
  value: number;
  max?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const PBar: React.FC<PBarProps> = ({
  value,
  max = 100,
  color,
  className = '',
  style = {}
}) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const clamped = clamp(percentage, 0, 100);

  return (
    <div className={`bar ${className}`} style={{ flex: 1, ...style }}>
      <i
        style={{
          width: `${clamped}%`,
          backgroundColor: color || undefined
        }}
      />
    </div>
  );
};
