'use client';
import { useParams, notFound } from 'next/navigation';
import { Store, AuthService } from '@/lib/store';
import { RouteState } from '@/components/expediente/forms/RouteState';
import { ObligacionFicha } from '@/components/views/ObligacionFicha';

/** FICHA dedicada de obligación (reemplaza al modal de detalle de ObligacionesView). */
export default function Page() {
  const { id } = useParams<{ id: string }>();
  if (!AuthService.can('ver')) return <RouteState title="Acceso restringido" description="Tu rol no permite consultar obligaciones." />;
  if (!Store.get('obligations', id)) notFound();
  return <ObligacionFicha id={id} />;
}
