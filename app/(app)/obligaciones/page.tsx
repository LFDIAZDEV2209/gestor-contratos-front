'use client';
import { useRouter } from 'next/navigation';
import { ObligacionesView } from '@/components/views/ObligacionesView';
import { contractHref, companyHref, viewHref } from '@/components/app/routes';

export default function Page() {
  const router = useRouter();
  return <ObligacionesView onSelectContract={(id, tab) => router.push(contractHref(id, tab))} />;
}
