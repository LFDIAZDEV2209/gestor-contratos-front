'use client';
import { useRouter } from 'next/navigation';
import { ReportesView } from '@/components/views/ReportesView';
import { contractHref, companyHref, viewHref } from '@/components/app/routes';

export default function Page() {
  const router = useRouter();
  return <ReportesView  />;
}
