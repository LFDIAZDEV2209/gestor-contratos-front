'use client';

import React from 'react';
import { Icon } from '../icons';

export interface SectionHeaderProps {
  /** Nombre del icono (vía helper `Icon` de components/icons.tsx). */
  icon?: string;
  title: string;
  /** Descripción corta opcional bajo el título. */
  description?: React.ReactNode;
  /** Slot de acción alineado a la derecha (botones, enlaces, contadores). */
  action?: React.ReactNode;
  /** Nivel semántico del título (por defecto h2). */
  as?: 'h2' | 'h3' | 'h4';
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}

// Subheader reutilizable de sección: icono + título + descripción corta + acción a la derecha.
// Estilos en app/globals.css (bloque UI PASS: agy-dashboard, clases .ws-section*).
const SectionHeader: React.FC<SectionHeaderProps> = ({
  icon,
  title,
  description,
  action,
  as: level = 'h2',
  id,
  className = '',
  style
}) => {
  // Las vistas declaraban h3/h4 bajo el h1 de página; se baja un nivel para no saltar encabezados (a11y heading-order).
  const Heading = level === 'h4' ? 'h3' : 'h2';
  return (
  <div className={`ws-section-h ${className}`.trim()} style={style}>
    <div className="ws-section-id">
      {icon && (
        <span className="ws-section-ic" aria-hidden="true">
          <Icon name={icon} size={16} />
        </span>
      )}
      <div className="ws-section-copy">
        <Heading id={id} className="ws-section-t">
          {title}
        </Heading>
        {description && <p className="ws-section-d">{description}</p>}
      </div>
    </div>
    {action && <div className="ws-section-a">{action}</div>}
  </div>
  );
};

export { SectionHeader };
export default SectionHeader;
