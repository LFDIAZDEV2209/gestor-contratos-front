'use client';
export const Badge = ({ text, color = 'na' }: { text: string, color?: string }) => (
  <span className={`badge b-${color}`}>{text}</span>
);
