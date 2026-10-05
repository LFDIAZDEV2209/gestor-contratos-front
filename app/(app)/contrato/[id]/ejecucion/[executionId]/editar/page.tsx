'use client';

import { use } from 'react';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';
import { EjecucionForm } from '@/components/expediente/forms/EjecucionForm';

/** VISTA dedicada: edición del informe de ejecución (fila 31); valida pertenencia al expediente. */
export default function Page({
  params
}: {
  params: Promise<{ id: string; executionId: string }>;
}) {
  const { id, executionId } = use(params);
  return (
    <ExpedienteRoute
      cid={id}
      permiso="editar"
      tab="ejecucion"
      recurso="ejecución"
      registro={{ col: 'execs', id: executionId }}
    >
      {(volver) => <EjecucionForm cid={id} recordId={executionId} onDone={volver} />}
    </ExpedienteRoute>
  );
}
