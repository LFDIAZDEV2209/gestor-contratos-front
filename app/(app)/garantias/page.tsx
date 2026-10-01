'use client';
import { useRouter } from 'next/navigation';
import { GarantiasView } from '@/components/views/GarantiasView';
import { contractHref, companyHref, viewHref } from '@/components/app/routes';

export default function Page() {
  const router = useRouter();
  return <GarantiasView onSelectContract={(id, tab) => router.push(contractHref(id, tab))} />;
}
