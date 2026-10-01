'use client';
import { useRouter } from 'next/navigation';
import { AgendaView } from '@/components/views/AgendaView';
import { contractHref, companyHref, viewHref } from '@/components/app/routes';

export default function Page() {
  const router = useRouter();
  return <AgendaView onSelectContract={id => router.push(contractHref(id))} />;
}
