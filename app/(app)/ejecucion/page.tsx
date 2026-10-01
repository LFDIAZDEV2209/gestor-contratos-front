'use client';
import { useRouter } from 'next/navigation';
import { EjecucionView } from '@/components/views/EjecucionView';
import { contractHref, companyHref, viewHref } from '@/components/app/routes';

export default function Page() {
  const router = useRouter();
  return <EjecucionView onSelectContract={(id, tab) => router.push(contractHref(id, tab))} />;
}
