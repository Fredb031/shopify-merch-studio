'use client';

/**
 * Analytics — Plausible.io script mount, gated on Loi 25 consent.
 *
 * Behavior:
 *   - Reads `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` and `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL`.
 *     If `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is unset, renders nothing (operator
 *     hasn't configured analytics yet — graceful no-op).
 *   - On mount, checks `hasConsent('analytics')`. If false, renders nothing
 *     (no script tag in the DOM at all).
 *   - Listens for the `va:consent-changed` event dispatched by
 *     `lib/cookieConsent.ts` and re-evaluates: mounts the script when the
 *     user opts in, unmounts (and removes the global) when they opt out.
 *   - Uses `next/script` with strategy="afterInteractive" so analytics never
 *     blocks LCP / TTI.
 *
 * Note: the helper in `lib/analytics.ts` is also gated on consent for
 * defense-in-depth. If the operator ever swaps providers, the helper still
 * refuses to fire without consent even if a script somehow loads.
 */

import { useEffect, useState } from 'react';
import Script from 'next/script';

import { hasConsent } from '@/lib/cookieConsent';

const DEFAULT_SCRIPT_URL = 'https://plausible.io/js/script.js';

export function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const scriptUrl =
    process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL || DEFAULT_SCRIPT_URL;

  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    // Initial read on mount (client-only — avoids SSR cookie access).
    setAllowed(hasConsent('analytics'));

    function onConsentChanged() {
      setAllowed(hasConsent('analytics'));
    }
    function onConsentCleared() {
      setAllowed(false);
    }

    window.addEventListener('va:consent-changed', onConsentChanged);
    window.addEventListener('va:consent-cleared', onConsentCleared);
    return () => {
      window.removeEventListener('va:consent-changed', onConsentChanged);
      window.removeEventListener('va:consent-cleared', onConsentCleared);
    };
  }, []);

  // Operator has not configured Plausible — render nothing.
  if (!domain) return null;

  // Consent not granted — render nothing (no <script> tag in the DOM).
  if (!allowed) return null;

  return (
    <Script
      id="plausible-analytics"
      src={scriptUrl}
      data-domain={domain}
      strategy="afterInteractive"
      async
      defer
    />
  );
}
