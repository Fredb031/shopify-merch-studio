import { useCallback, useEffect, useState } from 'react';

const KEY = 'vision-recently-viewed';
const MAX = 8;

function readStorage(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Track + read the list of Shopify product handles the user has
 * recently viewed on this device. Most-recent first, deduped, capped
 * at MAX. Persists to localStorage so the list survives refreshes
 * and is cleared by authStore.signOut along with the rest of the
 * customer-scoped state.
 *
 * Use the `track(handle)` callback on ProductDetail so the current
 * product moves to the front of the list on each visit.
 */
export function useRecentlyViewed() {
  const [handles, setHandles] = useState<string[]>(readStorage);

  const track = useCallback((handle: string) => {
    if (!handle) return;
    setHandles(prev => {
      const next = [handle, ...prev.filter(h => h !== handle)].slice(0, MAX);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  }, []);

  // Re-read when another tab / authStore clears the list so the in-
  // memory view stays in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setHandles(readStorage());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { handles, track };
}
