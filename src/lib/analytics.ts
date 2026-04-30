import { getCookieConsent } from '@/lib/cookieConsentStore';

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
const META_PIXEL_PLACEHOLDER = 'YOUR_PIXEL_ID';

/**
 * Single source of truth for "is the operator-supplied Pixel ID real?"
 * Both the bootstrap (`ensurePixelInit`) and the per-event dispatch in
 * `trackEvent` consult this — without the dispatch-site check, a stray
 * `window.fbq` left behind by a previously-configured tenant or a
 * browser extension could cause us to call `fbq('track', ...)` while
 * the placeholder is still in the source, leaking event names to
 * whatever pixel that fbq instance is bound to. Trim defends against
 * accidental whitespace in a paste.
 */
function isPixelConfigured(): boolean {
  return (
    typeof META_PIXEL_ID === 'string' &&
    META_PIXEL_ID.trim() !== '' &&
    META_PIXEL_ID !== META_PIXEL_PLACEHOLDER
  );
}

/**
 * Lazy one-shot init — `fbq('init', ...)` must run exactly once per
 * page session, AFTER the visitor grants marketing consent. We used
 * to ship the Meta base-loader inline in index.html, but Law 25
 * forbids that: the loader's script-tag injection causes the browser
 * to fetch fbevents.js, which sets a `fr` cookie on
 * connect.facebook.net BEFORE the visitor opts in. The fix is to
 * defer everything — the queue stub, the script injection, and the
 * init call — until marketing consent flips true.
 *
 * Flow on first call after consent:
 *   1. Install the Meta queue stub (window.fbq) so events that fire
 *      between now and onload don't error.
 *   2. Inject <script src="connect.facebook.net/en_US/fbevents.js"
 *      async> into <head>.
 *   3. Wait for onload, then call fbq('init', META_PIXEL_ID) which
 *      flushes the queued calls and starts the auto-PageView.
 *
 * Idempotent via window.__vaPixelInitialized — a hot-reload or a
 * second consent grant in the same session won't double-fetch the
 * script or double-count PageView.
 */
function ensurePixelInit(): void {
  if (typeof window === 'undefined') return;
  if (!isPixelConfigured()) return; // operator hasn't set the ID
  const w = window as Window & { __vaPixelInitialized?: boolean };
  if (w.__vaPixelInitialized) return;
  // Mark initialized up-front so concurrent callers in the same tick
  // don't race to inject two <script> tags before onload fires.
  w.__vaPixelInitialized = true;

  try {
    // Step 1: install the Meta queue stub. This is the same snippet
    // that used to live in index.html, minus the script-tag injection
    // (we do that ourselves in step 2 so we can gate it on consent).
    // It registers window.fbq as a queueing shim that callers can
    // safely invoke before fbevents.js finishes downloading.
    const f = window as Window & {
      fbq?: ((...args: unknown[]) => void) & {
        callMethod?: (...args: unknown[]) => void;
        queue?: unknown[];
        push?: unknown;
        loaded?: boolean;
        version?: string;
      };
      _fbq?: unknown;
    };
    if (!f.fbq) {
      const n: ((...args: unknown[]) => void) & {
        callMethod?: (...args: unknown[]) => void;
        queue?: unknown[];
        push?: unknown;
        loaded?: boolean;
        version?: string;
      } = function (...args: unknown[]) {
        if (n.callMethod) {
          n.callMethod.apply(n, args);
        } else {
          (n.queue as unknown[]).push(args);
        }
      };
      f.fbq = n;
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
    }

    // Step 2: dynamically inject the Pixel script. Only NOW does the
    // browser open the connection to connect.facebook.net and accept
    // the `fr` cookie — which is fine because we're already past the
    // marketing-consent gate in trackEvent().
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    script.onload = () => {
      // Step 3: flush the queue + start auto-PageView.
      try {
        window.fbq?.('init', META_PIXEL_ID);
      } catch {
        /* vendor script threw — don't let it bubble to the caller */
      }
    };
    script.onerror = () => {
      // Network blocked the request (ad-blocker, DNS failure, CSP).
      // Reset the guard so a future consent grant or retry can try
      // again rather than being permanently stuck. Also remove the
      // orphan <script> node so retries don't accumulate dead tags
      // in <head> across multiple failed attempts.
      w.__vaPixelInitialized = false;
      script.parentNode?.removeChild(script);
    };
    const head = document.head || document.getElementsByTagName('head')[0];
    head.appendChild(script);
  } catch {
    // Anything in the bootstrap path threw — clear the guard so the
    // next consented event has a chance to retry.
    w.__vaPixelInitialized = false;
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
        if (Array.isArray(parsed)) {
          // Defensive: drop entries that don't shape-match DataLayerPush
          // so a single corrupted/foreign write can't pollute the queue
          // forever (entries persist across reloads via localStorage).
          list = parsed.filter(
            (e): e is DataLayerPush =>
              !!e &&
              typeof e === 'object' &&
              typeof (e as DataLayerPush).event === 'string' &&
              typeof (e as DataLayerPush).ts === 'string',
          );
        }
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

  if (consent.marketing === true && isPixelConfigured()) {
    // Meta Pixel dispatch. Nothing Pixel-related is on the page until
    // we get here — ensurePixelInit() installs the fbq queue stub,
    // injects fbevents.js, and fires `init` once the script onloads.
    // That's the moment the first network request to
    // connect.facebook.net is allowed to fire (Law 25). It's
    // idempotent; subsequent events skip straight to track. We only
    // forward events that map to a Meta standard event — unmapped
    // names are skipped (trackCustom would be a separate call shape
    // we don't need yet). The isPixelConfigured() guard ensures we
    // never call `fbq('track', ...)` while the operator placeholder
    // is still in source — a foreign `window.fbq` (browser extension,
    // previously-configured tenant) would otherwise receive our
    // events.
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
