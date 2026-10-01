'use client';
import { useRouter } from 'next/navigation';
import { PagosView } from '@/components/views/PagosView';
import { contractHref, companyHref, viewHref } from '@/components/app/routes';

export default function Page() {
  const router = useRouter();
  return <PagosView onSelectContract={(id, tab) => router.push(contractHref(id, tab))} />;
}
