'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Store, AuthService } from '@/lib/store';
import { EmptyState } from '@/components/ui/Workspace';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/icons';
import { SubcontratoForm } from '@/components/forms/SubcontratoForm';
import type { Subcontract } from '@/lib/types';

/** VISTA dedicada: edición de un subcontrato (sin modal). */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const sub = Store.get('subcontracts', id) as Subcontract | null;
  // can() es puro: sin efectos en render (guard() alerta y se reserva a handlers)
  const permitido = AuthService.can('editar');

  if (!sub || !permitido) {
    return (
      <div className="anim-fade-rise" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <EmptyState
          title={sub ? 'Acceso restringido' : 'Subcontrato no encontrado'}
          description={
            sub
              ? 'Tu rol no permite editar subcontratos del portafolio.'
              : 'El identificador del subcontrato no existe o el registro fue eliminado.'
          }
          action={
            <Button className="btn pri" onClick={() => router.push('/subcontratos')} style={{ marginTop: 12 }}>
              <Icon name="chevron-left" /> Volver a Subcontratos
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="anim-fade-rise">
      <SubcontratoForm initial={{ ...sub }} onDone={() => router.push('/subcontratos')} />
    </div>
  );
}
