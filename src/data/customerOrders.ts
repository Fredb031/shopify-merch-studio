// Per-customer past-order line items for the /account "Reorder this set"
// flow (Master Prompt Phase 2). The 20-row SHOPIFY_ORDERS_SNAPSHOT in
// shopifySnapshot.ts only carries header data (total, customer, itemsCount)
// — Shopify Admin doesn't expose line-items in that summary endpoint, and
// /account needs per-line product + colour + size + quantity to rebuild
// a cart.
//
// This file fills that gap for the signed-in customer experience by
// declaring a parallel map keyed by lowercase email → an ordered list of
// orders, each with line items pointing at canonical product ids declared
// in src/data/products.ts. The product ids are looked up at click-time
// via findProductByHandle; if a product has been retired since the order
// shipped, the reorder flow skips that line and surfaces a count toast.
//
// Why a static map instead of a live Shopify call: the storefront API key
// can't read order line-items for arbitrary customers (only the
// authenticated buyer's own orders, via the Customer Account API which we
// haven't wired yet). Moving this to a Supabase Edge Function that proxies
// Shopify Customer Account is tracked in the Phase-2 follow-up; until
// then this map gives the UI realistic shape so the reorder button is a
// finished feature instead of a stub.
//
// Frozen on export so a stray consumer can't mutate the snapshot mid-render
// (mirrors the pattern in src/data/shopifySnapshot.ts and orderLogos.ts).

export type CustomerOrderLineItem = Readonly<{
  /** Canonical product id from src/data/products.ts (e.g. 'atcf2500'). */
  productId: string;
  /** Canonical colour id from the product's `colors[].id` (e.g. 'navy'). */
  colorId: string;
  /** Display label shown on the order card before the user clicks
   * "Reorder this set" — e.g. "Hoodie ATC F2500 — Marine". Pre-rendered
   * so the row renders without a product lookup. */
  label: string;
  /** Per-size quantity breakdown, matching the live cart's
   * sizeQuantities shape so the reorder add can pass it through
   * unchanged. */
  sizeQuantities: ReadonlyArray<Readonly<{ size: string; quantity: number }>>;
  /** Per-unit price the customer paid on the original order, in CAD.
   * Used to populate unitPrice on the rebuilt cart line so the order
   * total matches what they remember (within tax/shipping). */
  unitPrice: number;
}>;

export type CustomerOrderRecord = Readonly<{
  /** Shopify order name, e.g. '#1568'. Surfaced in the card header. */
  name: string;
  /** ISO date string (matches SHOPIFY_ORDERS_SNAPSHOT.createdAt shape). */
  createdAt: string;
  /** Order total in CAD. Used in the card subtitle. */
  total: number;
  /** Line items the reorder button rebuilds into the local cart. */
  lineItems: ReadonlyArray<CustomerOrderLineItem>;
}>;

/**
 * Past-orders ledger keyed by lowercase email. Mirrors the demo accounts
 * surfaced in stores/authStore.ts so a President / admin signing in with
 * a known email lands on a populated /account page during demos. Real
 * customer orders will join this once the Shopify Customer Account API
 * proxy ships.
 */
export const CUSTOMER_ORDERS: Readonly<Record<string, ReadonlyArray<CustomerOrderRecord>>> = Object.freeze({
  // Demo account — Frédérick (president). Two prior orders mixing a
  // hoodie set and a polo set so the reorder flow has variety.
  'fredmalou12@gmail.com': Object.freeze([
    Object.freeze({
      name: '#1570-DEMO',
      createdAt: '2026-04-17T11:55:01-04:00',
      total: 742.96,
      lineItems: Object.freeze([
        Object.freeze({
          productId: 'atcf2500',
          colorId: 'navy',
          label: 'Hoodie ATC F2500 — Marine',
          sizeQuantities: Object.freeze([
            Object.freeze({ size: 'M', quantity: 6 }),
            Object.freeze({ size: 'L', quantity: 8 }),
            Object.freeze({ size: 'XL', quantity: 4 }),
          ]),
          unitPrice: 31.04,
        }),
        Object.freeze({
          productId: 'atc1000',
          colorId: 'black',
          label: 'T-shirt ATC 1000 — Noir',
          sizeQuantities: Object.freeze([
            Object.freeze({ size: 'S', quantity: 4 }),
            Object.freeze({ size: 'M', quantity: 8 }),
            Object.freeze({ size: 'L', quantity: 6 }),
          ]),
          unitPrice: 7.65,
        }),
      ]),
    }),
    Object.freeze({
      name: '#1552-DEMO',
      createdAt: '2026-04-05T15:46:53-04:00',
      total: 429.39,
      lineItems: Object.freeze([
        Object.freeze({
          productId: 's445',
          colorId: 'black',
          label: 'Polo S445 — Noir',
          sizeQuantities: Object.freeze([
            Object.freeze({ size: 'M', quantity: 4 }),
            Object.freeze({ size: 'L', quantity: 4 }),
            Object.freeze({ size: 'XL', quantity: 2 }),
          ]),
          unitPrice: 31.49,
        }),
      ]),
    }),
  ].map(o => Object.freeze(o))),
});

/**
 * Look up past orders for an authenticated customer. Email match is
 * case-insensitive and trims invisible whitespace defensively (paste
 * artefacts from Slack / Notion). Returns an empty array — never
 * undefined — so consumers can `.length`/`map` without a guard.
 */
export function getOrdersForEmail(email: string | null | undefined): ReadonlyArray<CustomerOrderRecord> {
  if (!email || typeof email !== 'string') return [];
  const key = email.trim().toLowerCase();
  if (!key) return [];
  return CUSTOMER_ORDERS[key] ?? [];
}
