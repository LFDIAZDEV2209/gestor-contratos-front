'use client';

import { use } from 'react';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';
import { EntregableForm } from '@/components/expediente/forms/EntregableForm';

/** VISTA dedicada: alta de entregable contractual (fila 32). */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ExpedienteRoute cid={id} permiso="crear" tab="entregables" recurso="entregable">
      {(volver) => <EntregableForm cid={id} onDone={volver} />}
    </ExpedienteRoute>
  );
}
