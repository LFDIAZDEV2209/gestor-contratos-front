'use client';
import Link from 'next/link';
import { Surface, PageHeader } from './Workspace';
import { Button } from './button';
import { Icon } from '../icons';
export interface RouteErrorProps { error: Error & { digest?: string }; retry: () => void; }

export function RouteError({ error, retry }: RouteErrorProps) {
  return <Surface className="route-state"><span className="badge b-crit">Error de carga</span><h1>No pudimos mostrar esta vista</h1><p>Tus datos guardados siguen disponibles. Intenta cargar la vista de nuevo.</p><div className="row-flex"><Button onClick={() => retry()} variant="primary"><Icon name="refresh" /> Reintentar</Button><Link className="btn" href="/dashboard">Volver al inicio</Link></div><details><summary>Referencia técnica</summary><code>{error.digest || 'Error local sin identificador de servidor'}</code></details></Surface>;
}
export function RouteNotFound({ resource = 'Página' }: { resource?: string }) {
  return <Surface className="route-state"><span className="badge b-na">404</span><h1>{resource} no encontrada</h1><p>El enlace no existe o el registro no está disponible en este espacio de trabajo.</p><Link className="btn pri" href="/dashboard">Volver al inicio</Link></Surface>;
}
export function ForbiddenState() {
  return <Surface className="route-state"><span className="badge b-risk">403 · Acceso restringido</span><h1>No tienes permiso para esta vista</h1><p>Selecciona un usuario autorizado desde el menú superior o vuelve al inicio.</p><Link className="btn pri" href="/dashboard">Volver al inicio</Link></Surface>;
}
