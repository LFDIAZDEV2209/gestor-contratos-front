'use client';

import { use } from 'react';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';
import { ActaForm } from '@/components/expediente/forms/ActaForm';

/** VISTA dedicada: alta de acta desde la pestaña Actas del expediente (fila 27). */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ExpedienteRoute cid={id} permiso="crear" tab="actas" recurso="acta">
      {(volver) => <ActaForm cid={id} onDone={volver} />}
    </ExpedienteRoute>
  );
}
