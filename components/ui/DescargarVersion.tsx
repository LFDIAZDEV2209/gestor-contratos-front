'use client';
import { useState } from 'react';
import { Button } from './button';
import { Icon } from '../icons';
import { notify } from './Feedback';
import { descargarVersion, mensajeErrorDocumento } from '../../lib/documents';

/** Botón de descarga de una versión (URL firmada del API). Si falla, avisa sin romper la vista. */
export const DescargarVersion = ({ documentId, v, archivo }: { documentId: string; v: number; archivo?: string }) => {
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
    <Button className="btn xs ghost" onClick={descargar} loading={cargando} title={`Descargar v${v}`} aria-label={`Descargar versión ${v}${archivo ? ` (${archivo})` : ''}`}>
      <Icon name="download" /> {cargando ? 'Descargando…' : 'Descargar'}
    </Button>
  );
};
