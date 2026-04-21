/**
 * useSanmarInventory — React Query hook for live SanMar Canada stock
 *
 * Pass the SanMar style number (e.g. "ATCF2500") and you get back live
 * inventory across all warehouses, with cross-color/size aggregation.
 *
 * Caches for 2 minutes to avoid hammering the API while a user browses.
 * Returns `null` if the edge function isn't deployed yet — the UI degrades
 * gracefully rather than breaking.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sanmar, summarizeStock, type SanmarInventoryPart, type StockSummary } from '@/lib/sanmar';

export interface SanmarInventoryResult {
  parts: SanmarInventoryPart[] | null;
  summary: StockSummary;
  isLoading: boolean;
  error: unknown;
}

export function useSanmarInventory(styleNumber: string | null | undefined): SanmarInventoryResult {
  // Normalize before the cache key so 'ATCF2500', ' atcf2500 ', and
  // 'atcf2500\n' all hit the same React Query entry instead of firing
  // three duplicate edge-function requests for the same product. SanMar
  // style numbers are canonically uppercase per their API docs — sending
  // the normalized form also avoids a 'not found' from the edge function
  // when a stray lowercase / whitespace slipped into a vendor-imported
  // SKU. Mirrors the trim+normalize pattern useProductColors /
  // useWishlist / useRecentlyViewed already apply to handles.
  const normalized = styleNumber?.trim().toUpperCase() || null;
  const enabled = !!normalized;

  const { data, isLoading, error } = useQuery({
    queryKey: ['sanmar-inventory', normalized],
    queryFn: () => (normalized ? sanmar.getInventory(normalized) : Promise.resolve(null)),
    enabled,
    staleTime: 2 * 60 * 1000, // 2 min — inventory doesn't change that often
    retry: 1,
  });

  // Memoize the summary keyed on the data reference — without this,
  // every parent re-render computed a fresh StockSummary object and
  // any downstream useMemo / useEffect depending on `summary` as a
  // reference would re-run unnecessarily. React Query already
  // stabilizes `data` across renders as long as it hasn't refetched.
  const summary = useMemo(() => summarizeStock(data ?? null), [data]);

  return {
    parts: data ?? null,
    summary,
    isLoading,
    error,
  };
}
