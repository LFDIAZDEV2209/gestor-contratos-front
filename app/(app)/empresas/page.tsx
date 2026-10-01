'use client';
import { useRouter } from 'next/navigation';
import { EmpresasView } from '@/components/views/EmpresasView';
import { contractHref, companyHref, viewHref } from '@/components/app/routes';

export default function Page() {
  const router = useRouter();
  return <EmpresasView onSelect={id => router.push(companyHref(id))} />;
}
