'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Store, AuthService } from '@/lib/store';
import { EmptyState } from '@/components/ui/Workspace';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/icons';
import { EmpresaForm } from '@/components/forms/EmpresaForm';
import type { Company } from '@/lib/types';

/** VISTA dedicada: edición de la ficha de empresa (reemplaza al modal de EmpresaView). */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const company = Store.get('companies', id) as Company | undefined;
  // can() es puro: sin efectos en render (guard() alerta y se reserva a handlers)
  const permitido = AuthService.can('editar');

  if (!company || !permitido) {
    return (
      <div className="anim-fade-rise" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <EmptyState
          title={company ? 'Acceso restringido' : 'Empresa no encontrada'}
          description={
            company
              ? 'Tu rol no permite editar la ficha de empresas.'
              : 'El identificador de la empresa no existe o ha sido anulado.'
          }
          action={
            <Button className="btn pri" onClick={() => router.push('/empresas')} style={{ marginTop: 12 }}>
              <Icon name="chevron-left" /> Volver a Empresas
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="anim-fade-rise">
      <EmpresaForm initial={{ ...company }} onDone={() => router.push(`/empresas/${id}`)} />
    </div>
  );
}
