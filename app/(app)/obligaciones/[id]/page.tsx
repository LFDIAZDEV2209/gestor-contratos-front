'use client';
import { useParams, useRouter, notFound } from 'next/navigation';
import { Store } from '@/lib/store';
import { ObligacionesView } from '@/components/views/ObligacionesView';
import { contractHref } from '@/components/app/routes';
export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  if (!Store.get('obligations', id)) notFound();
  return <ObligacionesView key={id} detailId={id} onSelectContract={(cid, tab) => router.push(contractHref(cid, tab))} />;
}
