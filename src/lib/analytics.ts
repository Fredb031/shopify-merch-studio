import { getCookieConsent } from '@/components/CookieConsent';

/**
 * Vendor-agnostic conversion-event dispatcher.
 *
 * Law 25 (Québec) requires explicit opt-in before any non-essential
 * tracker fires. `trackEvent` reads the persisted consent state on
 * every call and short-circuits when analytics !== true — no dataLayer
 * push, no gtag call, no localStorage mirror. The shop owner can swap
 * in GA4 / Plausible / Matomo later by pasting the vendor's snippet
 * into index.html; until then, the dispatches silently no-op because
 * `window.gtag` isn't defined and nothing reads the dataLayer queue.
 *
 * The localStorage mirror (capped at 200 entries, FIFO) is a
 * diagnostics aid for the shop owner — they can paste
 * `JSON.parse(localStorage.getItem('vision-analytics-queue'))` into
 * the console to inspect recent events during QA without needing a
 * live GA property configured.
 */

const QUEUE_KEY = 'vision-analytics-queue';
const QUEUE_CAP = 200;

type DataLayerPush = {
  event: string;
  params?: Record<string, unknown>;
  ts: string;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function appendToDiagnosticQueue(entry: DataLayerPush): void {
  // Swallow every throw — localStorage can reject on quota, private
  // mode, or a sandboxed iframe. Diagnostics mirror failing must
  // never break the caller's flow.
  try {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(QUEUE_KEY);
    let list: DataLayerPush[] = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) list = parsed as DataLayerPush[];
      } catch {
        // Corrupted payload — replace with a fresh queue rather than
        // carrying over whatever malformed JSON was there.
        list = [];
      }
    }
    list.push(entry);
    // FIFO cap: drop the oldest entries when we exceed the cap so the
    // queue never grows unbounded.
    if (list.length > QUEUE_CAP) {
      list = list.slice(list.length - QUEUE_CAP);
    }
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
  } catch {
    /* private mode / quota / blocked — silent */
  }
}

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  // Law 25 gate: until the user has explicitly opted in to analytics,
  // return early without touching dataLayer, gtag, or localStorage.
  const consent = getCookieConsent();
  if (!consent || consent.analytics !== true) return;

  const entry: DataLayerPush = {
    event: name,
    params,
    ts: new Date().toISOString(),
  };

  // dataLayer queue — the standard GTM/GA4 bootstrap looks for
  // `window.dataLayer` and replays its contents once the tag loads, so
  // events dispatched before the snippet initializes still count.
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(entry);
  } catch {
    /* non-extensible window (rare) — ignore */
  }

  // Direct gtag call when the GA4 snippet is already on the page.
  // Optional-chaining means this no-ops until the owner pastes the
  // snippet into index.html.
  try {
    window.gtag?.('event', name, params ?? {});
  } catch {
    /* vendor script threw — don't let it bubble to the caller */
  }

  appendToDiagnosticQueue(entry);
}
