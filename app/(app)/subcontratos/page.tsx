'use client';
import { useRouter } from 'next/navigation';
import { SubcontratosView } from '@/components/views/SubcontratosView';
import { contractHref, companyHref, viewHref } from '@/components/app/routes';

export default function Page() {
  const router = useRouter();
  return <SubcontratosView onSelectContract={(id, tab) => router.push(contractHref(id, tab))} />;
}
