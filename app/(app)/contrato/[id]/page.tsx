'use client';
import { Suspense } from 'react';
import { useParams, notFound } from 'next/navigation';
import { Store } from '@/lib/store';
import { ExpedienteView } from '@/components/views/ExpedienteView';
import { ExpedienteSkeleton } from '@/components/ui/Workspace';
function ContractPage() {
  const { id } = useParams<{ id: string }>();
  if (!Store.get('contracts', id)) notFound();
  return <ExpedienteView key={id} id={id} />;
}
export default function Page() {
  return <Suspense fallback={<ExpedienteSkeleton />}><ContractPage /></Suspense>;
}
