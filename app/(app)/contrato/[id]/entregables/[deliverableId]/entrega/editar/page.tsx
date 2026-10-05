'use client';

import { use } from 'react';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';
import { EntregaForm } from '@/components/expediente/forms/EntregaForm';

/** VISTA dedicada: gestión de la entrega del entregable (fila 33) — seguimiento, no confirmación. */
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
      recurso="entrega"
      registro={{ col: 'deliverables', id: deliverableId }}
    >
      {(volver) => <EntregaForm cid={id} recordId={deliverableId} onDone={volver} />}
    </ExpedienteRoute>
  );
}
