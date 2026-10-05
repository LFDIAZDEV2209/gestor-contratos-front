'use client';
import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Button } from '../ui/button';
import { PageHeader, Surface, TableViewport, DataTable, EmptyState } from '../ui/Workspace';
import { Icon } from '../icons';
import { Store, Audit } from '../../lib/store';
import { Validator } from '../../lib/validator';
import { contractHref } from '../app/routes';
import type { Contract } from '../../lib/types';

/**
 * VISTA dedicada de la conciliación contractual (fila 17 del mapa): comparación
 * campo a campo entre el documento del contrato y los datos del sistema.
 * La conciliación es una consulta extensa, no una confirmación breve.
 */
export const ConciliacionView = ({ cid }: { cid: string }) => {
  const c = Store.get('contracts', cid) as Contract | undefined;
  const logeado = useRef(false);

  const res = useMemo(() => (c ? Validator.reconcile(c) : null), [c]);

  useEffect(() => {
    if (!c || !res || logeado.current) return;
    logeado.current = true;
    Audit.log({
      contractId: c.id,
      modulo: 'Conciliación',
      accion: 'Conciliación',
      campo: 'Resultado',
      nuevo: res.diffs ? `${res.diffs} diferencias` : 'Sin diferencias'
    });
  }, [c, res]);

  if (!c) {
    return (
      <div className="anim-fade-rise" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <EmptyState
          title="Contrato no encontrado"
          description="El identificador del contrato no existe o el registro fue anulado."
          action={
            <Link className="btn pri" href="/contratos" style={{ marginTop: 12 }}>
              <Icon name="chevron-left" /> Volver a Contratos
            </Link>
          }
        />
      </div>
    );
  }

  const conDiferencias = Boolean(res && res.diffs > 0);

  return (
    <div className="anim-fade-rise" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <PageHeader className="ph">
        <div>
          <nav className="crumb" style={{ width: '100%', marginBottom: 6 }} aria-label="Ruta de navegación">
            <Link href="/contratos">Contratos</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <Link href={contractHref(cid)}>Contrato {c.numero}</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <span>Conciliación</span>
          </nav>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            Conciliación contractual
            <span className="badge b-info mono">{c.numero}</span>
          </h1>
          <p style={{ margin: '4px 0 0' }}>
            Comparación entre el documento del contrato cargado en Documentos y la información
            registrada en el sistema.
          </p>
        </div>
      </PageHeader>

      {!res ? (
        <Surface className="panel mb">
          <div
            className="result-banner"
            style={{
              background: 'var(--warn-s)',
              color: '#7A5C00',
              padding: '14px 16px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 600
            }}
          >
            <Icon name="file-circle-question" />
            <span>No hay un documento de categoría «Contrato» con datos extraídos para conciliar.</span>
          </div>
          <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
            Carga el contrato firmado en la pestaña Documentos y registra sus datos clave. En
            producción, los datos se extraen automáticamente mediante OCR e IA sobre el PDF.
          </p>
        </Surface>
      ) : (
        <>
          <Surface className="panel mb" role="status">
            <div
              className="result-banner"
              style={{
                background: conDiferencias ? 'var(--crit-s)' : 'var(--ok-s)',
                color: conDiferencias ? 'var(--crit)' : 'var(--ok-text)',
                padding: '14px 16px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600
              }}
            >
              <Icon name={conDiferencias ? 'triangle-exclamation' : 'circle-check'} />
              <span>
                {conDiferencias
                  ? `${res.diffs} diferencia${res.diffs === 1 ? '' : 's'} detectada${res.diffs === 1 ? '' : 's'}`
                  : 'La información del sistema coincide completamente con el documento'}
              </span>
            </div>
            <p className="small muted" style={{ margin: '12px 0 0' }}>
              Documento fuente: <b>{res.doc.nombre}</b> (versión {res.doc.versions?.length || 1}).
              {' '}Las filas en rojo son las que no coinciden.
            </p>
          </Surface>

          <Surface className="panel mb">
            <div className="panel-h">
              <div>
                <h3>Comparación campo a campo</h3>
                <span className="sub">{res.rows.length} campos conciliados</span>
              </div>
            </div>
            <TableViewport className="tbl-wrap">
              <DataTable className="tbl conc">
                <thead>
                  <tr>
                    <th>Campo</th>
                    <th>Documento (contrato)</th>
                    <th>Sistema</th>
                    <th className="nw">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {res.rows.map((row, idx) => {
                    const [campo, docVal, sysVal, match] = row;
                    return (
                      <tr key={idx} style={{ background: match ? 'transparent' : 'var(--crit-s)' }}>
                        <td className="strong">{campo}</td>
                        <td title={docVal}>{docVal}</td>
                        <td title={sysVal}>{sysVal}</td>
                        <td
                          className="nw"
                          style={{ color: match ? 'var(--ok-text)' : 'var(--crit)', fontWeight: 600 }}
                        >
                          {match ? '✓ Coincide' : '⚠ Diferencia detectada'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            </TableViewport>
          </Surface>

          <Surface className="panel mb">
            <p className="small muted" style={{ margin: 0 }}>
              <Icon name="circle-info" /> Los datos del documento provienen de la extracción
              registrada. Si fueron mal capturados, corrígelos con «Editar datos extraídos»; si el
              error está en el sistema, edita el contrato.
            </p>
          </Surface>
        </>
      )}

      <div className="form-foot">
        <Link className="btn ghost" href={contractHref(cid)}>
          <Icon name="chevron-left" /> Volver al expediente
        </Link>
        <Link className="btn" href={contractHref(cid, 'documentos')}>
          <Icon name={res ? 'pen-to-square' : 'upload'} /> {res ? 'Editar datos extraídos' : 'Cargar contrato en Documentos'}
        </Link>
        {!c.anulado && (
          <Link className="btn pri" href={`/contrato/${encodeURIComponent(cid)}/editar`}>
            <Icon name="pen" /> Editar contrato
          </Link>
        )}
      </div>
    </div>
  );
};
