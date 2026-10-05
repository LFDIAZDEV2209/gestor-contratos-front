'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/lib/store';
import { EmptyState } from '@/components/ui/Workspace';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/icons';
import { SubcontratoForm } from '@/components/forms/SubcontratoForm';

/** VISTA dedicada: creación de subcontratos (reemplaza al modal de SubcontratosView). */
export default function Page() {
  const router = useRouter();
  const [permiso, setPermiso] = useState<boolean | null>(null);

  useEffect(() => {
    // can() es puro (guard() alerta como efecto y solo debe usarse en handlers)
    setPermiso(AuthService.can('crear'));
  }, []);

  if (permiso === null) return null;

  if (!permiso) {
    return (
      <div className="anim-fade-rise" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <EmptyState
          title="Acceso restringido"
          description="Tu rol no permite registrar subcontratos en el portafolio."
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
      <SubcontratoForm onDone={() => router.push('/subcontratos')} />
    </div>
  );
}
