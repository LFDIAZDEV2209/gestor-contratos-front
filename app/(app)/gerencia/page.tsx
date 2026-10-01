'use client';
import { useRouter } from 'next/navigation';
import { GerenciaView } from '@/components/views/GerenciaView';
import { contractHref, companyHref, viewHref } from '@/components/app/routes';

export default function Page() {
  const router = useRouter();
  return <GerenciaView onSelectContract={id => router.push(contractHref(id))} />;
}
