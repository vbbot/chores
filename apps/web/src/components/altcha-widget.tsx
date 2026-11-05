'use client';

import * as React from 'react';

interface AltchaWidgetProps {
  onPayload: (payload: string | null) => void;
  resetKey?: number;
}

/**
 * ALTCHA proof-of-work widget. The server verifies the payload before any
 * password check or account creation, so the widget cannot be skipped.
 */
export function AltchaWidget({ onPayload, resetKey = 0 }: AltchaWidgetProps) {
  const ref = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    import('altcha').catch(() => undefined);
  }, []);

  React.useEffect(() => {
    const widget = ref.current as
      | (HTMLElement & { reset?: (state?: string) => void })
      | null;
    if (!widget) return;

    const handleVerified = (event: Event) => {
      const detail = (event as CustomEvent<{ payload?: string }>).detail;
      onPayload(detail?.payload ?? null);
    };
    const handleState = (event: Event) => {
      const detail = (event as CustomEvent<{ state?: string }>).detail;
      if (detail?.state === 'unverified' || detail?.state === 'error') {
        onPayload(null);
      }
    };
    const handleExpired = () => onPayload(null);

    widget.addEventListener('verified', handleVerified);
    widget.addEventListener('statechange', handleState);
    widget.addEventListener('expired', handleExpired);
    return () => {
      widget.removeEventListener('verified', handleVerified);
      widget.removeEventListener('statechange', handleState);
      widget.removeEventListener('expired', handleExpired);
    };
  }, [onPayload]);

  React.useEffect(() => {
    if (!resetKey) return;
    (ref.current as HTMLElement & { reset?: () => void } | null)?.reset?.();
    onPayload(null);
  }, [resetKey, onPayload]);

  return React.createElement('altcha-widget', {
    ref,
    challenge: '/api/altcha/challenge',
    auto: 'onload',
    name: 'altcha',
    language: 'en',
    workers: 2,
    className: 'mt-2',
  });
}
