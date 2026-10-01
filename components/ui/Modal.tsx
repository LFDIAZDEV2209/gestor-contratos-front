'use client';
export const Modal = ({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) => (
  <div className="overlay" onClick={onClose}>
    <div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-h"><h3>{title}</h3><button className="icon-btn" onClick={onClose}>&times;</button></div>
      <div className="modal-b">{children}</div>
    </div>
  </div>
);
