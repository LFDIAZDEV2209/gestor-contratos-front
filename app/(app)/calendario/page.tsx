'use client';
import { useRouter } from 'next/navigation';
import { CalendarioView } from '@/components/views/CalendarioView';
import { contractHref, companyHref, viewHref } from '@/components/app/routes';

export default function Page() {
  const router = useRouter();
  return <CalendarioView onSelectContract={(id, tab) => router.push(contractHref(id, tab))} />;
}
