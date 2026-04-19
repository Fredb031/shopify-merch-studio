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
  const enabled = !!styleNumber && styleNumber.length > 0;

  const { data, isLoading, error } = useQuery({
    queryKey: ['sanmar-inventory', styleNumber],
    queryFn: () => (styleNumber ? sanmar.getInventory(styleNumber) : Promise.resolve(null)),
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
