'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '../../ui/button';
import { PageHeader, Surface } from '../../ui/Workspace';
import { Icon } from '../../icons';
import { Store } from '../../../lib/store';
import { contractHref } from '../../app/routes';

/**
 * Envoltura canónica de las VISTAS de creación/edición del expediente (modal → página).
 * Réplica la anatomía de `components/forms/EmpresaForm.tsx`: breadcrumb hasta la pestaña
 * de origen, PageHeader con título y descripción, Surface con el formulario,
 * resumen de validación en bloque y footer con Cancelar / Guardar.
 */
export const ExpedienteFormShell = ({
  cid,
  tab,
  paso,
  title,
  description,
  errores,
  intentado = false,
  onSubmit,
  submitLabel,
  submitIcon = 'check',
  onCancel,
  nota,
  children,
}: {
  /** Contrato dueño del registro (segmento `[id]` del expediente). */
  cid: string;
  /** Pestaña de origen: el Cancelar y el breadcrumb vuelven a `/contrato/[id]?tab=`. */
  tab: string;
  /** Último tramo del breadcrumb (ej. "Nueva obligación"). */
  paso: string;
  title: string;
  description: string;
  /** Reglas de negocio del formulario; solo se muestran tras el primer intento de guardado. */
  errores: string[];
  intentado?: boolean;
  onSubmit: () => void;
  submitLabel: string;
  submitIcon?: string;
  onCancel?: () => void;
  /** Contenido secundario bajo el formulario (cálculos, avisos, notas de negocio). */
  nota?: ReactNode;
  children: ReactNode;
}) => {
  const c = Store.get('contracts', cid);
  const volver = onCancel ?? (() => window.history.back());

  return (
    <div className="anim-fade-rise" style={{ maxWidth: 1040, margin: '0 auto' }}>
      <PageHeader className="ph">
        <div>
          <nav className="crumb" style={{ width: '100%', marginBottom: 6 }} aria-label="Ruta de navegación">
            <Link href="/contratos">Contratos</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <Link href={contractHref(cid, tab)}>{c ? `Contrato ${c.numero}` : 'Expediente'}</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <span>{paso}</span>
          </nav>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>{title}</h1>
          <p style={{ margin: '4px 0 0' }}>{description}</p>
        </div>
      </PageHeader>

      <Surface className="panel mb">{children}</Surface>

      {nota}

      {intentado && errores.length > 0 && (
        <Surface className="panel mb" role="alert" style={{ borderColor: 'var(--crit, #c0392b)' }}>
          <b>Atención: corrige antes de guardar</b>
          <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
            {errores.map((e) => (
              <li key={e} style={{ fontSize: 13 }}>
                {e}
              </li>
            ))}
          </ul>
        </Surface>
      )}

      <div className="form-foot">
        <Button className="btn ghost" onClick={volver}>
          <Icon name="chevron-left" /> Cancelar
        </Button>
        <Button className="btn pri" onClick={onSubmit}>
          <Icon name={submitIcon} /> {submitLabel}
        </Button>
      </div>
    </div>
  );
};
