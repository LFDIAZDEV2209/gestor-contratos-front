'use client';

import React, { useEffect, useRef } from 'react';
import { Icon } from '../icons';

export interface ModalProps {
  title: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  title,
  subtitle,
  size = 'md',
  onClose,
  footer,
  children
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      // Focus containment
      if (e.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Foco inicial accesible
    const timer = setTimeout(() => {
      if (modalRef.current) {
        const first = modalRef.current.querySelector<HTMLElement>('input, select, textarea, button:not([aria-label="Cerrar modal"])');
        if (first) first.focus();
        else modalRef.current.focus();
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      previousFocus.current?.focus();
    };
  }, [onClose]);

  const sizeClass = size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : size === 'xl' ? 'xl' : '';

  return (
    <div
      className="overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-id"
    >
      <div
        className={`modal ${sizeClass}`}
        ref={modalRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{ outline: 'none' }}
      >
        <div className="modal-h">
          <div>
            <h3 id="modal-title-id">{title}</h3>
            {subtitle && (
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: 2 }}>
                {subtitle}
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar modal">
            <Icon name="xmark" />
          </button>
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
};
