'use client';

import { use } from 'react';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';
import { ReinicioForm } from '@/components/expediente/forms/ReinicioForm';

/** VISTA dedicada: reinicio de la ejecución tras suspensión (fila 49b). */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ExpedienteRoute cid={id} permiso="editar" tab="suspensiones" recurso="reinicio">
      {(volver) => <ReinicioForm cid={id} onDone={volver} />}
    </ExpedienteRoute>
  );
}
