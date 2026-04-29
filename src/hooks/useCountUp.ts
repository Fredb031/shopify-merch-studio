import { useEffect, useState } from 'react';

const DEFAULT_DURATION_MS = 1500;

/**
 * Animates a number from 0 to `target` once `inView` flips to true.
 * Uses ease-out cubic curve. Returns the integer count.
 */
export function useCountUp(target: number, inView: boolean, duration = DEFAULT_DURATION_MS): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView || !Number.isFinite(target) || target <= 0 || duration <= 0) {
      if (target <= 0) setCount(0);
      return;
    }

    // Respect prefers-reduced-motion: skip animation, snap to final value.
    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setCount(Math.floor(target));
      return;
    }

    let raf = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      if (progress >= 1) {
        // Snap to the rounded target so the final frame matches the
        // integer-typed contract documented at the top of the hook (and
        // matches every intermediate frame, which already runs through
        // Math.round). Without the round, a fractional `target` like
        // 4.9 (e.g. a Google rating count derived from a divide) would
        // leave `count` at 4.9 on the final tick — the previous frames
        // rounded to 5, so the displayed number bumped 4 → 5 → 4.9 in
        // the last sub-second of the animation. Also matches the
        // reduced-motion path's `Math.floor(target)` in spirit so every
        // exit from the animation lands on an integer.
        setCount(Math.round(target));
        return;
      }
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, duration]);

  return count;
}
