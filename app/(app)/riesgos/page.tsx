'use client';
import { useRouter } from 'next/navigation';
import { RiesgosView } from '@/components/views/RiesgosView';
import { contractHref, companyHref, viewHref } from '@/components/app/routes';

export default function Page() {
  const router = useRouter();
  return <RiesgosView onSelectContract={(id, tab) => router.push(contractHref(id, tab))} />;
}
