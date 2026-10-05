'use client';

import { use } from 'react';
import { notFound,  useRouter } from 'next/navigation';
import { Store, AuthService } from '@/lib/store';
import { RouteState as EmptyState } from '@/components/expediente/forms/RouteState';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/icons';
import { IncumplimientoForm } from '@/components/forms/IncumplimientoForm';
import type { Breach } from '@/lib/types';

/** VISTA dedicada: edición de un incumplimiento (reemplaza al modal de IncumplimientosView). */
export default function Page({ params }: { params: Promise<{ breachId: string }> }) {
  const { breachId } = use(params);
  const router = useRouter();
  const breach = Store.get('breaches', breachId) as Breach | null;
  // can() es puro: sin efectos en render (guard() alerta y se reserva a handlers)
  const permitido = AuthService.can('editar');

  if (permitido && !breach) notFound();
  if (!breach || !permitido) {
    return (
      <div className="anim-fade-rise" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <EmptyState
          title={breach ? 'Acceso restringido' : 'Incumplimiento no encontrado'}
          description={
            breach
              ? 'Tu rol no permite editar incumplimientos.'
              : 'El identificador del incumplimiento no existe o el registro fue eliminado.'
          }
          action={
            <Button
              className="btn pri"
              onClick={() => router.push('/incumplimientos')}
              style={{ marginTop: 12 }}
            >
              <Icon name="chevron-left" /> Volver a Incumplimientos
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="anim-fade-rise">
      <IncumplimientoForm initial={{ ...breach }} onDone={() => router.push('/incumplimientos')} />
    </div>
  );
}
