'use client';

import { use } from 'react';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';
import { RiesgoForm } from '@/components/expediente/forms/RiesgoForm';

/** VISTA dedicada: alta de riesgo contractual en la matriz del expediente (fila 45). */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ExpedienteRoute cid={id} permiso="crear" tab="riesgos" recurso="riesgo">
      {(volver) => <RiesgoForm cid={id} onDone={volver} />}
    </ExpedienteRoute>
  );
}
