'use client';
import { useRouter } from 'next/navigation';
import { AseguradorasView } from '@/components/views/AseguradorasView';
import { contractHref, companyHref, viewHref } from '@/components/app/routes';

export default function Page() {
  const router = useRouter();
  return <AseguradorasView onSelectContract={(id, tab) => router.push(contractHref(id, tab))} onNavigateToGarantias={() => router.push('/garantias')} />;
}
