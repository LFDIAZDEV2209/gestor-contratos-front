'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Document } from '../../lib/types';
import { AuthService } from '../../lib/store';
import { fdate } from '../../lib/format';
import {
  MAX_ARCHIVO_MB,
  advertenciasDe,
  anularDocumento,
  listarSoportesPorRef,
  mensajeErrorDocumento,
  subirSoportePolimorfico,
  ultimaVersion,
} from '../../lib/documents';
import { Icon } from '../icons';
import { Button } from './button';
import { AvisoApi } from './AvisoApi';
import { DescargarVersion } from './DescargarVersion';
import { notify, requestReason } from './Feedback';

/**
 * Lista de soportes (adjuntos polimórficos) de una entidad sin contrato, p. ej. un cupo.
 * Permite adjuntar más archivos, descargar la última versión y anular.
 */
export const SoportesRef = ({ refId, refTipo }: { refId: string; refTipo: string }) => {
  const [docs, setDocs] = useState<Document[] | null>(null);
  const [error, setError] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [anulando, setAnulando] = useState<string | null>(null);
  const [advertencias, setAdvertencias] = useState<string[]>([]);
  const pendiente = useRef<File[]>([]);
  const lock = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    try {
      setDocs((await listarSoportesPorRef(refId, refTipo)).filter((d) => d.estado !== 'Anulado'));
      setError('');
    } catch (e) {
      setDocs([]);
      setError(mensajeErrorDocumento(e));
    }
  }, [refId, refTipo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const subir = async (force: boolean) => {
    if (lock.current) return;
    lock.current = true;
    setSubiendo(true);
    setError('');
    setAdvertencias([]);
    const restantes = [...pendiente.current];
    try {
      while (restantes.length) {
        await subirSoportePolimorfico(refId, refTipo, restantes[0].name, undefined, restantes[0], force);
        restantes.shift();
      }
      notify('Soportes cargados.');
    } catch (e) {
      const w = advertenciasDe(e);
      if (w) setAdvertencias(w);
      else setError(`${restantes[0]?.name ?? 'Archivo'}: ${mensajeErrorDocumento(e)}`);
    } finally {
      pendiente.current = restantes;
      lock.current = false;
      setSubiendo(false);
      await cargar();
    }
  };

  const elegir = (list: FileList | null) => {
    if (!list?.length) return;
    const ok = Array.from(list).filter((f) => f.size <= MAX_ARCHIVO_MB * 1024 * 1024);
    if (ok.length < list.length) setError(`Algunos archivos superan ${MAX_ARCHIVO_MB} MB y se omitieron.`);
    pendiente.current = ok;
    if (input.current) input.current.value = '';
    if (ok.length) void subir(false);
  };

  const anular = async (d: Document) => {
    if (anulando || !AuthService.guard('anular')) return;
    const motivo = await requestReason(`Motivo de anulación del soporte «${d.nombre}»:`);
    if (!motivo) return;
    setAnulando(d.id);
    try {
      await anularDocumento(d.id, motivo);
      await cargar();
    } catch (e) {
      notify(mensajeErrorDocumento(e));
    } finally {
      setAnulando(null);
    }
  };

  return (
    <div>
      {AuthService.can('crear') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <label className="btn xs pri" aria-disabled={subiendo} style={{ cursor: subiendo ? 'default' : 'pointer', margin: 0, position: 'relative' }}>
            <Icon name="upload" /> {subiendo ? 'Subiendo…' : 'Adjuntar soportes'}
            <input
              ref={input}
              type="file"
              multiple
              disabled={subiendo}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              onChange={(e) => elegir(e.target.files)}
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
            />
          </label>
          <span className="small muted">Máx. {MAX_ARCHIVO_MB} MB c/u.</span>
        </div>
      )}
      <AvisoApi error={error} advertencias={advertencias} onForzar={() => subir(true)} cargando={subiendo} />
      {docs === null ? (
        <p className="small muted" role="status">Cargando soportes…</p>
      ) : docs.length === 0 ? (
        <p className="small muted">Este registro aún no tiene soportes adjuntos.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          {docs.map((d) => {
            const v = ultimaVersion(d);
            return (
              <li key={d.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, justifyContent: 'space-between', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ minWidth: 0 }}>
                  <b style={{ overflowWrap: 'anywhere' }}>{d.nombre}</b>
                  <div className="small muted">{v ? `v${v.v} · ${fdate(v.fecha)} · ${v.usuario}` : 'Sin versiones'}</div>
                </div>
                <div className="acts">
                  {v && <DescargarVersion documentId={d.id} v={v.v} archivo={v.archivo} />}
                  {AuthService.can('anular') && (
                    <Button className="btn xs ghost" onClick={() => anular(d)} loading={anulando === d.id} aria-label={`Anular soporte ${d.nombre}`}>
                      <Icon name="circle-xmark" /> Anular
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
