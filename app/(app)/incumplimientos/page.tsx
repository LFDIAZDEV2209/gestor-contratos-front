'use client';
import { useRouter } from 'next/navigation';
import { IncumplimientosView } from '@/components/views/IncumplimientosView';
import { contractHref, companyHref, viewHref } from '@/components/app/routes';

export default function Page() {
  const router = useRouter();
  return <IncumplimientosView onSelectContract={(id, tab) => router.push(contractHref(id, tab))} />;
}
