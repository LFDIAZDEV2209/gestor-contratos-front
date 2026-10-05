'use client';

import { use } from 'react';
import { notFound,  useRouter } from 'next/navigation';
import { Store, AuthService } from '@/lib/store';
import { RouteState as EmptyState } from '@/components/expediente/forms/RouteState';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/icons';
import { VersionDocumentoForm } from '@/components/forms/VersionDocumentoForm';
import type { Document } from '@/lib/types';

/**
 * VISTA dedicada: nueva versión de un documento
 * (reemplaza al modal "Cargar nueva versión" de DocumentosView).
 */
export default function Page({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = use(params);
  const router = useRouter();
  const doc = Store.get('documents', documentId) as Document | null;
  // can() es puro: sin efectos en render (guard() alerta y se reserva a handlers)
  const permitido = AuthService.can('editar');

  if (permitido && !doc) notFound();
  if (!doc || !permitido) {
    return (
      <div className="anim-fade-rise" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <EmptyState
          title={doc ? 'Acceso restringido' : 'Documento no encontrado'}
          description={
            doc
              ? 'Tu rol no permite versionar documentos del repositorio.'
              : 'El identificador del documento no existe o el registro fue removido.'
          }
          action={
            <Button className="btn pri" onClick={() => router.push('/documentos')} style={{ marginTop: 12 }}>
              <Icon name="chevron-left" /> Volver a Documentos
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="anim-fade-rise">
      <VersionDocumentoForm
        doc={{ ...doc }}
        onDone={() => router.push('/documentos')}
      />
    </div>
  );
}
