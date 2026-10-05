'use client';

import { use } from 'react';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';
import { PagoForm } from '@/components/expediente/forms/PagoForm';

/** VISTA dedicada: alta de pago o cuenta de cobro del expediente (fila 43). */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ExpedienteRoute cid={id} permiso="crear" tab="pagos" recurso="pago">
      {(volver) => <PagoForm cid={id} onDone={volver} />}
    </ExpedienteRoute>
  );
}
