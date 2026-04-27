/**
 * useProductColors — fetches real Shopify colors + front/back images
 * via Storefront API for a given product handle.
 *
 * Returns: live color list with imageDevant/imageDos per color.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { storefrontApiRequest, parseProductColors, PRODUCT_FULL_QUERY } from '@/lib/shopify';
import type { ShopifyVariantColor } from '@/lib/shopify';

// Dedupe by normalized colorName (trim+lowercase) and sort alphabetically
// so identical refetches produce identical array contents, and the UI
// swatch row has a stable visual order regardless of Shopify's variant
// insertion order. Shopify admin occasionally reorders variants when
// editing, which used to shuffle our swatches for no user-visible reason.
function dedupeAndSortColors(colors: ShopifyVariantColor[]): ShopifyVariantColor[] {
  const seen = new Set<string>();
  const unique: ShopifyVariantColor[] = [];
  for (const c of colors) {
    const key = (c.colorName ?? '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }
  // Pin the collator locale to 'en' instead of relying on the browser's
  // default. Without a fixed locale, two visitors in different regions
  // (e.g. Turkish 'i'/'I' rules, Swedish 'å' ordering) would see swatches
  // in different orders for the same product, defeating the whole point
  // of sorting here — which is to give every user a stable, predictable
  // visual order regardless of Shopify's variant insertion order.
  return unique.sort((a, b) =>
    (a.colorName ?? '').localeCompare(b.colorName ?? '', 'en', { sensitivity: 'base' })
  );
}

/**
 * Return type for useProductColors. Exposed so callers (e.g. wrapper
 * hooks / HOCs) can type their props without re-deriving it manually.
 */
export type ProductColors = ReturnType<typeof useProductColors>;

export function useProductColors(handle: string | undefined): UseQueryResult<ShopifyVariantColor[]> {
  // Normalize before the cache key so callers that pass 'ATCF2500',
  // ' atcf2500', or 'atcf2500\n' all hit the same React Query entry
  // instead of firing three duplicate Storefront requests for the same
  // product. Shopify handles are always lowercase by Shopify's own
  // rules — sending the normalized form also avoids a 404-on-mismatch
  // from the Storefront API when a stray capital slipped into the data
  // layer.
  const normalized = handle?.trim().toLowerCase() || undefined;
  return useQuery<ShopifyVariantColor[]>({
    queryKey: ['product-colors', normalized],
    queryFn: async () => {
      if (!normalized) return [];
      const data = await storefrontApiRequest(PRODUCT_FULL_QUERY, { handle: normalized });
      const product = data?.data?.product;
      if (!product) return [];
      return dedupeAndSortColors(parseProductColors(product));
    },
    enabled: !!normalized,
    // Colour/variant data is effectively static per product handle —
    // cache aggressively (30 min) so jumping between PDPs and the
    // catalogue grid doesn't re-hit Storefront for swatches we already
    // have. Shopify admin edits to variants are rare and a full reload
    // bypasses the cache anyway.
    staleTime: 30 * 60 * 1000,
    // Keep swatch data in memory for an hour after unmount so back/forward
    // navigation to a recently-viewed PDP feels instant instead of
    // flashing an empty swatch row while Storefront is re-queried.
    gcTime: 60 * 60 * 1000,
    // Retry transient Shopify blips with exponential backoff before
    // locking in an empty list for the 30-min staleTime. Without this,
    // a dropped fetch during PDP load showed no colour swatches for
    // the full stale window even if Shopify was up the whole time after.
    // The +Math.random()*300 jitter desynchronizes parallel hooks
    // (useProducts + useProductColors fire together on PDP mount) so
    // they don't retry in lock-step and re-trigger the same rate limit.
    retry: 2,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 5000) + Math.random() * 300,
    // Explicit structural sharing keeps the data array reference stable
    // across refetches whose payload deep-equals the previous one. Without
    // it, a background refetch that returns identical colours would still
    // produce a fresh array, busting downstream useMemo / React.memo gates
    // in consumers like ProductCustomizer that map over swatches on every
    // data change. React Query defaults this to true already; we pin it
    // here so a future QueryClient default flip can't silently regress.
    structuralSharing: true,
  });
}
