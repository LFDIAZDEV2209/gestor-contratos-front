'use client';

import { useEffect, useState } from 'react';
import { WorkspaceSkeleton } from '@/components/ui/Workspace';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/lib/store';
import { RouteState as EmptyState } from '@/components/expediente/forms/RouteState';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/icons';
import { RiesgoForm } from '@/components/forms/RiesgoForm';

/** VISTA dedicada: registro de un riesgo (reemplaza al modal de RiesgosView). */
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
          description="Tu rol no permite registrar riesgos en la matriz del portafolio."
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
      <RiesgoForm onDone={() => router.push('/riesgos')} />
    </div>
  );
}
