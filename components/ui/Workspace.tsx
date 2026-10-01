'use client';
import { Children, cloneElement, isValidElement, useId, type HTMLAttributes, type ReactNode, type TableHTMLAttributes } from 'react';
import { Icon } from '../icons';
import { Button } from './button';
import { Input, Select, Textarea } from './Controls';
type BoxProps = HTMLAttributes<HTMLDivElement>;
export function PageHeader({ className = '', children, ...props }: BoxProps) { return <header {...props} className={`ph workspace-heading ${className}`}>{children}</header>; }
export function Surface({ className = '', ...props }: BoxProps) { return <div {...props} className={`panel ${className}`} />; }
export function MetricCard({ className = '', ...props }: BoxProps) { return <div {...props} className={`kpi metric-card ${className}`} />; }
export function TableViewport({ className = '', ...props }: BoxProps) { return <div {...props} className={`tbl-wrap ${className}`} tabIndex={0} role="region" aria-label={props['aria-label'] || 'Tabla de datos; desplazamiento horizontal disponible'} />; }
export function DataTable({ className = '', children, layout = 'compact', ...props }: TableHTMLAttributes<HTMLTableElement> & { layout?: 'compact' | 'readable' }) {
  const body = Children.toArray(children).find(child=>isValidElement<ChildProps>(child) && child.type === 'tbody');
  const rows = isValidElement<ChildProps>(body) ? Children.toArray(body.props.children).filter(Boolean) : [];
  const cells = rows.length === 1 && isValidElement<ChildProps>(rows[0]) ? Children.toArray(rows[0].props.children) : [];
  const cell = cells.length === 1 && isValidElement<ChildProps & { colSpan?: number }>(cells[0]) ? cells[0] : null;
  if (cell && cell.props.colSpan && cell.props.className?.includes('empty')) return <EmptyState description="Los registros aparecerán en esta sección cuando estén disponibles.">{cell.props.children}</EmptyState>;
  return <table {...props} className={`tbl ${layout === 'readable' ? 'tbl-readable' : ''} ${className}`}>{children}</table>;
}
type ChildProps = { children?: ReactNode; className?: string; id?: string; htmlFor?: string };
export function Field({ children, className = '', ...props }: BoxProps) {
  const id = useId();
  const parts = Children.toArray(children);
  const isControl = (child: ReactNode) => isValidElement<ChildProps>(child) && (['input', 'select', 'textarea'].includes(String(child.type)) || child.type === Input || child.type === Select || child.type === Textarea);
  const control = parts.find(isControl);
  const fieldId = isValidElement<ChildProps>(control) ? control.props.id || id : id;
  return <div {...props} className={`f field ${className}`}>{parts.map(child => {
    if (!isValidElement<ChildProps>(child)) return child;
    if (child.type === 'label') return cloneElement(child, { htmlFor: fieldId });
    if (isControl(child)) return cloneElement(child, { id: fieldId });
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
export function ExpedienteSkeleton() {
  return <div className="workspace-skeleton" role="status" aria-label="Cargando expediente" aria-busy="true"><div className="skeleton skeleton-contract-header" /><div className="skeleton skeleton-tabs" /><div className="kpis">{[0,1,2,3,4,5].map(n => <div key={n} className="skeleton skeleton-metric" />)}</div><div className="skeleton skeleton-table" /></div>;
}
export function ResourceCard({ title, description, icon, onOpen, actions }: { title: string; description: string; icon: string; onOpen: () => void; actions?: ReactNode }) {
  return <article className="resource-card"><span className="resource-icon"><Icon name={icon} /></span><div className="resource-copy"><h3>{title}</h3><p>{description}</p></div><div className="resource-actions"><Button onClick={onOpen}>Abrir reporte <Icon name="chevron-right" /></Button><details className="action-disclosure"><summary aria-label={`Exportar ${title}`}><Icon name="download" /></summary><div className="action-disclosure-content">{actions}</div></details></div></article>;
}
