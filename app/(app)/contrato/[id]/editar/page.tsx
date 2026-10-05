'use client';

import { use } from 'react';
import { notFound,  useRouter } from 'next/navigation';
import { Store, AuthService } from '@/lib/store';
import { RouteState as EmptyState } from '@/components/expediente/forms/RouteState';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/icons';
import { ContratoForm } from '@/components/forms/ContratoForm';
import { contractHref } from '@/components/app/routes';
import type { Contract } from '@/lib/types';

/** VISTA dedicada: edición del expediente contractual (reemplaza al modal de ExpedienteView). */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const contract = Store.get('contracts', id) as Contract | undefined;
  // can() es puro: sin efectos en render (guard() alerta y se reserva a handlers)
  const permitido = AuthService.can('editar');

  const resumen = !contract
    ? { ruta: '/contratos', texto: 'Volver a Contratos' }
    : !permitido
      ? { ruta: '/contratos', texto: 'Volver a Contratos' }
      : { ruta: contractHref(id), texto: 'Volver al contrato' };

  if (permitido && !contract) notFound();
  if (!contract || !permitido || contract.anulado) {
    return (
      <div className="anim-fade-rise" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <EmptyState
          title={!contract ? 'Contrato no encontrado' : contract.anulado ? 'Contrato anulado' : 'Acceso restringido'}
          description={
            !contract
              ? 'El identificador del contrato no existe en el sistema o el registro fue eliminado.'
              : contract.anulado
                ? 'Los contratos anulados pasan a solo consulta; no pueden editarse.'
                : 'Tu rol no permite editar contratos.'
          }
          action={
            <Button className="btn pri" onClick={() => router.push(resumen.ruta)} style={{ marginTop: 12 }}>
              <Icon name="chevron-left" /> {resumen.texto}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="anim-fade-rise" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <ContratoForm initial={{ ...contract }} onDone={() => router.push(contractHref(id, 'info'))} />
    </div>
  );
}
