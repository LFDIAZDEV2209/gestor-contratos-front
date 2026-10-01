'use client';
import { useRouter } from 'next/navigation';
import { DashboardView } from '@/components/views/DashboardView';
import { contractHref, companyHref, viewHref } from '@/components/app/routes';

export default function Page() {
  const router = useRouter();
  return <DashboardView onSelectContract={(id, tab) => router.push(contractHref(id, tab))} onNavigate={(view, filter) => router.push(viewHref(view, filter))} />;
}
