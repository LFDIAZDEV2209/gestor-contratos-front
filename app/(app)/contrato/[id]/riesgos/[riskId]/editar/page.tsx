'use client';

import { use } from 'react';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';
import { RiesgoForm } from '@/components/expediente/forms/RiesgoForm';

/** VISTA dedicada: edición de la evaluación de un riesgo (fila 46). */
export default function Page({
  params
}: {
  params: Promise<{ id: string; riskId: string }>;
}) {
  const { id, riskId } = use(params);
  return (
    <ExpedienteRoute
      cid={id}
      permiso="editar"
      tab="riesgos"
      recurso="riesgo"
      registro={{ col: 'risks', id: riskId }}
    >
      {(volver) => <RiesgoForm cid={id} recordId={riskId} onDone={volver} />}
    </ExpedienteRoute>
  );
}
