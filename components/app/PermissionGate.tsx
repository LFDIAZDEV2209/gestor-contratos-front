'use client';
import type { ReactNode } from 'react';
import { AuthService } from '@/lib/store';
import { useSessionRevision } from './SessionContext';
import { ForbiddenState } from '../ui/RouteStates';
export function PermissionGate({ children, permission, roles }: { children: ReactNode; permission?: string; roles?: string[] }) {
  useSessionRevision();
  const user = AuthService.currentUser();
  const allowed = user?.estado === 'Activo' && (!permission || AuthService.can(permission)) && (!roles || roles.includes(user.rol));
  return allowed ? children : <ForbiddenState />;
}
