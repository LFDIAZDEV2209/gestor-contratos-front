'use client';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
  size?: 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg';
  loading?: boolean;
};
export function buttonVariants({ variant = 'default', size = 'default' }: Pick<ButtonProps, 'variant' | 'size'> = {}) {
  return cn('btn', ({ default: '', primary: 'pri', outline: '', secondary: '', ghost: 'ghost', destructive: 'dan', link: 'ghost' })[variant], size);
}
// Un solo sistema visual, incluidas las variantes de navegación.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant, size, className, loading, children, type = 'button', ...props }, ref) {
  const specialized = className && /\b(icon-btn|tab|exp-tab-btn|side-collapse-btn|filter-chip|hbtn|heat-cell)\b/.test(className);
  return <button ref={ref} type={type} className={cn(specialized ? '' : buttonVariants({ variant, size }), className)} {...props} aria-label={props['aria-label'] || props.title} disabled={props.disabled || loading} aria-busy={loading || undefined}>
    {loading && <span className="button-spinner" aria-hidden="true" />}{children}
  </button>;
});
