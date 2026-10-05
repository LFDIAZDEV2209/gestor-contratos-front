'use client';

import { use } from 'react';
import { notFound,  useRouter } from 'next/navigation';
import { Store, AuthService } from '@/lib/store';
import { RouteState as EmptyState } from '@/components/expediente/forms/RouteState';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/icons';
import { PlanForm } from '@/components/forms/PlanForm';
import type { Plan } from '@/lib/types';

/** VISTA dedicada: edición de un plan de mejoramiento (reemplaza al modal de IncumplimientosView). */
export default function Page({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = use(params);
  const router = useRouter();
  const plan = Store.get('plans', planId) as Plan | null;
  // can() es puro: sin efectos en render (guard() alerta y se reserva a handlers)
  const permitido = AuthService.can('editar');

  if (permitido && !plan) notFound();
  if (!plan || !permitido) {
    return (
      <div className="anim-fade-rise" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <EmptyState
          title={plan ? 'Acceso restringido' : 'Plan de mejoramiento no encontrado'}
          description={
            plan
              ? 'Tu rol no permite editar planes de mejoramiento.'
              : 'El identificador del plan no existe o el registro fue eliminado.'
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
      <PlanForm initial={{ ...plan }} onDone={() => router.push('/incumplimientos')} />
    </div>
  );
}
