import type { ReactNode } from 'react';
export default function ViewTemplate({ children }: { children: ReactNode }) {
  return <div className="anim-fade-rise">{children}</div>;
}
