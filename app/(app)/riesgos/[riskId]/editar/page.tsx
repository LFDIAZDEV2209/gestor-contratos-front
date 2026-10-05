'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Store, AuthService } from '@/lib/store';
import { EmptyState } from '@/components/ui/Workspace';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/icons';
import { RiesgoForm } from '@/components/forms/RiesgoForm';
import type { Risk } from '@/lib/types';

/** VISTA dedicada: edición de un riesgo (reemplaza al modal de RiesgosView). */
export default function Page({ params }: { params: Promise<{ riskId: string }> }) {
  const { riskId } = use(params);
  const router = useRouter();
  const risk = Store.get('risks', riskId) as Risk | null;
  // can() es puro: sin efectos en render (guard() alerta y se reserva a handlers)
  const permitido = AuthService.can('editar');

  if (!risk || !permitido) {
    return (
      <div className="anim-fade-rise" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <EmptyState
          title={risk ? 'Acceso restringido' : 'Riesgo no encontrado'}
          description={
            risk
              ? 'Tu rol no permite editar riesgos de la matriz.'
              : 'El identificador del riesgo no existe o el registro fue eliminado.'
          }
          action={
            <Button className="btn pri" onClick={() => router.push('/riesgos')} style={{ marginTop: 12 }}>
              <Icon name="chevron-left" /> Volver a Riesgos
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="anim-fade-rise">
      <RiesgoForm initial={{ ...risk }} onDone={() => router.push('/riesgos')} />
    </div>
  );
}
