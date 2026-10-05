'use client';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService, Store } from '../../../lib/store';
import { EmptyState } from '../../ui/Workspace';
import { Button } from '../../ui/button';
import { Icon } from '../../icons';
import { contractHref } from '../../app/routes';
import type { Contract, DB, Perm } from '../../../lib/types';

/**
 * Punto de entrada de las rutas nuevas del expediente (`/contrato/[id]/<recurso>/…`).
 * Resuelve en el acceso DIRECTO los tres casos que el modal no tenía que afrontar:
 * contrato inexistente, permiso insuficiente y registro huérfano (en edición).
 * Pasa a los hijos la función `volver`, que regresa a la pestaña de origen.
 */
export const ExpedienteRoute = ({
  cid,
  permiso,
  tab,
  registro,
  recurso,
  bloquearAnulado,
  children,
}: {
  cid: string;
  /** Permiso exigido al entrar (el mismo se vuelve a exigir al guardar). */
  permiso: Perm;
  /** Pestaña del expediente a la que regresa el Cancelar. */
  tab: string;
  /** Colección y id del registro a editar; si no existe o es de otro contrato, "no encontrado". */
  registro?: { col: keyof DB; id: string };
  /** Nombre del recurso para el empty state (ej. "ejecución"). */
  recurso: string;
  /** En rutas de edición del PROPIO contrato: bloquear la edición de un expediente anulado. */
  bloquearAnulado?: boolean;
  children: (volver: () => void) => ReactNode;
}) => {
  const router = useRouter();
  const c = Store.get('contracts', cid) as Contract | undefined;
  // can() es puro y se evalúa en render; guard() (que alerta) se reserva para handlers.
  const permitido = AuthService.can(permiso);
  const volver = () => router.push(contractHref(cid, tab));

  const reg = registro ? (Store.get(registro.col, registro.id) as { contractId?: string } | null) : null;
  const ajeno = !!reg && reg.contractId !== cid;
  const anulado = !!c && c.anulado;
  const bloqueado = (!c || !permitido || (registro && !reg)) || (bloquearAnulado && anulado);
  if (bloqueado) {
    const titulo = !c
      ? 'Contrato no encontrado'
      : !permitido
        ? 'Acceso restringido'
        : bloquearAnulado && anulado
          ? 'Expediente anulado'
          : `${recurso.charAt(0).toUpperCase()}${recurso.slice(1)} no encontrada`;
    const detalle = !c
      ? 'El identificador del contrato no existe en el sistema o el registro fue anulado.'
      : !permitido
        ? 'Tu rol no tiene permiso para realizar esta operación en el expediente.'
        : bloquearAnulado && anulado
          ? 'El contrato está anulado: no admite edición. Gestiona una reversión de anulación con el coordinador.'
          : ajeno
            ? 'El registro pertenece a otro contrato del portafolio. Volviendo a la pestaña de origen.'
            : 'El registro ya no existe o fue eliminado. Volviendo a la pestaña de origen.';
    return (
      <div className="anim-fade-rise" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <EmptyState
          title={titulo}
          description={detalle}
          action={
            <Button className="btn pri" onClick={volver} style={{ marginTop: 12 }}>
              <Icon name="chevron-left" /> Volver al expediente
            </Button>
          }
        />
      </div>
    );
  }

  return <>{children(volver)}</>;
};
