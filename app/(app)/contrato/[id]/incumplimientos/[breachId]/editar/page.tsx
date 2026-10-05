'use client';

import { use } from 'react';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';
import { IncumplimientoForm } from '@/components/expediente/forms/IncumplimientoForm';

/** VISTA dedicada: gestión (edición) de un incumplimiento registrado (fila 37). */
export default function Page({
  params
}: {
  params: Promise<{ id: string; breachId: string }>;
}) {
  const { id, breachId } = use(params);
  return (
    <ExpedienteRoute
      cid={id}
      permiso="editar"
      tab="incumplimientos"
      recurso="incumplimiento"
      registro={{ col: 'breaches', id: breachId }}
    >
      {(volver) => <IncumplimientoForm cid={id} recordId={breachId} onDone={volver} />}
    </ExpedienteRoute>
  );
}
