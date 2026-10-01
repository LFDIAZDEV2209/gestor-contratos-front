'use client';
import { useRouter } from 'next/navigation';
import { ConfiguracionView } from '@/components/views/ConfiguracionView';
import { contractHref, companyHref, viewHref } from '@/components/app/routes';
import { PermissionGate } from '@/components/app/PermissionGate';
export default function Page() {
  const router = useRouter();
  return <PermissionGate roles={['ADMINISTRADOR']}><ConfiguracionView onNavigateToEmpresas={() => router.push('/empresas')} onOpenCompany={id => router.push(companyHref(id))} /></PermissionGate>;
}
