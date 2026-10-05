'use client';

import { Suspense, useEffect, useState } from 'react';
import { WorkspaceSkeleton } from '@/components/ui/Workspace';
import { useRouter, useSearchParams, notFound } from 'next/navigation';
import { Alerts } from '@/lib/alerts';
import { AuthService } from '@/lib/store';
import { RouteState as EmptyState } from '@/components/expediente/forms/RouteState';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/icons';
import { TareaForm } from '@/components/forms/TareaForm';
import type { Alert } from '@/lib/types';

/**
 * Componente interno: lee la clave de alerta (query) y la recupera desde
 * Alerts.compute() con las claves estables del motor de alertas. Sin alerta
 * (clave inexistente, inválida o caducada) muestra un empty state con retorno.
 */
function TareaDesdeAlerta() {
  const router = useRouter();
  const search = useSearchParams();
  const alertKey = search.get('alertKey') || '';
  const alerts: Alert[] = Alerts.compute();
  const alert = alertKey
    ? alerts.find((a) => a.key === alertKey)
    : undefined;
  const [permiso, setPermiso] = useState<boolean | null>(null);

  useEffect(() => {
    // can() es puro (guard() alerta como efecto y solo debe usarse en handlers)
    setPermiso(AuthService.can('crear'));
  }, []);

  if (permiso === null) return <WorkspaceSkeleton />;
  if (permiso && alertKey && !alert) notFound();

  if (!alert || !permiso) {
    return (
      <div className="anim-fade-rise" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <EmptyState
          title={!alert ? 'Alerta no encontrada' : 'Acceso restringido'}
          description={
            !alert
              ? 'La alerta ya fue gestionada o la clave del enlace no es válida. Verifícala desde el centro de alertas.'
              : 'Tu rol no permite crear tareas de seguimiento desde alertas.'
          }
          action={
            <Button
              className="btn pri"
              onClick={() => router.push('/alertas')}
              style={{ marginTop: 12 }}
            >
              <Icon name="chevron-left" /> Volver a Alertas
            </Button>
          }
        />
      </div>
    );
  }

  return <TareaForm alert={alert} onDone={() => router.push('/alertas')} />;
}

/** VISTA dedicada: creación de tarea desde alerta (reemplaza al modal de AlertasView). */
export default function Page() {
  return (
    <div className="anim-fade-rise">
      <Suspense fallback={<WorkspaceSkeleton />}>
        <TareaDesdeAlerta />
      </Suspense>
    </div>
  );
}
