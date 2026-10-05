'use client';

import { use } from 'react';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';
import { GarantiaForm } from '@/components/expediente/forms/GarantiaForm';

/** VISTA dedicada: alta de póliza de garantía del expediente (fila 35). */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ExpedienteRoute cid={id} permiso="crear" tab="garantias" recurso="póliza">
      {(volver) => <GarantiaForm cid={id} onDone={volver} />}
    </ExpedienteRoute>
  );
}
