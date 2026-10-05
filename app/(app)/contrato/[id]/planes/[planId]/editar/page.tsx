'use client';

import { use } from 'react';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';
import { PlanForm } from '@/components/expediente/forms/PlanForm';

/** VISTA dedicada: gestión del avance de un plan de mejoramiento (fila 39). */
export default function Page({
  params
}: {
  params: Promise<{ id: string; planId: string }>;
}) {
  const { id, planId } = use(params);
  return (
    <ExpedienteRoute
      cid={id}
      permiso="editar"
      tab="incumplimientos"
      recurso="plan"
      registro={{ col: 'plans', id: planId }}
    >
      {(volver) => <PlanForm cid={id} recordId={planId} onDone={volver} />}
    </ExpedienteRoute>
  );
}
