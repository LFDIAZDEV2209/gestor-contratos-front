'use client';

import { Children, cloneElement, isValidElement, useId, useRef, type ReactElement, type ReactNode } from 'react';

type ChildProps = { children?: ReactNode; name?: string; id?: string; 'aria-describedby'?: string };

/** Conserva el resumen de negocio y su correspondencia explícita con cada campo. */
export function createFieldValidation() {
  const errores: string[] = [];
  const fieldErrors: Record<string, string> = {};
  const addError = (field: string, message: string) => {
    errores.push(message);
    fieldErrors[field] = message;
  };
  return { errores, fieldErrors, addError };
}

/** Asocia la validación de negocio con los controles y permite corregir cada error. */
export function AccessibleForm({ children, errors, attempted, activateField }: {
  children: ReactNode;
  errors: Record<string, string>;
  attempted: boolean;
  activateField?: (field: string) => void;
}) {
  const prefix = useId();
  const root = useRef<HTMLDivElement>(null);
  const focusField = (field: string) => {
    activateField?.(field);
    requestAnimationFrame(() => {
      const control = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-validation-field]') ?? [])
        .find((el) => el.dataset.validationField === field);
      control?.focus({ preventScroll: true });
      control?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };
  const occurrences: Record<string, number> = {};
  const decorate = (nodes: ReactNode): ReactNode => Children.map(nodes, (node) => {
    if (!isValidElement<ChildProps>(node)) return node;
    const props: Record<string, unknown> = {};
    if (node.props.children !== undefined) props.children = decorate(node.props.children);
    if (node.props.name) {
      const field = node.props.name;
      const occurrence = occurrences[field] = (occurrences[field] ?? 0) + 1;
      const invalid = attempted && !!errors[field];
      props.id = node.props.id ?? `${prefix}-${field}-${occurrence}`;
      props['data-validation-field'] = field;
      props['aria-invalid'] = invalid || undefined;
      props['aria-describedby'] = [node.props['aria-describedby'], invalid ? `${prefix}-error-${field}` : undefined].filter(Boolean).join(' ') || undefined;
    }
    return cloneElement(node as ReactElement<Record<string, unknown>>, props);
  });

  return <div ref={root} onClickCapture={(event) => {
    const button = (event.target as HTMLElement).closest('button');
    if (button?.closest('.form-foot') && button.classList.contains('pri') && Object.keys(errors).length) {
      focusField(Object.keys(errors)[0]);
    }
  }}>
    {decorate(children)}
    {attempted && Object.keys(errors).length > 0 && <section className="panel mb" role="alert" aria-label="Errores del formulario">
      <h2 style={{ fontSize: 16 }}>Corrige antes de guardar</h2>
      <ul>{Object.entries(errors).map(([field, message]) => <li key={field} id={`${prefix}-error-${field}`}>
        <button type="button" className="btn ghost" style={{ whiteSpace: 'normal', textAlign: 'left', height: 'auto' }} onClick={() => focusField(field)}>{message}</button>
      </li>)}</ul>
    </section>}
  </div>;
}
