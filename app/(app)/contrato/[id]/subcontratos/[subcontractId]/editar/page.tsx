'use client';

import { use } from 'react';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';
import { SubcontratoForm } from '@/components/expediente/forms/SubcontratoForm';

/** VISTA dedicada: edición de un subcontrato derivado (fila 48). */
export default function Page({
  params
}: {
  params: Promise<{ id: string; subcontractId: string }>;
}) {
  const { id, subcontractId } = use(params);
  return (
    <ExpedienteRoute
      cid={id}
      permiso="editar"
      tab="subcontratos"
      recurso="subcontrato"
      registro={{ col: 'subcontracts', id: subcontractId }}
    >
      {(volver) => <SubcontratoForm cid={id} recordId={subcontractId} onDone={volver} />}
    </ExpedienteRoute>
  );
}
