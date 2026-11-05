'use client';

import * as React from 'react';

/** Registers the single Firebase-aware service worker used for PWA and FCM. */
export function PwaRegister() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(() => {
      // Install support is optional; the app still works without it.
    });
  }, []);

  return null;
}
