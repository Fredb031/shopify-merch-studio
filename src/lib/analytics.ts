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

/**
 * Operator drops the real Pixel ID here once Meta Business Manager
 * provisions it. Until then `YOUR_PIXEL_ID` stays as a sentinel and
 * the init call below short-circuits — no network request to
 * connect.facebook.net, no events leave the device.
 *
 * CAPI server-side mirror is operator follow-up: a Supabase edge
 * function with the `META_ACCESS_TOKEN` secret that POSTs the same
 * events to Meta's Conversions API for iOS-blocking-resistant
 * attribution (see Volume II Section 08.1 brief).
 */
const META_PIXEL_ID = 'YOUR_PIXEL_ID';

/**
 * Lazy one-shot init — `fbq('init', ...)` must run exactly once per
 * page session, AFTER the visitor grants marketing consent. The
 * index.html stub registers `window.fbq` and queues calls; calling
 * init here flushes the queue and starts the auto-PageView. We track
 * the init state on the window so a hot-reload or duplicate import
 * doesn't double-init (Meta logs a warning + double-counts PageView).
 */
function ensurePixelInit(): void {
  if (typeof window === 'undefined') return;
  if (!window.fbq) return; // base stub not on the page yet
  if (META_PIXEL_ID === 'YOUR_PIXEL_ID') return; // operator hasn't set the ID
  const w = window as Window & { __vaPixelInitialized?: boolean };
  if (w.__vaPixelInitialized) return;
  try {
    window.fbq('init', META_PIXEL_ID);
    w.__vaPixelInitialized = true;
  } catch {
    /* vendor script threw — don't let it bubble to the caller */
  }
}

type DataLayerPush = {
  event: string;
  params?: Record<string, unknown>;
  ts: string;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Map our vendor-neutral event names to Meta Pixel's standard event
 * vocabulary. Events not in this map are skipped for Pixel dispatch —
 * Meta's standard-event set is closed and custom events require a
 * different call shape (`trackCustom`) we don't need yet.
 */
const PIXEL_EVENT_MAP: Record<string, string> = {
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
  purchase: 'Purchase',
  select_product: 'ViewContent',
};

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
  // Law 25 gates: analytics consent controls GA4/dataLayer/diagnostics;
  // marketing consent controls the Meta Pixel dispatch. They're
  // independent categories in CookieConsent so we check each separately
  // and fire whichever the visitor has opted into.
  const consent = getCookieConsent();
  if (!consent) return;

  const entry: DataLayerPush = {
    event: name,
    params,
    ts: new Date().toISOString(),
  };

  if (consent.analytics === true) {
    // dataLayer queue — the standard GTM/GA4 bootstrap looks for
    // `window.dataLayer` and replays its contents once the tag loads,
    // so events dispatched before the snippet initializes still count.
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

  if (consent.marketing === true) {
    // Meta Pixel dispatch. The base loader stub in index.html
    // registers `window.fbq` on first paint, but we hold off on the
    // `init` call until consent is granted — that's the moment the
    // first network request to connect.facebook.net is allowed to
    // fire. ensurePixelInit() is idempotent; subsequent events skip
    // straight to track. We only forward events that map to a Meta
    // standard event — unmapped names are skipped (trackCustom would
    // be a separate call shape we don't need yet).
    ensurePixelInit();
    const pixelEvent = PIXEL_EVENT_MAP[name];
    if (pixelEvent) {
      try {
        window.fbq?.('track', pixelEvent, params ?? {});
      } catch {
        /* vendor script threw — don't let it bubble to the caller */
      }
    }
  }
}
