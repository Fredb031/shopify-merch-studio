'use client';

import { useEffect, useRef, useState } from 'react';
import { Container } from '../Container';

export type StatItem = {
  /** Final formatted value to display when fully animated. */
  value: string;
  /** Optional purely-numeric target — if provided, used to animate count-up. */
  numericTarget?: number;
  /** Prefix shown before the numeric digits during count-up (e.g. ""). */
  prefix?: string;
  /** Suffix shown after the numeric digits during count-up (e.g. "+", " jours"). */
  suffix?: string;
  /** Locale-appropriate thousands separator and decimal handling. */
  formatter?: 'integer' | 'thousands' | 'decimal-1' | 'none';
  label: string;
};

type Props = {
  items: StatItem[];
};

/**
 * Compact strip rendered directly under the hero. Numbers count up on
 * intersection (one-shot). Respects prefers-reduced-motion (snaps to final).
 */
export function StatStrip({ items }: Props) {
  return (
    <section
      aria-label="Key numbers"
      className="bg-canvas-050 py-12 md:py-16 border-y border-sand-300/40"
    >
      <Container size="2xl">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4 md:gap-x-4 md:divide-x md:divide-sand-300/60">
          {items.map((item, idx) => (
            <li
              key={idx}
              className={`flex flex-col items-start text-left md:items-center md:text-center md:px-4 ${
                idx > 0 ? 'md:pl-6' : ''
              }`}
            >
              <StatNumber item={item} />
              <span className="mt-2 max-w-[18ch] text-body-sm text-stone-500">
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

function StatNumber({ item }: { item: StatItem }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState<string>(() =>
    item.numericTarget !== undefined ? formatPartial(0, item) : item.value,
  );

  useEffect(() => {
    if (item.numericTarget === undefined) {
      setDisplay(item.value);
      return;
    }

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      setDisplay(item.value);
      return;
    }

    const node = ref.current;
    if (!node) return;

    let started = false;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !started) {
            started = true;
            runCountUp(item, setDisplay);
            observer.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [item]);

  return (
    <span
      ref={ref}
      className="text-display-lg md:text-display-xl text-ink-950 tabular-nums"
    >
      {display}
    </span>
  );
}

function runCountUp(
  item: StatItem,
  setDisplay: (value: string) => void,
) {
  if (item.numericTarget === undefined) return;
  const target = item.numericTarget;
  const duration = 1400;
  const start = performance.now();

  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - t, 3);
    const current = target * eased;
    if (t >= 1) {
      setDisplay(item.value);
      return;
    }
    setDisplay(formatPartial(current, item));
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function formatPartial(value: number, item: StatItem): string {
  const prefix = item.prefix ?? '';
  const suffix = item.suffix ?? '';
  const fmt = item.formatter ?? 'integer';
  let body: string;
  if (fmt === 'integer') {
    body = Math.round(value).toString();
  } else if (fmt === 'thousands') {
    // 33000 -> "33 000" (FR), with non-breaking space for thousands
    body = Math.round(value)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  } else if (fmt === 'decimal-1') {
    body = value.toFixed(1);
  } else {
    body = Math.round(value).toString();
  }
  return `${prefix}${body}${suffix}`;
}
