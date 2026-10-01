'use client';
import { useOptimistic, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** La URL es canónica; el estado optimista evita bloquear los controles al reemplazarla. */
export function useQueryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [optimistic, setOptimistic] = useOptimistic(search.toString());
  const [, startTransition] = useTransition();
  const params = new URLSearchParams(optimistic);
  function update(values: Record<string, string | null>) {
    const next = new URLSearchParams(optimistic);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value); else next.delete(key);
    }
    const query = next.toString();
    startTransition(() => {
      setOptimistic(query);
      router.replace(pathname + (query ? '?' + query : ''), { scroll: false });
    });
  }
  return [params, update] as const;
}
