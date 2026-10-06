'use client';

import { use } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AuthService, Store } from '@/lib/store';
import type { Document } from '@/lib/types';
import { fdate } from '@/lib/format';
import { DescargarVersion } from '@/components/ui/DescargarVersion';
import { contractHref } from '@/components/app/routes';
import { RouteState } from '@/components/expediente/forms/RouteState';
import { PageHeader, Surface, TableViewport, DataTable, EmptyState } from '@/components/ui/Workspace';

/** Ficha de consulta: conserva el historial y enlaza al formulario de nueva versión. */
export default function Page({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = use(params);
  if (!AuthService.can('ver')) return <RouteState title="Acceso restringido" description="Tu rol no permite consultar documentos." />;
  const doc = Store.get('documents', documentId) as Document | null;
  if (!doc) notFound();
  const contract = Store.get('contracts', doc.contractId);
  const versions = [...(doc.versions ?? [])].sort((a, b) => b.v - a.v);
  const latest = versions[0];

  return <div className="anim-fade-rise" style={{ minWidth: 0 }}>
    <PageHeader>
      <div style={{ minWidth: 0 }}>
        <nav className="crumb" aria-label="Ruta de navegación">
          <Link href="/documentos">Documentos</Link><span> / </span><span aria-current="page">{doc.id}</span>
        </nav>
        <h1 style={{ overflowWrap: 'anywhere' }}>{doc.nombre || doc.name || 'Ficha de documento'}</h1>
        <p>{doc.categoria || doc.type || 'Documento contractual'} · {doc.estado || 'Sin estado'}</p>
      </div>
      <div className="ph-actions">
        <Link className="btn ghost" href="/documentos">Volver al listado</Link>
        {AuthService.can('editar') && <Link className="btn pri" href={`/documentos/${encodeURIComponent(doc.id)}/versiones/nueva`}>Nueva versión</Link>}
      </div>
    </PageHeader>
    <Surface className="mb">
      <div className="panel-h"><h2 style={{ fontSize: 16 }}>Información del documento</h2></div>
      <div className="panel-b">
        <dl style={{ overflowWrap: 'anywhere' }}>
          <dt>Contrato</dt><dd>{contract ? <Link href={contractHref(contract.id, 'documentos')}>{contract.numero}</Link> : 'Sin contrato asociado'}</dd>
          <dt>Versión vigente</dt><dd>{latest ? `v${latest.v} · ${latest.archivo}` : 'Sin versiones registradas'}</dd>
          <dt>Observaciones</dt><dd>{doc.obs || 'Sin observaciones'}</dd>
        </dl>
      </div>
    </Surface>
    <Surface>
      <div className="panel-h"><h2 id="document-history-title" style={{ fontSize: 16 }}>Historial de versiones</h2></div>
      {versions.length ? <TableViewport aria-label="Historial de versiones; desplazamiento horizontal">
        <DataTable aria-labelledby="document-history-title">
          <thead><tr><th scope="col">Versión</th><th scope="col">Fecha</th><th scope="col">Usuario</th><th scope="col">Archivo</th><th scope="col">Motivo y cambios</th><th scope="col">Descarga</th></tr></thead>
          <tbody>{versions.map((version) => <tr key={version.v}>
            <td>v{version.v}</td><td className="nw">{fdate(version.fecha)}</td><td>{version.usuario}</td>
            <td style={{ overflowWrap: 'anywhere' }}>{version.archivo}</td>
            <td style={{ overflowWrap: 'anywhere' }}>{version.motivo || 'Sin motivo registrado'}{version.cambios && <p className="small muted">{version.cambios}</p>}</td>
            <td><DescargarVersion documentId={doc.id} v={version.v} archivo={version.archivo} /></td>
          </tr>)}</tbody>
        </DataTable>
      </TableViewport> : <EmptyState title="Sin versiones registradas" description="Las versiones cargadas aparecerán en este historial." />}
    </Surface>
  </div>;
}
