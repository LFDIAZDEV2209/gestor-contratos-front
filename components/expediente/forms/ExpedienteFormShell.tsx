'use client';
import Link from 'next/link';
import { Children, isValidElement, type ComponentProps, type ReactNode } from 'react';
import { Button } from '../../ui/button';
import { FormGrid, PageHeader, Surface } from '../../ui/Workspace';
import { FormSection } from '../../ui/FormSection';
import { Icon } from '../../icons';
import { Store } from '../../../lib/store';
import { contractHref } from '../../app/routes';
import { AccessibleForm } from '../../forms/AccessibleForm';
import { useFormCancel } from '../../forms/useFormCancel';
export { createFieldValidation } from '../../forms/AccessibleForm';

const sections: Record<string, { icon: string; title: string }> = {
  actas: { icon: 'file-signature', title: 'Datos del acta' },
  documentos: { icon: 'folder-tree', title: 'Identificación y soporte' },
  ejecucion: { icon: 'chart-line', title: 'Informe del periodo' },
  entregables: { icon: 'list-check', title: 'Entregable y seguimiento' },
  entregas: { icon: 'clipboard-check', title: 'Registro de la entrega' },
  garantias: { icon: 'shield', title: 'Póliza, cobertura y vigencia' },
  incumplimientos: { icon: 'alert-circle', title: 'Hecho y seguimiento' },
  modificaciones: { icon: 'code-compare', title: 'Referencia y efecto de la modificación' },
  obligaciones: { icon: 'clipboard-check', title: 'Compromiso y responsables' },
  pagos: { icon: 'money-check-dollar', title: 'Referencia y valores del pago' },
  planes: { icon: 'list-check', title: 'Compromiso y avance' },
  prorrogas: { icon: 'calendar', title: 'Plazo y justificación' },
  reinicios: { icon: 'calendar', title: 'Reinicio y soporte' },
  riesgos: { icon: 'shield', title: 'Evaluación y mitigación' },
  subcontratos: { icon: 'diagram-project', title: 'Datos del subcontrato' },
  suspensiones: { icon: 'calendar', title: 'Suspensión y justificación' },
};

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
  fieldErrors,
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
  fieldErrors: Record<string, string>;
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
  const volver = useFormCancel(contractHref(cid, tab), `/contrato/${encodeURIComponent(cid)}`, onCancel);
  const sectionKey = /plan/i.test(paso) ? 'planes' : /reinicio/i.test(paso) ? 'reinicios'
    : /entrega\b/i.test(paso) ? 'entregas' : tab;
  const section = sections[sectionKey] ?? { icon: 'file-contract', title: 'Datos del registro' };

  return (
    <AccessibleForm errors={fieldErrors} attempted={intentado}>
    <div className="anim-fade-rise" style={{ maxWidth: 1040, margin: '0 auto' }}>
      <PageHeader className="ph">
        <div>
          <nav className="crumb" style={{ width: '100%', marginBottom: 6 }} aria-label="Ruta de navegación">
            <Link href="/contratos">Contratos</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <Link href={contractHref(cid, tab)}>{c ? `Contrato ${c.numero}` : 'Expediente'}</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <span aria-current="page">{paso}</span>
          </nav>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <span className="form-shell-icon" aria-hidden="true"><Icon name={section.icon} size={22} /></span>{title}
          </h1>
          <p style={{ margin: '4px 0 0' }}>{description}</p>
        </div>
      </PageHeader>

      <Surface className="panel mb">{Children.map(children, child => {
        if (!isValidElement<ComponentProps<typeof FormGrid>>(child) || child.type !== FormGrid) return child;
        return <FormSection title={section.title} icon={section.icon} accent
          gridClassName={child.props.className} gridStyle={child.props.style}>
          {child.props.children}
        </FormSection>;
      })}</Surface>

      {nota}


      <div className="form-foot">
        <Button className="btn ghost" onClick={volver}>
          <Icon name="chevron-left" /> Cancelar
        </Button>
        <Button className="btn pri" onClick={onSubmit}>
          <Icon name={submitIcon} /> {submitLabel}
        </Button>
      </div>
    </div>
    </AccessibleForm>
  );
};
