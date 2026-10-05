'use client';

import { useRouter } from 'next/navigation';

/** Vuelve atrás únicamente cuando el origen pertenece al mismo módulo. */
export function useFormCancel(canonicalPath: string, modulePath = canonicalPath.split('?')[0], onCancel?: () => void) {
  const router = useRouter();
  return () => {
    let sameModule = false;
    try {
      const referrer = new URL(document.referrer);
      sameModule = referrer.origin === window.location.origin &&
        (referrer.pathname === modulePath || referrer.pathname.startsWith(`${modulePath}/`));
    } catch {
      // Sin referente válido, el historial no demuestra un regreso seguro al módulo.
    }
    if (window.history.length > 1 && sameModule) {
      if (onCancel) onCancel();
      else router.back();
    } else {
      router.replace(canonicalPath);
    }
  };
}
