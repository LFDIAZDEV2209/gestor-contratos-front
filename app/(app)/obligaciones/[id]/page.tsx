'use client';
import { useParams, notFound } from 'next/navigation';
import { Store } from '@/lib/store';
import { ObligacionFicha } from '@/components/views/ObligacionFicha';

/** FICHA dedicada de obligación (reemplaza al modal de detalle de ObligacionesView). */
export default function Page() {
  const { id } = useParams<{ id: string }>();
  if (!Store.get('obligations', id)) notFound();
  return <ObligacionFicha id={id} />;
}
