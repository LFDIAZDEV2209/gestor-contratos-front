'use client';

import { use } from 'react';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';
import { IncumplimientoForm } from '@/components/expediente/forms/IncumplimientoForm';

/** VISTA dedicada: alta de incumplimiento contractual (fila 36). */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ExpedienteRoute cid={id} permiso="crear" tab="incumplimientos" recurso="incumplimiento">
      {(volver) => <IncumplimientoForm cid={id} onDone={volver} />}
    </ExpedienteRoute>
  );
}
