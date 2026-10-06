'use client';

import { useId, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '../icons';
import { FormGrid } from './Workspace';

type FormSectionProps = {
  title: ReactNode;
  icon: string;
  description?: ReactNode;
  badge?: ReactNode;
  accent?: boolean;
  children: ReactNode;
  className?: string;
  gridClassName?: string;
  gridStyle?: CSSProperties;
};

/** Agrupa campos sin alterar sus controles ni la decoración de AccessibleForm. */
export function FormSection({ title, icon, description, badge, accent = false, children,
  className = '', gridClassName = '', gridStyle }: FormSectionProps) {
  const id = useId();
  return <section className={`form-section${accent ? ' form-section-accent' : ''} ${className}`} aria-labelledby={`${id}-title`}>
    <header className="form-section-head form-section-head-brand">
      <span className="form-section-icon" aria-hidden="true"><Icon name={icon} size={18} /></span>
      <div className="form-section-copy">
        <h2 id={`${id}-title`}>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {badge && <span className="form-section-badge">{badge}</span>}
    </header>
    <FormGrid className={gridClassName} style={gridStyle}>{children}</FormGrid>
  </section>;
}
