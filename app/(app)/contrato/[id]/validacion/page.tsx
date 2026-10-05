'use client';

import { use } from 'react';
import { ValidacionView } from '@/components/expediente/ValidacionView';

/** VISTA dedicada: validador contractual del expediente (antes modal en ExpedienteView). */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ValidacionView cid={id} />;
}
