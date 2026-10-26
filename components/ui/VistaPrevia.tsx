'use client';
import { useEffect, useState } from 'react';
import { Button } from './button';
import { Icon } from '../icons';
import { Modal } from './Modal';
import { notify } from './Feedback';
import { urlPrevisual, descargarVersion, mensajeErrorDocumento } from '../../lib/documents';

type Estado =
  | { paso: 'cargando' }
  | { paso: 'lista'; url: string; tipo: 'pdf' | 'imagen'; expira?: string }
  | { paso: 'no-disponible' }
  | { paso: 'error'; mensaje: string };

/**
 * Previsualización profesional de una versión de documento:
 * PDF → marco embebido (visor del navegador), imagen → <img>, otros formatos → descarga.
 * La URL es firmada (HMAC de corta vida) y sirve con Content-Disposition inline.
 */
export function VistaPreviaModal({
  documentId,
  v,
  nombre,
  archivo,
  onClose,
}: {
  documentId: string;
  v: number;
  nombre: string;
  archivo?: string;
  onClose: () => void;
}) {
  const [estado, setEstado] = useState<Estado>({ paso: 'cargando' });

  useEffect(() => {
    let cancelado = false;
    setEstado({ paso: 'cargando' });
    urlPrevisual(documentId, v)
      .then((res) => {
        if (cancelado) return;
        if (!res) setEstado({ paso: 'no-disponible' });
        else setEstado({ paso: 'lista', url: res.url, tipo: res.tipo, expira: res.expira });
      })
      .catch((e) => {
        if (cancelado) return;
        setEstado({ paso: 'error', mensaje: mensajeErrorDocumento(e, true) });
      });
    return () => { cancelado = true; };
  }, [documentId, v]);

  return (
    <Modal
      title={nombre}
      subtitle={`Vista previa de la versión v${v}${archivo ? ` · ${archivo}` : ''}`}
      size="xl"
      onClose={onClose}
      footer={
        <>
          <span className="small muted" style={{ marginRight: 'auto' }}>
            {estado.paso === 'lista' && estado.expira
              ? `URL de vista previa válida hasta ${new Date(estado.expira).toLocaleTimeString()}`
              : 'La vista previa es de solo lectura; el historial permanece inmutable.'}
          </span>
          <Button className="btn ghost" onClick={onClose}>Cerrar</Button>
        </>
      }
    >
      {estado.paso === 'cargando' && (
        <div className="center" style={{ padding: '48px 0' }} role="status" aria-live="polite">
          <Icon name="spinner" /> <span style={{ marginLeft: 8 }}>Cargando vista previa…</span>
        </div>
      )}
      {estado.paso === 'lista' && estado.tipo === 'pdf' && (
        <iframe
          src={estado.url}
          title={`Vista previa de ${nombre} (v${v})`}
          style={{ width: '100%', height: 'min(72vh, 780px)', border: '1px solid var(--line)', borderRadius: 10, background: '#fff' }}
        />
      )}
      {estado.paso === 'lista' && estado.tipo === 'imagen' && (
        <div className="center" style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 16, border: '1px solid var(--line)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={estado.url}
            alt={`Vista previa de ${nombre} (v${v})`}
            style={{ maxWidth: '100%', maxHeight: '72vh', borderRadius: 6 }}
          />
        </div>
      )}
      {estado.paso === 'no-disponible' && (
        <div className="center" style={{ padding: '40px 12px' }}>
          <Icon name="file-pdf" size={28} />
          <p className="mb" style={{ marginTop: 10 }}>
            Este formato (Word/Excel) no se previsualiza en el navegador. Descárgalo para revisarlo.
          </p>
          <DescargaDirecta documentId={documentId} v={v} archivo={archivo} />
        </div>
      )}
      {estado.paso === 'error' && (
        <div className="center" style={{ padding: '40px 12px' }}>
          <Icon name="triangle-exclamation" size={28} />
          <p className="mb" style={{ marginTop: 10 }}>{estado.mensaje}</p>
          <DescargaDirecta documentId={documentId} v={v} archivo={archivo} />
        </div>
      )}
    </Modal>
  );
}

/** Botón de descarga dentro de la vista previa (fallback de formatos no visibles). */
function DescargaDirecta({ documentId, v, archivo }: { documentId: string; v: number; archivo?: string }) {
  const [cargando, setCargando] = useState(false);
  const descargar = async () => {
    setCargando(true);
    try {
      await descargarVersion(documentId, v, archivo);
    } catch (e) {
      notify(mensajeErrorDocumento(e, true));
    } finally {
      setCargando(false);
    }
  };
  return (
    <Button className="btn pri" onClick={descargar} loading={cargando}>
      <Icon name="download" /> Descargar archivo
    </Button>
  );
}

/** Botón compacto que abre la vista previa (para tablas de documentos). */
export function VistaPreviaBoton({
  documentId,
  v,
  nombre,
  archivo,
  onAbrir,
}: {
  documentId: string;
  v: number;
  nombre: string;
  archivo?: string;
  onAbrir: () => void;
}) {
  const previsualizable = ['pdf', 'png', 'jpg', 'jpeg'].includes((archivo ?? '').split('.').pop()?.toLowerCase() || '');
  return (
    <Button
      className="btn xs ghost"
      onClick={onAbrir}
      title={previsualizable ? 'Vista previa del documento' : 'Ver / descargar documento'}
      aria-label={`Vista previa de ${nombre} versión ${v}`}
    >
      <Icon name="eye" /> Ver
    </Button>
  );
}
