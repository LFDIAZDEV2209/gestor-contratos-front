'use client';
import { useRouter } from 'next/navigation';
import { ActasView } from '@/components/views/ActasView';
import { contractHref, companyHref, viewHref } from '@/components/app/routes';

export default function Page() {
  const router = useRouter();
  return <ActasView onSelectContract={(id, tab) => router.push(contractHref(id, tab))} />;
}
