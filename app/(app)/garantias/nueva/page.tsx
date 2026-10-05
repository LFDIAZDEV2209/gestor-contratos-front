'use client';

import { useEffect, useState } from 'react';
import { WorkspaceSkeleton } from '@/components/ui/Workspace';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/lib/store';
import { RouteState as EmptyState } from '@/components/expediente/forms/RouteState';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/icons';
import { GarantiaForm } from '@/components/forms/GarantiaForm';

/** VISTA dedicada: creación de póliza de garantía (reemplaza al modal de GarantiasView). */
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
          description="Tu rol no permite registrar pólizas de garantía."
          action={
            <Button className="btn pri" onClick={() => router.push('/garantias')} style={{ marginTop: 12 }}>
              <Icon name="chevron-left" /> Volver a Garantías
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="anim-fade-rise">
      <GarantiaForm onDone={() => router.push('/garantias')} />
    </div>
  );
}
