// Per-order logo metadata.
//
// The Shopify snapshot in shopifySnapshot.ts is a flat order list with
// no attachments — the logos live in the `vision-logos` Supabase bucket
// keyed by order ID (Phase B3 of QUOTE-ORDER-WORKFLOW.md). Until that
// edge function lands, this module seeds deterministic mock metadata
// for a handful of recent orders so the admin UI can render the three
// conversion states (ready / queued / raster-only) without waiting on
// the backend.
//
// Shape is intentionally close to what the Supabase join will return
// so the admin page can move to real data by swapping this export for
// a `useOrderLogos(orderId)` hook without touching the UI.
//
// NOTE: mock thumbnails reuse /placeholder.svg — shipping real client
// logos in the git history would be a data-leak. Production swaps in
// the real object-storage URLs.
//
// The fixture map, every logo array inside it, and the badge label /
// color records are deep-frozen on export so a stray consumer (or a
// future bug in AdminOrders/AdminCustomerDetail) can't write
// `LOGO_FIXTURES[7340967657587][0].state = 'ready'` mid-session and
// silently flip a queued logo to a downloadable badge — which would
// either hand the customer a 404 or break the worker hand-off.
// Promoting the type aliases to `Readonly<...>` and the records to
// `Readonly<Record<...>>` surfaces the same guarantee at compile time
// so a "let me just patch this row" attempt fails the build instead
// of corrupting prod. Both consumers (AdminCustomerDetail uses
// `.map(l => ...)` for the title attribute, AdminOrders reads
// `logo.state` into LOGO_STATE_LABEL/LOGO_STATE_COLOR lookups) only do
// read ops, so this is a pure tightening — no fixture values, attachment
// shapes, or runtime behaviour change. Mirrors the freeze pattern
// applied in pricing.ts (ba33680), tax.ts (20d0b05), deliveryOptions.ts
// (c48c04d), caseStudies.ts (7df2683), industryProof.ts (d46762e), and
// experiments.ts (5492998).

export type LogoConversionState =
  /** Already SVG or worker has produced one — download is instant. */
  | 'ready'
  /** Worker is queued or mid-run. UI shows spinner + offers raster fallback. */
  | 'queued'
  /** PNG/JPG upload with no SVG yet — UI offers raster fallback + toast. */
  | 'raster-only';

export type OrderLogoAttachment = Readonly<{
  /** Stable key so React lists don't rekey on reorder. */
  id: string;
  /** Display name shown above the thumbnail. */
  label: string;
  /** Thumbnail URL — same image the customer uploaded. */
  previewUrl: string;
  /** The raster / SVG itself as a downloadable URL. Same as previewUrl
   * for bucket-served assets. */
  sourceUrl: string;
  /** File extension of the source (png, jpg, svg, pdf). Drives the
   * download filename + the "needs vectorization" decision. */
  sourceExt: 'png' | 'jpg' | 'jpeg' | 'svg' | 'pdf' | 'ai';
  /** Conversion pipeline state. */
  state: LogoConversionState;
  /** If state === 'ready', this is the SVG download URL (may be the
   * same as sourceUrl when the customer uploaded an SVG directly). */
  svgUrl?: string;
}>;

// Deterministic seed: same order ID always maps to the same logo set,
// so refreshing the admin page doesn't flip badges around. Deep-frozen
// (outer record + each logo array + each attachment row) so the fixture
// can't be hot-patched mid-session.
const LOGO_FIXTURES: Readonly<Record<number, readonly OrderLogoAttachment[]>> =
  Object.freeze({
    // Order #1570 — raster-only PNG, waiting on the worker
    7340967657587: Object.freeze([
      Object.freeze({
        id: 'logo-1570-a',
        label: 'Logo principal (dos)',
        previewUrl: '/placeholder.svg',
        sourceUrl: '/placeholder.svg',
        sourceExt: 'png',
        state: 'raster-only',
      }),
    ]),
    // Order #1569 — SVG already, download ready
    7337444409459: Object.freeze([
      Object.freeze({
        id: 'logo-1569-a',
        label: 'Logo Vitrex Entretiens',
        previewUrl: '/placeholder.svg',
        sourceUrl: '/placeholder.svg',
        sourceExt: 'svg',
        state: 'ready',
        svgUrl: '/placeholder.svg',
      }),
    ]),
    // Order #1568 — queued (worker running)
    7336965210227: Object.freeze([
      Object.freeze({
        id: 'logo-1568-a',
        label: 'Logo CZ Esthétique',
        previewUrl: '/placeholder.svg',
        sourceUrl: '/placeholder.svg',
        sourceExt: 'jpg',
        state: 'queued',
      }),
    ]),
    // Order #1567 — two logos, mixed states (demonstrates Phase B7 grid)
    7336649425011: Object.freeze([
      Object.freeze({
        id: 'logo-1567-a',
        label: 'Logo Cuisines (devant)',
        previewUrl: '/placeholder.svg',
        sourceUrl: '/placeholder.svg',
        sourceExt: 'svg',
        state: 'ready',
        svgUrl: '/placeholder.svg',
      }),
      Object.freeze({
        id: 'logo-1567-b',
        label: 'Logo slogan (dos)',
        previewUrl: '/placeholder.svg',
        sourceUrl: '/placeholder.svg',
        sourceExt: 'png',
        state: 'raster-only',
      }),
    ]),
  });

// Empty array reused for the "no logos" branch so we hand consumers a
// frozen reference instead of allocating (and accidentally exposing) a
// fresh mutable array on every miss.
const EMPTY_LOGOS: readonly OrderLogoAttachment[] = Object.freeze([]);

/** Return the logos attached to a given Shopify order ID, or an empty
 * (frozen) array when none were found. The admin page renders the
 * "no logo" empty state based on an empty return. */
export function getOrderLogos(orderId: number): readonly OrderLogoAttachment[] {
  return LOGO_FIXTURES[orderId] ?? EMPTY_LOGOS;
}

/** Badge display metadata. Mirrors the FIN_COLOR/FUL_COLOR maps
 * already used in AdminOrders so the visual language stays uniform. */
export const LOGO_STATE_LABEL: Readonly<Record<LogoConversionState, string>> =
  Object.freeze({
    ready: 'Prêt',
    queued: 'En file',
    'raster-only': 'Brouillon raster',
  });

export const LOGO_STATE_COLOR: Readonly<Record<LogoConversionState, string>> =
  Object.freeze({
    ready: 'bg-emerald-100 text-emerald-800',
    queued: 'bg-amber-50 text-amber-700',
    'raster-only': 'bg-zinc-100 text-zinc-700',
  });
