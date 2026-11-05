'use client';

import * as React from 'react';

/**
 * Registers the service worker that handles install support, the offline
 * shell, and push notifications. Registration is skipped in development so
 * hot reload is never served from a cache.
 */
export function PwaRegister() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Install support is optional; the app still works without it.
    });
  }, []);

  return null;
}
