'use client';

import { use } from 'react';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';
import { EntregableForm } from '@/components/expediente/forms/EntregableForm';

/** VISTA dedicada: edición de la ficha del entregable (fila 34). */
export default function Page({
  params
}: {
  params: Promise<{ id: string; deliverableId: string }>;
}) {
  const { id, deliverableId } = use(params);
  return (
    <ExpedienteRoute
      cid={id}
      permiso="editar"
      tab="entregables"
      recurso="entregable"
      registro={{ col: 'deliverables', id: deliverableId }}
    >
      {(volver) => <EntregableForm cid={id} recordId={deliverableId} onDone={volver} />}
    </ExpedienteRoute>
  );
}
