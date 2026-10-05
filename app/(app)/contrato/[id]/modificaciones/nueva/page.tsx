'use client';

import { use } from 'react';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';
import { ModificacionForm } from '@/components/expediente/forms/ModificacionForm';

/** VISTA dedicada: nueva modificación contractual (otrosí) del expediente (fila 40). */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ExpedienteRoute cid={id} permiso="editar" tab="modificaciones" recurso="modificación">
      {(volver) => <ModificacionForm cid={id} onDone={volver} />}
    </ExpedienteRoute>
  );
}
