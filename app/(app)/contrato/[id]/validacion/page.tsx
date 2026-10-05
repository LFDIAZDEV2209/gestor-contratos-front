'use client';

import { use } from 'react';
import { ValidacionView } from '@/components/expediente/ValidacionView';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';

/** VISTA dedicada: validador contractual del expediente (antes modal en ExpedienteView). */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ExpedienteRoute cid={id} permiso="ver" tab="general" recurso="validación">{() => <ValidacionView cid={id} />}</ExpedienteRoute>;
}
