'use client';

import { useEffect } from 'react';

/** Registers the storefront service worker (production / HTTPS only). */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Skip noisy reloads in local `next dev` unless explicitly enabled.
    if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_PWA_DEV !== '1') {
      return;
    }

    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration can fail on non-secure origins; ignore.
    });
  }, []);

  return null;
}
