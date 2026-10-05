'use client';

import { use } from 'react';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';
import { PlanForm } from '@/components/expediente/forms/PlanForm';

/** VISTA dedicada: nuevo plan de mejoramiento del expediente (fila 38). */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ExpedienteRoute cid={id} permiso="crear" tab="incumplimientos" recurso="plan">
      {(volver) => <PlanForm cid={id} onDone={volver} />}
    </ExpedienteRoute>
  );
}
