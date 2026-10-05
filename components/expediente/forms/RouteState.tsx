'use client';

import { useEffect, useRef, type ComponentProps } from 'react';
import { EmptyState } from '../../ui/Workspace';

/** Estado de acceso con título semántico y foco al entrar directamente. */
export function RouteState({ title, ...props }: ComponentProps<typeof EmptyState>) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section><h1 ref={heading} tabIndex={-1}>{title}</h1><EmptyState {...props} title="" /></section>;
}
