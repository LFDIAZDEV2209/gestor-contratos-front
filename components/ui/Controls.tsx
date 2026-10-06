'use client';
import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react';
import { Icon } from '../icons';

type IconProps = { icon?: string };

function ControlIcon({ icon, children, multiline = false }: IconProps & { children: ReactNode; multiline?: boolean }) {
  if (!icon) return children;
  return <span className={`field-control-with-icon${multiline ? ' field-control-textarea' : ''}`}>
    <span className="field-control-icon" aria-hidden="true"><Icon name={icon} size={16} /></span>
    {children}
  </span>;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & IconProps>(function Input({className='', icon, ...props}, ref) {
  const leadingIcon = props.type === 'checkbox' || props.type === 'radio' ? undefined : icon;
  return <ControlIcon icon={leadingIcon}><input {...props} ref={ref} className={`control ${className}`} /></ControlIcon>;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & IconProps>(function Select({className='', icon, ...props}, ref) {
  return <ControlIcon icon={icon}><select {...props} ref={ref} className={`control ${className}`} /></ControlIcon>;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & IconProps>(function Textarea({className='', icon, ...props}, ref) {
  return <ControlIcon icon={icon} multiline><textarea {...props} ref={ref} className={`control ${className}`} /></ControlIcon>;
});
