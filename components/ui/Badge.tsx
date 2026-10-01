'use client';
import { STATE_BADGE } from '../../lib/catalog';

export const Badge = ({
  text,
  state,
  color
}: {
  text?: string | null;
  state?: string | null;
  color?: string;
}) => {
  const val = text || state;
  if (!val) return null;
  const c = color || STATE_BADGE[val] || 'na';
  return <span className={`badge b-${c}`}>{val}</span>;
};
