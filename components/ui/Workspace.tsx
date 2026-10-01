'use client';
import { Children, cloneElement, isValidElement, useId, type HTMLAttributes, type ReactNode, type TableHTMLAttributes } from 'react';
import { Icon } from '../icons';
import { Button } from './button';
type BoxProps = HTMLAttributes<HTMLDivElement>;
export function PageHeader({ className = '', children, ...props }: BoxProps) { return <header {...props} className={`ph workspace-heading ${className}`}>{children}</header>; }
export function Surface({ className = '', ...props }: BoxProps) { return <div {...props} className={`panel ${className}`} />; }
export function MetricCard({ className = '', ...props }: BoxProps) { return <div {...props} className={`kpi metric-card ${className}`} />; }
export function TableViewport({ className = '', ...props }: BoxProps) { return <div {...props} className={`tbl-wrap ${className}`} tabIndex={0} role="region" aria-label={props['aria-label'] || 'Tabla de datos; desplazamiento horizontal disponible'} />; }
export function DataTable({ className = '', ...props }: TableHTMLAttributes<HTMLTableElement>) { return <table {...props} className={`tbl ${className}`} />; }
type ChildProps = { children?: ReactNode; className?: string; id?: string; htmlFor?: string };
export function Field({ children, className = '', ...props }: BoxProps) {
  const id = useId();
  const parts = Children.toArray(children);
  const control = parts.find(child => isValidElement<ChildProps>(child) && ['input', 'select', 'textarea'].includes(String(child.type)));
  const fieldId = isValidElement<ChildProps>(control) ? control.props.id || id : id;
  return <div {...props} className={`f field ${className}`}>{parts.map(child => {
    if (!isValidElement<ChildProps>(child)) return child;
    if (child.type === 'label') return cloneElement(child, { htmlFor: fieldId });
    if (['input', 'select', 'textarea'].includes(String(child.type))) return cloneElement(child, { id: fieldId });
    return child;
  })}</div>;
}
export function FormGrid({ children, className = '', style, ...props }: BoxProps) {
  // Las columnas se adaptan al contenedor, no a anchos inline por pantalla.
  const { gridTemplateColumns: _columns, ...rest } = style || {};
  return <div {...props} className={`form-grid shared-form-grid ${className}`} style={rest}>{Children.map(children, child => {
    if (isValidElement<ChildProps>(child) && child.type === 'div' && Children.toArray(child.props.children).some(c => isValidElement(c) && c.type === 'label')) return <Field {...child.props} />;
    return child;
  })}</div>;
}
export function EmptyState({ children, title = 'Sin registros', description = 'Los elementos aparecerán aquí cuando estén disponibles.', action }: { children?: ReactNode; title?: string; description?: string; action?: ReactNode }) {
  return <div className="empty-state" role="status"><span className="empty-state-icon"><Icon name="folder" /></span><strong>{children || title}</strong><p>{description}</p>{action}</div>;
}
export function WorkspaceSkeleton() {
  return <div className="workspace-skeleton" role="status" aria-label="Cargando espacio de trabajo" aria-busy="true"><div className="skeleton skeleton-title" /><div className="kpis">{[0,1,2,3].map(n=><div key={n} className="skeleton skeleton-metric" />)}</div><div className="skeleton skeleton-table" /></div>;
}
export function ResourceCard({ title, description, icon, onOpen, actions }: { title: string; description: string; icon: string; onOpen: () => void; actions?: ReactNode }) {
  return <article className="resource-card"><span className="resource-icon"><Icon name={icon} /></span><div className="resource-copy"><h3>{title}</h3><p>{description}</p></div><div className="resource-actions"><Button onClick={onOpen}>Abrir reporte <Icon name="chevron-right" /></Button><details className="action-disclosure"><summary aria-label={`Exportar ${title}`}><Icon name="download" /></summary><div className="action-disclosure-content">{actions}</div></details></div></article>;
}
