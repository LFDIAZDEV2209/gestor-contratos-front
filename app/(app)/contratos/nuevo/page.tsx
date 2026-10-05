'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/lib/store';
import { EmptyState } from '@/components/ui/Workspace';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/icons';
import { ContratoForm } from '@/components/forms/ContratoForm';

/** VISTA dedicada: registro de nuevo contrato (reemplaza al modal de ContratosView). */
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
          description="Tu rol no permite registrar contratos en el portafolio."
          action={
            <Button className="btn pri" onClick={() => router.push('/contratos')} style={{ marginTop: 12 }}>
              <Icon name="chevron-left" /> Volver a Contratos
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="anim-fade-rise" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <ContratoForm onDone={(id) => router.push('/contratos')} />
    </div>
  );
}
