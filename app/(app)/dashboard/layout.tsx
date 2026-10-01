import type { Metadata } from 'next';
import type { ReactNode } from 'react';
export const metadata: Metadata = { title: 'Dashboard · Seven Save' };
export default function Layout({ children }: { children: ReactNode }) { return children; }
