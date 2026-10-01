'use client';
import { useParams, useRouter, notFound } from 'next/navigation';
import { Store } from '@/lib/store';
import { EmpresaView } from '@/components/views/EmpresaView';
export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  if (!Store.get('companies', id)) notFound();
  return <EmpresaView id={id} onBack={() => router.push('/empresas')} />;
}
