'use client';
import { useEffect } from 'react';
import { Icon } from '../icons';

export const Modal = ({
  title,
  size = 'md',
  onClose,
  footer,
  children
}: {
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const sizeClass = size === 'lg' ? 'modal-lg' : size === 'sm' ? 'modal-sm' : size === 'xl' ? 'modal-xl' : '';

  return (
    <div className="overlay" onClick={onClose}>
      <div className={`modal ${sizeClass}`} onClick={(e) => e.stopPropagation()} style={size === 'lg' ? { maxWidth: 880, width: '92%' } : size === 'xl' ? { maxWidth: 1100, width: '96%' } : {}}>
        <div className="modal-h">
          <h3>{title}</h3>
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
