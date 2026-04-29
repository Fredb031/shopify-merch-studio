import { useEffect, useState } from 'react';

/**
 * useDebouncedValue — returns `value` but lagged by `delayMs`.
 *
 * Used to defer expensive downstream work (filter/sort/history pushes)
 * until the user has stopped changing the input for `delayMs`. The
 * caller keeps the live value for the controlled input itself so typing
 * stays responsive; only the lagged copy flows into the heavy pipeline.
 *
 * Cleanup cancels the pending setTimeout on each change, so rapid
 * keystrokes coalesce into a single trailing update once typing settles.
 */
// setTimeout silently truncates delays to a 32-bit signed int — anything
// above 2_147_483_647 wraps and fires immediately, which would defeat the
// debounce entirely if a caller ever piped through a polluted/computed
// delay. Cap at 24h (well under int32 max) so any pathological input still
// results in *some* debounce instead of a degenerate immediate update.
const MAX_DEBOUNCE_MS = 24 * 60 * 60 * 1000;

export function useDebouncedValue<T>(value: T, delayMs: number = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const finite = Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : 200;
    const safeDelay = Math.min(finite, MAX_DEBOUNCE_MS);
    const t = setTimeout(() => setDebounced(value), safeDelay);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
