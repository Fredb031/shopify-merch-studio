import { useCallback, useEffect, useState } from 'react';

const KEY = 'vision-wishlist';
// Hard cap so a bored user smashing hearts on every product doesn't
// push the wishlist into the multi-KB range and blow localStorage
// quota for the cart + customizer state that shares it.
const MAX = 50;

function readStorage(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    // Dedup + filter non-strings in one pass. A corrupted list with
    // duplicate handles would otherwise render duplicate cards in the
    // wishlist grid AND trigger React's list-key warning (the grid
    // uses the handle as the key).
    const seen = new Set<string>();
    const out: string[] = [];
    for (const x of raw) {
      if (typeof x !== 'string' || seen.has(x)) continue;
      seen.add(x);
      out.push(x);
      if (out.length >= MAX) break;
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Persist the customer's wishlist (Shopify product handles) to
 * localStorage. Most-recent first — toggling an already-saved handle
 * moves it to the top, while a fresh save prepends it. Cross-tab sync
 * via the storage event so a like on one tab appears on the others.
 */
export function useWishlist() {
  const [handles, setHandles] = useState<string[]>(readStorage);

  const toggle = useCallback((handle: string) => {
    if (!handle) return;
    setHandles(prev => {
      const without = prev.filter(h => h !== handle);
      const next = (without.length === prev.length ? [handle, ...prev] : without).slice(0, MAX);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  }, []);

  const has = useCallback((handle: string) => handles.includes(handle), [handles]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setHandles(readStorage());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { handles, toggle, has };
}
