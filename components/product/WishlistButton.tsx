'use client';

import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useWishlist } from '@/lib/wishlist';

type Size = 'sm' | 'md';

type Props = {
  productId: string;
  size?: Size;
  className?: string;
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
};

const ICON_SIZES: Record<Size, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
};

export function WishlistButton({
  productId,
  size = 'md',
  className = '',
}: Props) {
  const t = useTranslations('wishlist');
  const productIds = useWishlist((s) => s.productIds);
  const toggle = useWishlist((s) => s.toggle);

  const [mounted, setMounted] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Hide toast after 1.6s.
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 1600);
    return () => window.clearTimeout(id);
  }, [toast]);

  const inList = mounted && productIds.includes(productId);
  const ariaLabel = inList ? t('button.ariaRemove') : t('button.ariaAdd');

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const willAdd = !inList;
    toggle(productId);
    if (!reduced) {
      setPulse(true);
      window.setTimeout(() => setPulse(false), 280);
    }
    setToast(willAdd ? t('toast.added') : t('toast.removed'));
  };

  return (
    <span className={`relative inline-flex ${className}`.trim()}>
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        aria-pressed={inList}
        title={ariaLabel}
        className={[
          'inline-flex items-center justify-center rounded-pill border border-sand-300 bg-canvas-000 text-ink-950',
          'transition-[transform,background-color,color] duration-base ease-standard',
          'hover:bg-sand-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700',
          SIZE_CLASSES[size],
          pulse && !reduced ? 'scale-110' : 'scale-100',
        ].join(' ')}
      >
        <Heart
          aria-hidden
          className={[
            ICON_SIZES[size],
            inList ? 'fill-error-700 text-error-700' : 'fill-none',
            'transition-colors duration-base ease-standard',
          ].join(' ')}
          strokeWidth={1.8}
        />
      </button>

      {/* Live region for screen readers + ephemeral toast bubble. */}
      <span
        role="status"
        aria-live="polite"
        className={[
          'pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-sm bg-ink-950 px-2 py-1 text-meta-xs text-canvas-000 shadow-md',
          toast ? 'opacity-100' : 'opacity-0',
          'transition-opacity duration-base ease-standard',
        ].join(' ')}
      >
        {toast ?? ''}
      </span>
    </span>
  );
}
