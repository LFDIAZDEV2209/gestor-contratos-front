'use client';
import { Children, cloneElement, isValidElement, useEffect, useId, useRef, useState, type HTMLAttributes, type ReactNode, type TableHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Icon } from '../icons';
import { Button } from './button';
import { Input, Select, Textarea } from './Controls';
type BoxProps = HTMLAttributes<HTMLDivElement>;
export function PageHeader({ className = '', variant = 'plain', children, ...props }: BoxProps & { variant?: 'plain' | 'hero' }) { return <header {...props} className={`ph workspace-heading ${variant === 'hero' ? 'page-hero' : ''} ${className}`}>{children}</header>; }
export function Surface({ className = '', ...props }: BoxProps) { return <div {...props} className={`panel ${className}`} />; }
export function MetricCard({ className = '', ...props }: BoxProps) { return <div {...props} className={`kpi metric-card ${className}`} />; }
// Tabla con affordance de scroll reactiva: 'none' (sin overflow, sin hint),
// 'true' (fin del desplazamiento alcanzado) o sin atributo (hint persistente).
export function TableViewport({ className = '', ...props }: BoxProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const update = () => {
    const el = ref.current;
    if (!el) return;
    const overflow = el.scrollWidth - el.clientWidth;
    if (overflow <= 2) {
      el.setAttribute('data-scrolled-end', 'none');
      return;
    }
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) el.setAttribute('data-scrolled-end', 'true');
    else el.removeAttribute('data-scrolled-end');
  };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const resize = new ResizeObserver(update);
    const mutation = new MutationObserver(update);
    resize.observe(el);
    mutation.observe(el, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', update);
    update();
    return () => { resize.disconnect(); mutation.disconnect(); window.removeEventListener('resize', update); };
  }, []);
  return <div ref={ref} onScroll={update} {...props} className={`tbl-wrap ${className}`} tabIndex={0} role={props['aria-label'] ? 'region' : undefined} />;
}

type TableCellProps = HTMLAttributes<HTMLTableCellElement> & { colSpan?: number; scope?: string };
const responsiveLists = new Set(['pagos', 'incumplimientos', 'ejecucion', 'contratos', 'aseguradoras', 'empresas', 'garantias', 'documentos', 'obligaciones', 'actas', 'modificaciones', 'riesgos', 'subcontratos', 'alertas', 'auditoria', 'agenda']);
// Explicit priorities for the dense lists; secondary values remain in the row disclosure.
const tablePriorities: Record<string, { wide: string[]; narrow: string[] }> = {
  pagos: { wide: ['Factura', 'Periodo', 'IVA', 'Retenciones', 'Soporte'], narrow: ['Bruto', 'Fecha'] },
  incumplimientos: { wide: ['ID', 'Plan de acción', 'Responsable', 'Fecha inicio'], narrow: ['Fecha', 'Tipo', 'Multa', 'Fecha compromiso'] },
  ejecucion: { wide: ['Empresa', 'Contratista', 'Valor Actualizado', 'Proyección Agotamiento'], narrow: ['Saldo', 'Brecha'] },
  contratos: { wide: ['Empresa'], narrow: ['Avance Fin.', 'Días Restantes'] },
  aseguradoras: { wide: ['Tomador', 'Inicio'], narrow: ['Valor Cupo', 'Utilizado', 'Valor Contrato'] },
  empresas: { wide: [], narrow: ['Representante Legal', 'Naturaleza'] },
  garantias: { wide: ['Modalidad', 'Inicio', 'Días Restantes'], narrow: ['Tipo de Garantía', 'Valor Asegurado'] },
  documentos: { wide: ['Archivo Actual', 'Usuario'], narrow: ['Versión', 'Fecha'] },
  obligaciones: { wide: ['Responsable', 'Verificado'], narrow: ['Tipo'] },
  actas: { wide: ['Firmantes', 'Soporte'], narrow: ['Tipo de Acta', 'Fecha'] },
  modificaciones: { wide: ['Nuevo Texto', 'Soporte', 'Cambio de Plazo'], narrow: ['Fecha', 'Cambio de Valor'] },
  riesgos: { wide: ['ID', 'Mitigación', 'Responsable'], narrow: ['Categoría', 'P', 'I'] },
  subcontratos: { wide: [], narrow: ['Vigencia', 'Objeto'] },
  auditoria: { wide: ['Rol', 'Campo', 'Anterior', 'Nuevo'], narrow: ['Observación'] },
  agenda: { wide: ['Empresa', 'Inicio', 'Responsable'], narrow: ['Objeto', 'Terminación'] },
};
// Opt-in profiles keep unrelated expediente tables and visualizations unchanged.
const expedienteTablePriorities = {
  pagos: { wide: ['Periodo', 'IVA', 'Retenciones', 'Soporte'], narrow: ['Bruto', 'Fecha'] },
  modificaciones: { wide: ['Detalle / Sujeto', 'Soporte', 'Impacto plazo'], narrow: ['Fecha trámite', 'Impacto económico'] },
  riesgos: { wide: ['Categoría', 'Tratamiento'], narrow: ['P', 'I'] },
  incumplimientos: { wide: ['Obligación asociada', 'Medida / Sanción'], narrow: ['Fecha reporte', 'Tipo de falta'] },
  planes: { wide: ['Causa raíz', 'Responsable'], narrow: ['Hallazgo observado'] },
  subcontratos: { wide: ['NIT', 'Inicio', 'Responsable', 'Objeto'], narrow: ['Terminación'] },
};
type ResponsiveTableProfile = keyof typeof expedienteTablePriorities;
function tableText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(tableText).filter(Boolean).join(' ');
  if (!isValidElement<{ children?: ReactNode; text?: string; title?: string }>(node)) return '';
  return tableText(node.props.children) || node.props.text || node.props.title || '';
}

// Native links/buttons keep their callbacks and keyboard behavior in the shared dropdown.
export function TableRowDropdown({ label, children, actions = false }: { label: string; children: ReactNode; actions?: boolean }) {
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!position) return;
    popup.current?.focus({ preventScroll: true });
    const outside = (event: Event) => {
      if (!popup.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setPosition(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setPosition(null); trigger.current?.focus(); }
    };
    const close = () => setPosition(null);
    const anchor = trigger.current?.getBoundingClientRect();
    const scroll = (event: Event) => {
      const rect = trigger.current?.getBoundingClientRect();
      // A queued scroll from bringing the trigger into view must not close the new popup.
      if (!popup.current?.contains(event.target as Node) && rect && anchor && (rect.top !== anchor.top || rect.left !== anchor.left)) close();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', scroll, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', scroll, true);
    };
  }, [position]);
  return <>
    <Button ref={trigger} className="icon-btn tbl-row-trigger" title={label} aria-label={label} aria-haspopup="dialog" aria-expanded={!!position} aria-controls={position ? id : undefined} onClick={(event) => {
      event.stopPropagation();
      if (position) { setPosition(null); return; }
      const rect = event.currentTarget.getBoundingClientRect();
      const width = Math.min(360, window.innerWidth - 24);
      const top = Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - Math.min(420, window.innerHeight * .65) - 12));
      setPosition({ top, left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)), width });
    }}><Icon name={actions ? 'ellipsis' : 'info-circle'} /></Button>
    {position && createPortal(<div ref={popup} id={id} className={`dropdown tbl-row-dropdown ${actions ? 'tbl-row-menu' : ''}`} role="dialog" aria-label={label} tabIndex={-1} style={{ position: 'fixed', ...position }} onClick={(event) => {
      event.stopPropagation();
      if (actions && (event.target as HTMLElement).closest('button, a')) { setPosition(null); trigger.current?.focus(); }
    }}><div className="dd-h">{label}<Button className="icon-btn" aria-label="Cerrar detalle" onClick={() => { setPosition(null); trigger.current?.focus(); }}><Icon name="x" /></Button></div>{children}</div>, document.body)}
  </>;
}

function compactActions(children: ReactNode): ReactNode {
  const parts = Children.toArray(children);
  if (parts.length === 1 && isValidElement<ChildProps>(parts[0]) && parts[0].type === 'div') return compactActions(parts[0].props.children);
  const visible = parts.filter(part => !isValidElement<TableCellProps>(part) || part.props.style?.display !== 'none');
  if (visible.length < 3) return <span className="tbl-row-actions">{visible}</span>;
  return <span className="tbl-row-actions">{visible[0]}<TableRowDropdown label="Más acciones de la fila" actions>{visible.slice(1).map((part, i) => {
    if (!isValidElement<TableCellProps>(part)) return part;
    return cloneElement(part, { key: part.key || i, children: <>{part.props.children}<span>{part.props.title || part.props['aria-label'] || 'Abrir'}</span></> });
  })}</TableRowDropdown></span>;
}

export function DataTable({ className = '', children, layout = 'compact', responsiveProfile, ...props }: TableHTMLAttributes<HTMLTableElement> & { layout?: 'compact' | 'readable'; responsiveProfile?: ResponsiveTableProfile }) {
  const route = usePathname()?.split('/').filter(Boolean).join('/') || '';
  const body = Children.toArray(children).find(child=>isValidElement<ChildProps>(child) && child.type === 'tbody');
  const rows = isValidElement<ChildProps>(body) ? Children.toArray(body.props.children).filter(Boolean) : [];
  const cells = rows.length === 1 && isValidElement<ChildProps>(rows[0]) ? Children.toArray(rows[0].props.children) : [];
  const cell = cells.length === 1 && isValidElement<ChildProps & { colSpan?: number }>(cells[0]) ? cells[0] : null;
  if (cell && cell.props.colSpan && cell.props.className?.includes('empty')) return <EmptyState description="Los registros aparecerán en esta sección cuando estén disponibles.">{cell.props.children}</EmptyState>;
  const responsive = !!responsiveProfile || responsiveLists.has(route);
  const head = Children.toArray(children).find(child => isValidElement<ChildProps>(child) && child.type === 'thead');
  const headRow = isValidElement<ChildProps>(head) ? Children.toArray(head.props.children)[0] : null;
  const headers = isValidElement<ChildProps>(headRow) ? Children.toArray(headRow.props.children) : [];
  const labels = headers.map(tableText).map(text => text.trim());
  const priorities = responsiveProfile ? expedienteTablePriorities[responsiveProfile] : tablePriorities[route];
  const columnClass = (index: number) => {
    const label = labels[index];
    if (priorities?.wide.includes(label)) return 'col-hide-wide';
    if (priorities?.narrow.includes(label)) return 'col-hide';
    // Extra dynamic insurer columns and optional lists retain full values in row details.
    if (!priorities && headers.length > 7 && index > 2 && index < headers.length - 2) return 'col-hide';
    if (route === 'aseguradoras' && labels[0] === 'Contrato' && index >= 5 && index < labels.length - 1) return 'col-hide';
    return '';
  };
  const renderSection = (section: ReactNode) => {
    if (!responsive || !isValidElement<ChildProps>(section) || !['thead', 'tbody'].includes(String(section.type))) return section;
    return cloneElement(section, { children: Children.map(section.props.children, row => {
      if (!isValidElement<ChildProps>(row) || row.type !== 'tr') return row;
      const rowCells = Children.toArray(row.props.children);
      if (rowCells.some(cell => isValidElement<TableCellProps>(cell) && cell.props.colSpan)) return row;
      const identity = tableText(rowCells[labels[0] === 'Sem' ? 1 : 0]);
      const actionIndex = labels.findIndex(label => label === 'Acciones');
      const detailIndex = actionIndex >= 0 ? actionIndex : 0;
      return cloneElement(row, { children: rowCells.map((cell, index) => {
        if (!isValidElement<TableCellProps>(cell)) return cell;
        const action = index === actionIndex;
        const fullText = tableText(cell.props.children);
        const textColumn = /descripci|objeto|contratista|empresa|aseguradora|tomador|responsable|acción|compromiso|justificaci|razón social|representante|mitigaci|observaci|nombre|archivo/i.test(labels[index]) || (!!responsiveProfile && /evento|tratamiento|medida|hallazgo|causa|detalle/i.test(labels[index]));
        const { width: _width, minWidth: _minWidth, maxWidth: _maxWidth, ...style } = cell.props.style || {};
        const bodyCell = cell.type === 'td';
        return cloneElement(cell, {
          className: `${cell.props.className || ''} ${columnClass(index)} ${action ? 'tbl-actions-cell' : textColumn ? 'tbl-text-cell' : ''}`,
          style,
          scope: cell.type === 'th' ? 'col' : cell.props.scope,
          title: bodyCell ? [cell.props.title, fullText].filter(Boolean).join(' · ') || undefined : cell.props.title,
          children: <>{bodyCell && action ? compactActions(cell.props.children) : cell.props.children}{bodyCell && index === detailIndex && <TableRowDropdown label={`Detalle de la fila ${identity}`}><dl className="tbl-row-detail">{rowCells.map((value, i) => i !== actionIndex && isValidElement<TableCellProps>(value) ? <div key={i}><dt>{labels[i]}</dt><dd>{value.props.children}</dd></div> : null)}</dl></TableRowDropdown>}</>,
        });
      }) });
    }) });
  };
  return <table {...props} className={`tbl ${responsive ? 'tbl-responsive' : ''} ${layout === 'readable' ? 'tbl-readable' : ''} ${className}`}>{Children.map(children, renderSection)}</table>;
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
  return <article className="resource-card"><span className="resource-icon"><Icon name={icon} /></span><div className="resource-copy"><h3 aria-level={2}>{title}</h3><p>{description}</p></div><div className="resource-actions"><Button onClick={onOpen}>Abrir reporte <Icon name="chevron-right" /></Button><details className="action-disclosure"><summary aria-label={`Exportar ${title}`}><Icon name="download" /></summary><div className="action-disclosure-content">{actions}</div></details></div></article>;
}
