'use client';

import { use } from 'react';
import { ConciliacionView } from '@/components/expediente/ConciliacionView';
import { ExpedienteRoute } from '@/components/expediente/forms/ExpedienteRoute';

/** VISTA dedicada: conciliación documento ↔ sistema del expediente (antes modal). */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ExpedienteRoute cid={id} permiso="ver" tab="documentos" recurso="conciliación">{() => <ConciliacionView cid={id} />}</ExpedienteRoute>;
}
