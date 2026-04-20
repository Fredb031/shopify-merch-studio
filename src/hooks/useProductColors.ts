/**
 * useProductColors — fetches real Shopify colors + front/back images
 * via Storefront API for a given product handle.
 *
 * Returns: live color list with imageDevant/imageDos per color.
 */
import { useQuery } from '@tanstack/react-query';
import { storefrontApiRequest, parseProductColors, PRODUCT_FULL_QUERY } from '@/lib/shopify';
import type { ShopifyVariantColor } from '@/lib/shopify';

export function useProductColors(handle: string | undefined) {
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
      return parseProductColors(product);
    },
    enabled: !!normalized,
    staleTime: 5 * 60 * 1000, // 5 min cache
    // Retry transient Shopify blips with exponential backoff before
    // locking in an empty list for the 5-min staleTime. Without this,
    // a dropped fetch during PDP load showed no colour swatches for
    // five full minutes even if Shopify was up the whole time after.
    retry: 2,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 5000),
  });
}
