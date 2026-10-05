'use client';

import { use } from 'react';
import { ConciliacionView } from '@/components/expediente/ConciliacionView';

/** VISTA dedicada: conciliación documento ↔ sistema del expediente (antes modal). */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ConciliacionView cid={id} />;
}
