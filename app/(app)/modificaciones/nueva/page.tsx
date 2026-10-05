'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/lib/store';
import { EmptyState } from '@/components/ui/Workspace';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/icons';
import { ModificacionForm } from '@/components/forms/ModificacionForm';

/** VISTA dedicada: modificación contractual (reemplaza al modal de ModificacionesView). */
export default function Page() {
  const router = useRouter();
  const [permiso, setPermiso] = useState<boolean | null>(null);

  useEffect(() => {
    // can() es puro (guard() alerta como efecto y solo debe usarse en handlers)
    setPermiso(AuthService.can('editar'));
  }, []);

  if (permiso === null) return null;

  if (!permiso) {
    return (
      <div className="anim-fade-rise" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <EmptyState
          title="Acceso restringido"
          description="Tu rol no permite aplicar modificaciones contractuales."
          action={
            <Button className="btn pri" onClick={() => router.push('/modificaciones')} style={{ marginTop: 12 }}>
              <Icon name="chevron-left" /> Volver a Modificaciones
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="anim-fade-rise">
      <ModificacionForm onDone={() => router.push('/modificaciones')} />
    </div>
  );
}
