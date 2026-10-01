'use client';
import { useRouter } from 'next/navigation';
import { DocumentosView } from '@/components/views/DocumentosView';
import { contractHref, companyHref, viewHref } from '@/components/app/routes';

export default function Page() {
  const router = useRouter();
  return <DocumentosView onSelectContract={(id, tab) => router.push(contractHref(id, tab))} />;
}
