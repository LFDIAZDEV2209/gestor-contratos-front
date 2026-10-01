'use client';
import { STATE_BADGE } from '../../lib/catalog';

export const Badge = ({ text, color }: { text?: string | null; color?: string }) => {
  if (!text) return null;
  const c = color || STATE_BADGE[text] || 'na';
  return <span className={`badge b-${c}`}>{text}</span>;
};
