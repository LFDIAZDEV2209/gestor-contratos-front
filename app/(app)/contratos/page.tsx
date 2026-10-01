'use client';
import { Suspense } from 'react';
import { ContratosView } from '@/components/views/ContratosView';
import { WorkspaceSkeleton } from '@/components/ui/Workspace';
export default function Page() {
  return <Suspense fallback={<WorkspaceSkeleton />}><ContratosView /></Suspense>;
}
