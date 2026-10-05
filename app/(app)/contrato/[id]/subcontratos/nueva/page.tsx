'use client';

import { use } from 'react';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';
import { SubcontratoForm } from '@/components/expediente/forms/SubcontratoForm';

/** VISTA dedicada: alta de subcontrato derivado del expediente (fila 47). */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ExpedienteRoute cid={id} permiso="crear" tab="subcontratos" recurso="subcontrato">
      {(volver) => <SubcontratoForm cid={id} onDone={volver} />}
    </ExpedienteRoute>
  );
}
