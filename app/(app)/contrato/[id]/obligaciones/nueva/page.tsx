'use client';

import { use } from 'react';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';
import { ObligacionForm } from '@/components/expediente/forms/ObligacionForm';

/** VISTA dedicada: alta de obligación desde la pestaña Obligaciones del expediente. */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ExpedienteRoute cid={id} permiso="crear" tab="obligaciones" recurso="obligación">
      {(volver) => <ObligacionForm cid={id} onDone={volver} />}
    </ExpedienteRoute>
  );
}
