/**
 * Analytics helper — Loi 25 compliant.
 *
 * Wraps the Plausible.io global `window.plausible` callable. All public
 * helpers here are no-ops when:
 *   - running on the server (typeof window === 'undefined')
 *   - the user has not granted `analytics` consent (defense in depth — the
 *     Plausible script itself is also gated on consent in <Analytics />)
 *   - the Plausible script hasn't loaded (e.g. operator hasn't configured
 *     the env vars, or it's still loading)
 *
 * Plausible auto-tracks pageviews when the script loads, so consumers only
 * need to call `trackEvent` for custom events (form submissions, key CTAs,
 * customizer milestones, etc).
 */

import { hasConsent } from '@/lib/cookieConsent';

type PlausibleProps = Record<string, string | number | boolean>;

type PlausibleFn = (
  event: string,
  opts?: { props?: Record<string, unknown>; callback?: () => void },
) => void;

type WindowWithPlausible = Window & { plausible?: PlausibleFn };

/**
 * Track a custom analytics event. Silently no-ops when consent is not
 * granted or when Plausible has not loaded.
 *
 * @example
 *   trackEvent('contact_form_submit', { locale: 'fr-ca' });
 *   trackEvent('customizer_complete', { kit_type: 'bistro' });
 */
export function trackEvent(event: string, props?: PlausibleProps): void {
  if (typeof window === 'undefined') return;
  if (!hasConsent('analytics')) return;
  const w = window as WindowWithPlausible;
  if (typeof w.plausible !== 'function') return;
  w.plausible(event, props ? { props } : undefined);
}

/**
 * Plausible auto-tracks pageviews via its loaded script, so this helper is
 * intentionally a no-op. Exposed for symmetry / future-proofing if the
 * provider is ever swapped for one that requires manual pageview calls.
 */
export function trackPageview(): void {
  // Plausible auto-tracks pageviews via the script; this is for custom events.
}
