'use client';
import { useRef, useState, type ReactNode } from 'react';
import { Icon } from '../icons';
import { Button } from './button';
import { MAX_ARCHIVO_MB, esperarCola, mensajeErrorDocumento, subirDocumento, subirSoportePolimorfico } from '../../lib/documents';

type Estado = 'pendiente' | 'subiendo' | 'ok' | 'error';
interface Item { file: File; estado: Estado; error?: string }

const ETIQUETA: Record<Estado, string> = { pendiente: 'Pendiente', subiendo: 'Subiendo…', ok: 'Subido', error: 'Falló' };

/**
 * Soportes adjuntos (opcional) para formularios de creación.
 * Uso: const sop = useSoportes(cid, destino); … soportes={sop.node}; al guardar con éxito
 * `await sop.finalizar(onDone)` en lugar de onDone(). Guard anti doble envío: `if (sop.bloqueado()) return;`.
 *
 * Con `opts.refTipo` el soporte es polimórfico: `contractId` pasa a ser el id de la entidad (p. ej. cupo).
 * Sin archivos navega normal. Con archivos: espera la cola write-through, sube cada soporte (categoría
 * «Soporte») mostrando el estado por archivo; si alguno falla NO se re-envía la entidad: se ofrece
 * «Reintentar fallidos» o «Continuar sin ellos». Al terminar recarga en `destino` (re-hidrata del API).
 */
export function useSoportes(contractId: string | (() => string), destino: string, opts: { refTipo?: string } = {}) {
  const [items, setItemsState] = useState<Item[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [creada, setCreada] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>([]);
  const lock = useRef(false);
  const cidRef = useRef('');
  const syncRef = useRef<(() => boolean) | undefined>(undefined);
  const maxBytes = MAX_ARCHIVO_MB * 1024 * 1024;

  const setItems = (next: Item[]) => {
    itemsRef.current = next;
    setItemsState(next);
  };
  const patch = (i: number, p: Partial<Item>) => setItems(itemsRef.current.map((it, j) => (j === i ? { ...it, ...p } : it)));

  const agregar = (list: FileList | null) => {
    if (!list || creada) return;
    const nuevos = Array.from(list);
    const grandes = nuevos.filter((f) => f.size > maxBytes);
    setError(grandes.length ? `Superan ${MAX_ARCHIVO_MB} MB y no se añadieron: ${grandes.map((f) => f.name).join(', ')}` : '');
    setItems([...itemsRef.current, ...nuevos.filter((f) => f.size <= maxBytes).map((file) => ({ file, estado: 'pendiente' as Estado }))]);
    if (input.current) input.current.value = '';
  };

  const irADestino = () => window.location.assign(destino);

  /** Sube los pendientes/fallidos; si todos quedan ok navega, si no deja el panel de reintento. */
  const subirPendientes = async () => {
    setSubiendo(true);
    const cid = cidRef.current;
    // El registro debe existir ya en el servidor (id remapeado); si no, no se suben soportes huérfanos.
    if (syncRef.current && !syncRef.current()) {
      setItems(itemsRef.current.map((it) => (it.estado === 'ok' ? it : { ...it, estado: 'error' as Estado, error: 'El registro aún no se guardó en el servidor (revisa los datos obligatorios o la conexión).' })));
      setSubiendo(false);
      return;
    }
    for (let i = 0; i < itemsRef.current.length; i++) {
      const it = itemsRef.current[i];
      if (it.estado === 'ok') continue;
      patch(i, { estado: 'subiendo', error: undefined });
      try {
        if (opts.refTipo) await subirSoportePolimorfico(cid, opts.refTipo, it.file.name, undefined, it.file, true);
        else await subirDocumento(cid, it.file.name, 'Soporte', undefined, it.file, true);
        patch(i, { estado: 'ok' });
      } catch (e) {
        patch(i, { estado: 'error', error: mensajeErrorDocumento(e) });
      }
    }
    setSubiendo(false);
    if (itemsRef.current.every((it) => it.estado === 'ok')) irADestino();
  };

  const finalizar = async (done: () => void, cidOverride?: string | (() => string), sincronizado?: () => boolean) => {
    lock.current = true;
    if (!itemsRef.current.length) {
      done();
      return;
    }
    syncRef.current = sincronizado;
    setCreada(true);
    setSubiendo(true);
    await esperarCola();
    const src = cidOverride ?? contractId;
    cidRef.current = typeof src === 'function' ? src() : src;
    await subirPendientes();
  };

  const hayFallidos = items.some((it) => it.estado === 'error');
  const bloqueado = () => lock.current || subiendo;

  const node: ReactNode = (
    <fieldset className="soportes">
      <legend>Soportes (opcional)</legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <label
          className="soportes-btn"
          aria-disabled={subiendo || creada}
          style={{ cursor: subiendo || creada ? 'not-allowed' : 'pointer' }}
          title="Adjuntar archivos de soporte (opcional)"
        >
          <Icon name="upload" /> Adjuntar archivos
          <input
            ref={input}
            type="file"
            multiple
            disabled={subiendo || creada}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            onChange={(e) => agregar(e.target.files)}
            style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
          />
        </label>
        {items.map((it, i) => (
          <span
            key={`${it.file.name}-${i}`}
            className={`badge soportes-chip ${it.estado === 'ok' ? 'b-ok' : it.estado === 'error' ? 'b-err' : 'b-na'}`}
            title={it.error}
          >
            <Icon name={it.estado === 'ok' ? 'check-circle' : it.estado === 'error' ? 'alert-circle' : 'file-text'} size={12} /> {it.file.name}
            <span className="small estado" role="status">· {ETIQUETA[it.estado]}</span>
            {!creada && (
              <button
                type="button"
                aria-label={`Quitar ${it.file.name}`}
                onClick={() => setItems(itemsRef.current.filter((_, j) => j !== i))}
                style={{ background: 'none', border: 0, cursor: 'pointer', padding: '0 2px', color: 'inherit', fontSize: 13, lineHeight: 1 }}
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      {error && <p className="small" role="alert" style={{ color: 'var(--danger, #b42318)', margin: '6px 0 0' }}>{error}</p>}
      {creada && hayFallidos && !subiendo && (
        <div role="alert" style={{ margin: '8px 0 0' }}>
          <p className="small" style={{ margin: '0 0 6px' }}>
            El registro ya se creó, pero algunos soportes no se subieron:
          </p>
          <ul className="small" style={{ margin: '0 0 8px', paddingLeft: 18 }}>
            {items.filter((it) => it.estado === 'error').map((it, i) => (
              <li key={i}><b>{it.file.name}</b>: {it.error}</li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button className="btn xs pri" onClick={subirPendientes}><Icon name="upload" /> Reintentar fallidos</Button>
            <Button className="btn xs ghost" onClick={irADestino}>Continuar sin ellos</Button>
          </div>
        </div>
      )}
      <p className="small soportes-hint">
        Se guardan en el expediente (pestaña Documentos, categoría «Soporte»). Máx. {MAX_ARCHIVO_MB} MB c/u.
      </p>
    </fieldset>
  );

  return { items, subiendo, creada, node, finalizar, bloqueado };
}
