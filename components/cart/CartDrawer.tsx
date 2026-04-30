'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
} from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';

import { useCart, type CartItem } from '@/lib/cart';
import { formatCAD } from '@/lib/format';
import { LogoStatusBadge } from '@/components/checkout/LogoStatusBadge';
import { Button } from '@/components/Button';
import type { Locale } from '@/i18n/routing';

/**
 * Slide-in cart preview. Mounted globally; only renders DOM when
 * `isDrawerOpen === true`. Triggers: header cart icon and PDP "add without
 * logo". The full /panier route still exists for users who want the
 * detailed page (linked from the drawer footer).
 *
 * Behaviour:
 *  - 400px wide on desktop, full-screen on mobile (right-side slide)
 *  - 240ms slide animation, gated on `prefers-reduced-motion`
 *  - Focus trap + ESC closes + overlay click closes
 *  - Body scroll lock while open
 *  - "Modifier le logo" link closes the drawer before navigating to
 *    /customiser, so the back button returns to where the user was
 */
export function CartDrawer() {
  const locale = useLocale() as Locale;
  const t = useTranslations('cartDrawer');
  const tCart = useTranslations('cart');

  const isOpen = useCart((s) => s.isDrawerOpen);
  const closeDrawer = useCart((s) => s.closeDrawer);
  const items = useCart((s) => s.items);
  const updateQty = useCart((s) => s.updateQty);
  const removeItem = useCart((s) => s.removeItem);
  const subtotalCents = useCart((s) => s.subtotalCents);
  const itemCount = useCart((s) => s.itemCount);

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Focus management: stash trigger, focus close button on open, restore on close.
  useEffect(() => {
    if (!isOpen) return;
    lastFocusedRef.current =
      typeof document !== 'undefined'
        ? (document.activeElement as HTMLElement | null)
        : null;
    const id = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(id);
      const last = lastFocusedRef.current;
      if (last && typeof last.focus === 'function') {
        last.focus();
      }
    };
  }, [isOpen]);

  // Body scroll lock while open.
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  // ESC closes; Tab / Shift+Tab cycles inside the dialog.
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [isOpen, closeDrawer],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onKeyDown]);

  // Lazy mount — only render DOM when actually open. Avoids unnecessary work
  // for visitors who never click the cart icon.
  if (!isOpen) return null;

  const count = itemCount();
  const subtotal = subtotalCents();
  const isEmpty = items.length === 0;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      ref={dialogRef}
    >
      {/* Overlay — clicking dismisses. tabIndex -1 keeps it out of the focus loop. */}
      <button
        type="button"
        aria-label={t('close')}
        onClick={closeDrawer}
        tabIndex={-1}
        className="absolute inset-0 bg-ink-950/50 motion-safe:animate-[fadeIn_240ms_ease-out]"
      />

      <div
        className="absolute right-0 top-0 flex h-full w-full max-w-full flex-col bg-canvas-000 shadow-lg sm:w-[400px] motion-safe:animate-[slideInRight_240ms_ease-out]"
        style={{
          // Inline keyframes so we don't have to touch global CSS for one component.
          // `prefers-reduced-motion: reduce` skips the animation per the
          // motion-safe utility on the parent class list.
        }}
      >
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <div className="flex h-16 flex-none items-center justify-between border-b border-sand-300 px-6">
          <div className="flex flex-col">
            <h2
              id={titleId}
              className="text-title-md font-semibold text-ink-950"
            >
              {t('heading')}
            </h2>
            {!isEmpty ? (
              <p className="text-meta-xs text-stone-600">
                {t('count', { count })}
              </p>
            ) : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeDrawer}
            aria-label={t('close')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-sm text-ink-950 transition-colors duration-base ease-standard hover:bg-sand-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
            <ShoppingBag aria-hidden className="h-10 w-10 text-stone-600" />
            <p className="text-body-md text-ink-950">{t('empty.title')}</p>
            <Button
              href={`/${locale}/produits`}
              variant="primary"
              size="md"
              onClick={closeDrawer}
            >
              {t('empty.cta')}
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-sand-300 overflow-y-auto">
              {items.map((item) => (
                <DrawerLineItem
                  key={`${item.productId}-${item.variantKey}`}
                  item={item}
                  locale={locale}
                  onQtyChange={(qty) =>
                    updateQty(item.productId, item.variantKey, qty)
                  }
                  onRemove={() =>
                    removeItem(item.productId, item.variantKey)
                  }
                  onModifyLogo={closeDrawer}
                  removeLabel={t('item.remove')}
                  qtyLabel={t('item.qty')}
                  decreaseLabel={tCart('item.decrease')}
                  increaseLabel={tCart('item.increase')}
                  modifyLogoLabel={tCart('customizer.modifyLogo')}
                />
              ))}
            </ul>

            {/* Sticky footer */}
            <div className="flex flex-none flex-col gap-3 border-t border-sand-300 bg-canvas-000 px-6 py-5">
              <div className="flex items-baseline justify-between">
                <span className="text-body-md font-medium text-ink-950">
                  {tCart('subtotal')}
                </span>
                <span className="text-title-md font-semibold tabular-nums text-ink-950">
                  {formatCAD(subtotal, locale)}
                </span>
              </div>
              <Button
                href={`/${locale}/checkout`}
                variant="primary"
                size="lg"
                className="w-full"
                onClick={closeDrawer}
              >
                {t('checkout')}
              </Button>
              <Link
                href={`/${locale}/panier`}
                onClick={closeDrawer}
                className="block text-center text-body-sm font-medium text-ink-950 underline underline-offset-2 transition-colors duration-base ease-standard hover:text-ink-800"
              >
                {t('viewFull')}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type DrawerLineItemProps = {
  item: CartItem;
  locale: Locale;
  onQtyChange: (qty: number) => void;
  onRemove: () => void;
  onModifyLogo: () => void;
  removeLabel: string;
  qtyLabel: string;
  decreaseLabel: string;
  increaseLabel: string;
  modifyLogoLabel: string;
};

function DrawerLineItem({
  item,
  locale,
  onQtyChange,
  onRemove,
  onModifyLogo,
  removeLabel,
  qtyLabel,
  decreaseLabel,
  increaseLabel,
  modifyLogoLabel,
}: DrawerLineItemProps) {
  const title = locale === 'fr-ca' ? item.titleFr : item.titleEn;
  const lineSubtotal = item.unitPriceCents * item.qty;
  const hasCustomizer = !!item.customizerToken;
  const modifyHref = hasCustomizer
    ? (() => {
        const params = new URLSearchParams({
          product: item.productSlug,
          size: item.size,
          qty: String(item.qty),
          token: item.customizerToken as string,
        });
        if (item.color) params.set('color', item.color);
        return `/${locale}/customiser?${params.toString()}`;
      })()
    : null;

  return (
    <li className="flex gap-3 px-6 py-4">
      <div className="flex flex-none flex-col items-start gap-1">
        <div className="flex h-16 w-16 items-center justify-center rounded-md bg-canvas-050 text-meta-xs uppercase tracking-wider text-stone-600">
          {(title[0] ?? '·').toUpperCase()}
        </div>
        {hasCustomizer && item.customizerThumbDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.customizerThumbDataUrl}
            alt=""
            aria-hidden
            className="h-10 w-10 rounded-sm border border-sand-300 bg-canvas-000 object-contain p-0.5"
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="truncate text-body-sm font-medium text-ink-950">
          {title}
        </p>
        <p className="text-meta-xs text-stone-600">
          {item.color} · {item.size}
        </p>
        {hasCustomizer ? (
          <div className="flex flex-wrap items-center gap-2">
            <LogoStatusBadge status="pending" locale={locale} />
            {modifyHref ? (
              <Link
                href={modifyHref}
                onClick={onModifyLogo}
                className="text-meta-xs font-medium text-ink-950 underline underline-offset-2 hover:text-ink-800"
              >
                {modifyLogoLabel}
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="mt-1 flex items-center justify-between gap-2">
          <div
            role="group"
            aria-label={qtyLabel}
            className="inline-flex items-center rounded-md border border-sand-300"
          >
            <button
              type="button"
              aria-label={decreaseLabel}
              onClick={() => onQtyChange(Math.max(1, item.qty - 1))}
              disabled={item.qty <= 1}
              className="flex h-8 w-8 items-center justify-center text-ink-950 hover:bg-sand-100 disabled:opacity-40"
            >
              <Minus aria-hidden className="h-3.5 w-3.5" />
            </button>
            <span
              aria-live="polite"
              className="flex h-8 w-8 items-center justify-center border-x border-sand-300 text-body-sm tabular-nums"
            >
              {item.qty}
            </span>
            <button
              type="button"
              aria-label={increaseLabel}
              onClick={() => onQtyChange(item.qty + 1)}
              className="flex h-8 w-8 items-center justify-center text-ink-950 hover:bg-sand-100"
            >
              <Plus aria-hidden className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={onRemove}
            aria-label={removeLabel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-stone-600 transition-colors duration-base ease-standard hover:bg-sand-100 hover:text-error-700"
          >
            <Trash2 aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-none flex-col items-end justify-between">
        <p className="text-body-sm font-semibold tabular-nums text-ink-950">
          {formatCAD(lineSubtotal, locale)}
        </p>
      </div>
    </li>
  );
}
