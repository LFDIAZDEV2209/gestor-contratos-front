'use client';

import { Suspense, use } from 'react';
import { WorkspaceSkeleton } from '@/components/ui/Workspace';
import { useSearchParams } from 'next/navigation';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';
import { DocumentoForm } from '@/components/expediente/forms/DocumentoForm';

/** Contenido con preselección de categoría (?categoria=) — useSearchParams exige límite Suspense. */
function Contenido({ id }: { id: string }) {
  const sp = useSearchParams();
  const cat = sp.get('categoria') || undefined;
  return (
    <ExpedienteRoute cid={id} permiso="crear" tab="documentos" recurso="documento">
      {(volver) => <DocumentoForm cid={id} catInicial={cat} onDone={volver} />}
    </ExpedienteRoute>
  );
}

/** VISTA dedicada: alta de documento del expediente (fila 29). */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <Contenido id={id} />
    </Suspense>
  );
}
