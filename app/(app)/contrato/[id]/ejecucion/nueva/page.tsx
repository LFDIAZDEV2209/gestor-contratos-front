'use client';

import { use } from 'react';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';
import { EjecucionForm } from '@/components/expediente/forms/EjecucionForm';

/** VISTA dedicada: alta de informe mensual de ejecución desde la pestaña (fila 30). */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ExpedienteRoute cid={id} permiso="crear" tab="ejecucion" recurso="ejecución">
      {(volver) => <EjecucionForm cid={id} onDone={volver} />}
    </ExpedienteRoute>
  );
}
