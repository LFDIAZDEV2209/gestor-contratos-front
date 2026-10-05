'use client';

import { use } from 'react';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';
import { SuspensionForm } from '@/components/expediente/forms/SuspensionForm';

/** VISTA dedicada: suspensión temporal de la ejecución (fila 49a). */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ExpedienteRoute cid={id} permiso="editar" tab="suspensiones" recurso="suspensión">
      {(volver) => <SuspensionForm cid={id} onDone={volver} />}
    </ExpedienteRoute>
  );
}
