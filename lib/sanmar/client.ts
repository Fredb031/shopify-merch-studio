import 'server-only';
import type {
  SanmarProduct,
  SanmarInventory,
  SanmarPricing,
  SanmarFetchResult,
} from './types';

const API_URL = process.env.SANMAR_CACHE_API_URL;
const TIMEOUT_MS = 3000;

async function fetchWithTimeout<T>(path: string): Promise<SanmarFetchResult<T>> {
  if (!API_URL) return { data: null, source: 'fallback' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const url = `${API_URL.replace(/\/$/, '')}${path}`;
    const res = await fetch(url, { signal: ctrl.signal, next: { revalidate: 60 } });
    clearTimeout(timer);
    if (!res.ok) {
      return {
        data: null,
        source: res.status === 404 ? 'fallback' : 'error',
        error: `HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as T;
    return { data, source: 'cache' };
  } catch (e) {
    clearTimeout(timer);
    return {
      data: null,
      source: 'error',
      error: e instanceof Error ? e.message : 'unknown',
    };
  }
}

export async function getProductFromCache(
  styleNumber: string,
): Promise<SanmarFetchResult<SanmarProduct>> {
  return fetchWithTimeout<SanmarProduct>(
    `/products/${encodeURIComponent(styleNumber)}`,
  );
}

export async function getInventoryFromCache(
  styleNumber: string,
  color?: string,
  size?: string,
): Promise<SanmarFetchResult<SanmarInventory>> {
  const qs = new URLSearchParams();
  if (color) qs.set('color', color);
  if (size) qs.set('size', size);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return fetchWithTimeout<SanmarInventory>(
    `/inventory/${encodeURIComponent(styleNumber)}${query}`,
  );
}

export async function getPricingFromCache(
  styleNumber: string,
  color?: string,
  size?: string,
): Promise<SanmarFetchResult<SanmarPricing>> {
  const qs = new URLSearchParams();
  if (color) qs.set('color', color);
  if (size) qs.set('size', size);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return fetchWithTimeout<SanmarPricing>(
    `/pricing/${encodeURIComponent(styleNumber)}${query}`,
  );
}
