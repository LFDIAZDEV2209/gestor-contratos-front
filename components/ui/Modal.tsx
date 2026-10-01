'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../icons';
import { Button } from './button';
export interface ModalProps { title: string; subtitle?: string; size?: 'sm' | 'md' | 'lg' | 'xl' | string; onClose: () => void; footer?: ReactNode; children: ReactNode; }
export function Modal({ title, subtitle, size = 'md', onClose, footer, children }: ModalProps) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const app = document.querySelector<HTMLElement>('.app');
    const wasInert = app?.inert || false;
    if (app) app.inert = true;
    const focusable = () => Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]') || []).filter(el => el.getClientRects().length);
    const timer = requestAnimationFrame(() => (panel.current?.querySelector<HTMLElement>('input:not(:disabled),select:not(:disabled),textarea:not(:disabled)') || panel.current)?.focus());
    const keydown = (e: KeyboardEvent) => {
      if (Array.from(document.querySelectorAll('[role="dialog"]')).at(-1) !== panel.current) return;
      if (e.key === 'Escape') { e.preventDefault(); close.current(); }
      if (e.key === 'Tab') {
        const list = focusable();
        if (!list.length) { e.preventDefault(); panel.current?.focus(); return; }
        if (e.shiftKey && (document.activeElement === list[0] || document.activeElement === panel.current)) { e.preventDefault(); list.at(-1)?.focus(); }
        else if (!e.shiftKey && document.activeElement === list.at(-1)) { e.preventDefault(); list[0].focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { cancelAnimationFrame(timer); document.removeEventListener('keydown', keydown); if (app) app.inert = wasInert; previous?.focus(); };
  }, []);
  return createPortal(<div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={panel} className={`modal ${size}`} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={id+'-title'} aria-describedby={subtitle ? id+'-description' : undefined}>
      <div className="modal-h"><div><h2 id={id+'-title'}>{title}</h2>{subtitle && <p id={id+'-description'} className="muted">{subtitle}</p>}</div><Button className="icon-btn" onClick={onClose} aria-label="Cerrar modal"><Icon name="xmark" /></Button></div>
      <div className="modal-b">{children}</div>{footer && <div className="modal-f">{footer}</div>}
    </div>
  </div>, document.body);
}
