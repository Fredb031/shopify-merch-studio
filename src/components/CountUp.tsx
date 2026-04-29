import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/langContext';

type CountUpProps = {
  to: number;
  durationMs?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
};

/**
 * CountUp — one-shot count-up animation triggered on first intersection
 * with the viewport. Uses requestAnimationFrame with ease-out-cubic.
 *
 * Accessibility: respects `prefers-reduced-motion: reduce` by rendering
 * the final value immediately (no animation frames, no visual motion).
 *
 * Locale note: formats the numeric output with French comma decimals
 * when `lang === 'fr'` so "4.9" reads as "4,9" — matches the existing
 * hero strip copy.
 */
export function CountUp({
  to,
  durationMs = 900,
  decimals = 0,
  suffix = '',
  prefix = '',
}: CountUpProps) {
  const { lang } = useLang();
  const nodeRef = useRef<HTMLSpanElement | null>(null);
  const hasRunRef = useRef(false);
  const [value, setValue] = useState<number>(() => {
    // SSR / initial render: start at 0 unless the user prefers reduced
    // motion — in which case we skip the animation entirely and render
    // the final value on the first paint.
    if (typeof window !== 'undefined' && window.matchMedia) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) return to;
    }
    return 0;
  });
  // Mirror `value` into a ref so the rAF effect can read the
  // most-recent displayed number when it kicks off without listing
  // `value` in its deps (which would re-run the effect on every frame
  // and cancel the in-flight animation it just spawned).
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const el = nodeRef.current;
    if (!el) return;

    // Reduced-motion: skip animation entirely.
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setValue(to);
      return;
    }

    // `to` is a non-finite number (NaN / ±Infinity) — toFixed() throws
    // on Infinity in some engines and renders a misleading 'NaN' string
    // otherwise, so short-circuit to a safe fallback. We freeze the
    // displayed value at 0 rather than blindly piping NaN into setValue
    // and the ease() math, which would propagate NaN through every
    // subsequent rAF tick.
    if (!Number.isFinite(to)) {
      setValue(0);
      return;
    }

    // Track the active rAF so unmount mid-animation cancels it. Without
    // this, the previous implementation returned a cleanup from the
    // inner `run()` closure but never propagated it to the outer
    // useEffect — so navigating away during the count-up would let the
    // last frame land on an unmounted node and warn in dev.
    let raf = 0;

    // Reset the one-shot guard whenever `to` changes so an updated
    // target re-animates from the current displayed value. Without this,
    // a parent that re-fetches a stat and hands a new `to` would see the
    // CountUp freeze at the previously-animated final value: the effect
    // re-runs, but `run()` short-circuits on `hasRunRef.current === true`
    // and the new target never lands on screen. Resetting per effect
    // run keeps the IntersectionObserver gate while letting subsequent
    // `to` updates animate naturally — and we capture the current
    // displayed `value` as the starting point so the count nudges from
    // where the user last saw it instead of snapping back to 0.
    hasRunRef.current = false;
    const startValue = valueRef.current;

    const run = () => {
      if (hasRunRef.current) return;
      hasRunRef.current = true;
      const start = performance.now();
      const from = startValue;
      // ease-out-cubic: 1 - (1 - t)^3
      const ease = (t: number) => 1 - Math.pow(1 - t, 3);
      const tick = (now: number) => {
        const elapsed = now - start;
        const t = Math.min(1, elapsed / durationMs);
        const v = from + (to - from) * ease(t);
        setValue(v);
        if (t < 1) {
          raf = requestAnimationFrame(tick);
        } else {
          raf = 0;
          setValue(to);
        }
      };
      raf = requestAnimationFrame(tick);
    };

    // IntersectionObserver: trigger once on first intersection.
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback: just run on mount.
      run();
      return () => {
        if (raf) cancelAnimationFrame(raf);
      };
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            run();
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0, rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [to, durationMs]);

  // Format with locale-aware decimal separator so "4.9" reads as "4,9"
  // in French (matches the rest of the hero strip copy).
  const fixed = value.toFixed(decimals);
  const formatted = lang === 'fr' ? fixed.replace('.', ',') : fixed;

  return (
    <span ref={nodeRef}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

export default CountUp;
