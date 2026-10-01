'use client';
import { useRouter } from 'next/navigation';
import { AuditoriaView } from '@/components/views/AuditoriaView';
import { contractHref, companyHref, viewHref } from '@/components/app/routes';
import { PermissionGate } from '@/components/app/PermissionGate';
export default function Page() {
  const router = useRouter();
  return <PermissionGate permission="auditar"><AuditoriaView onSelectContract={(id, tab) => router.push(contractHref(id, tab))} /></PermissionGate>;
}
