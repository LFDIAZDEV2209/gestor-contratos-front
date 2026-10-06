'use client';
import { Icon } from '../icons';
import { Button } from './button';

/** Error del API y/o advertencias 422 con «Continuar de todos modos» (reenvío con force=true). */
export const AvisoApi = ({
  error,
  advertencias,
  onForzar,
  cargando = false,
}: {
  error?: string;
  advertencias?: string[];
  onForzar?: () => void;
  cargando?: boolean;
}) => (
  <>
    {error && (
      <div className="alert-box err mb" role="alert">
        <Icon name="alert-circle" /> <div>{error}</div>
      </div>
    )}
    {!!advertencias?.length && (
      <div className="alert-box warn mb" role="alert">
        <Icon name="triangle-exclamation" />
        <div>
          <b>El servidor reporta advertencias:</b>
          <ul style={{ margin: '4px 0 8px', paddingLeft: 18 }}>
            {advertencias.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          {onForzar && (
            <Button className="btn xs pri" onClick={onForzar} loading={cargando}>
              {cargando ? 'Enviando…' : 'Continuar de todos modos'}
            </Button>
          )}
        </div>
      </div>
    )}
  </>
);
