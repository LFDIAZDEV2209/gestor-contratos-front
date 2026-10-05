'use client';

import { useEffect, useState } from 'react';
import { WorkspaceSkeleton } from '@/components/ui/Workspace';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/lib/store';
import { RouteState as EmptyState } from '@/components/expediente/forms/RouteState';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/icons';
import { IncumplimientoForm } from '@/components/forms/IncumplimientoForm';

/** VISTA dedicada: registro de incumplimiento (reemplaza al modal de IncumplimientosView). */
export default function Page() {
  const router = useRouter();
  const [permiso, setPermiso] = useState<boolean | null>(null);

  useEffect(() => {
    // can() es puro (guard() alerta como efecto y solo debe usarse en handlers)
    setPermiso(AuthService.can('crear'));
  }, []);

  if (permiso === null) return <WorkspaceSkeleton />;

  if (!permiso) {
    return (
      <div className="anim-fade-rise" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <EmptyState
          title="Acceso restringido"
          description="Tu rol no permite registrar incumplimientos contractuales."
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
      <IncumplimientoForm onDone={() => router.push('/incumplimientos')} />
    </div>
  );
}
