'use client';
import './globals.css';
import { RouteError, type RouteErrorProps } from '@/components/ui/RouteStates';
export default function GlobalError(props: RouteErrorProps) {
  return <html lang="es"><head><title>Error · Seven Save</title></head><body><main className="route-standalone"><RouteError {...props} /></main></body></html>;
}
