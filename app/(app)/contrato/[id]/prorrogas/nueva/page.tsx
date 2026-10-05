'use client';

import { use } from 'react';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';
import { ProrrogaForm } from '@/components/expediente/forms/ProrrogaForm';

/** VISTA dedicada: prórroga contractual (ampliación de plazo) del expediente (fila 44). */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ExpedienteRoute cid={id} permiso="editar" tab="prorrogas" recurso="prórroga">
      {(volver) => <ProrrogaForm cid={id} onDone={volver} />}
    </ExpedienteRoute>
  );
}
