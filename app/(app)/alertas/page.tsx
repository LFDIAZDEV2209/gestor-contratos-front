'use client';
import { useRouter } from 'next/navigation';
import { AlertasView } from '@/components/views/AlertasView';
import { contractHref, companyHref, viewHref } from '@/components/app/routes';

export default function Page() {
  const router = useRouter();
  return <AlertasView onSelectContract={(id, tab) => router.push(contractHref(id, tab))} />;
}
