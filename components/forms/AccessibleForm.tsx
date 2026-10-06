'use client';

import { Children, cloneElement, isValidElement, useId, useRef, type ReactElement, type ReactNode } from 'react';
import { Icon } from '../icons';
import { Field } from '../ui/Workspace';
import { Input, Select, Textarea } from '../ui/Controls';
import { fieldIcon } from './fieldIcon';

type ChildProps = { children?: ReactNode; name?: string; id?: string; className?: string; type?: string; icon?: string; 'aria-describedby'?: string };

function labelText(nodes: ReactNode): string {
  return Children.toArray(nodes).map(node => typeof node === 'string' || typeof node === 'number'
    ? String(node) : isValidElement<ChildProps>(node) ? labelText(node.props.children) : '').join(' ');
}

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
  let anonymousControl = 0;
  const decorate = (nodes: ReactNode, label = ''): ReactNode => Children.map(nodes, (node) => {
    if (!isValidElement<ChildProps>(node)) return node;
    const props: Record<string, unknown> = {};
    const fieldLabel = Children.toArray(node.props.children).find(part => isValidElement(part) && part.type === 'label');
    const controlLabel = isValidElement<ChildProps>(fieldLabel) ? labelText(fieldLabel.props.children) : label;
    if (node.props.children !== undefined) props.children = decorate(node.props.children, controlLabel);
    if ([Input, Select, Textarea].some(type => node.type === type)) {
      props.icon = node.props.icon ?? fieldIcon(node.props.name, controlLabel, node.props.type);
    }
    if (node.props.name) {
      const field = node.props.name;
      const occurrence = occurrences[field] = (occurrences[field] ?? 0) + 1;
      const invalid = attempted && !!errors[field];
      props.id = node.props.id ?? `${prefix}-${field}-${occurrence}`;
      props['data-validation-field'] = field;
      props['aria-invalid'] = invalid || undefined;
      props['aria-describedby'] = [node.props['aria-describedby'], invalid ? `${prefix}-error-${field}` : undefined].filter(Boolean).join(' ') || undefined;
    }
    if (node.type === Field) {
      const parts = Children.toArray(props.children as ReactNode);
      const control = parts.find(part => isValidElement<ChildProps>(part) &&
        (!!part.props.name || [Input, Select, Textarea].some(type => part.type === type) || ['input', 'select', 'textarea'].includes(String(part.type))));
      const required = parts.some(part => isValidElement<ChildProps>(part) && part.type === 'label' && part.props.className?.split(' ').includes('req'));
      if (isValidElement<ChildProps>(control)) {
        const controlId = control.props.id ?? `${prefix}-control-${++anonymousControl}`;
        const hintIds: string[] = [];
        props.children = parts.map((part, index) => {
          if (!isValidElement<ChildProps>(part) || !part.props.className?.split(' ').includes('hint')) return part;
          const id = part.props.id ?? `${controlId}-hint-${index}`;
          hintIds.push(id);
          return cloneElement(part, { id });
        }).map(part => part === control ? cloneElement(control as ReactElement<Record<string, unknown>>, {
          id: controlId,
          'aria-required': required || undefined,
          'aria-describedby': [control.props['aria-describedby'], ...hintIds].filter(Boolean).join(' ') || undefined,
        }) : part);
      }
    }
    return cloneElement(node as ReactElement<Record<string, unknown>>, props);
  });

  return <div ref={root} onClickCapture={(event) => {
    const button = (event.target as HTMLElement).closest('button');
    if (button?.closest('.form-foot') && button.classList.contains('pri') && Object.keys(errors).length) {
      focusField(Object.keys(errors)[0]);
    }
  }}>
    {attempted && Object.keys(errors).length > 0 && <section className="form-error-summary" role="alert" aria-label="Errores del formulario">
      <h2><span aria-hidden="true"><Icon name="alert-circle" size={18} /></span>Corrige antes de guardar</h2>
      <ul>{Object.entries(errors).map(([field, message]) => <li key={field} id={`${prefix}-error-${field}`}>
        <button type="button" className="btn ghost" style={{ whiteSpace: 'normal', textAlign: 'left', height: 'auto' }} onClick={() => focusField(field)}>{message}</button>
      </li>)}</ul>
    </section>}
    {decorate(children)}
  </div>;
}
