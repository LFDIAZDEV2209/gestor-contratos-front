'use client';
import { useRouter } from 'next/navigation';
import { ModificacionesView } from '@/components/views/ModificacionesView';
import { contractHref, companyHref, viewHref } from '@/components/app/routes';

export default function Page() {
  const router = useRouter();
  return <ModificacionesView onSelectContract={(id, tab) => router.push(contractHref(id, tab))} />;
}
