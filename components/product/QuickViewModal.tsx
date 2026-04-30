'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { Locale, Product } from '@/lib/types';
import { useCart } from '@/lib/cart';
import { formatCAD, formatMinQty } from '@/lib/format';
import { Button } from '@/components/Button';
import { BadgeRow } from './BadgeRow';
import { ColorSwatch } from './ColorSwatch';
import { SizePicker } from './SizePicker';

type Props = {
  product: Product;
  locale: Locale;
  open: boolean;
  onClose: () => void;
};

const QTY_MAX = 1000;

export function QuickViewModal({ product, locale, open, onClose }: Props) {
  const t = useTranslations('quickView');
  const addItem = useCart((s) => s.addItem);

  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  const firstAvailableColor = useMemo(() => {
    const found = product.colors.find((c) => c.available !== false);
    return found ?? product.colors[0] ?? null;
  }, [product.colors]);

  const [selectedColorHex, setSelectedColorHex] = useState<string | null>(
    firstAvailableColor?.hex ?? null,
  );
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(product.minQuantity);
  const [sizeError, setSizeError] = useState<boolean>(false);
  const [addedToast, setAddedToast] = useState<boolean>(false);

  const selectedColor =
    product.colors.find((c) => c.hex === selectedColorHex) ?? null;

  const productHref = `/${locale}/produits/${product.slug}`;
  const imgSrc =
    product.gallery && product.gallery[0]
      ? product.gallery[0]
      : `/placeholders/products/${product.slug}.svg`;

  const clampQty = useCallback(
    (value: number): number => {
      const min = product.minQuantity;
      if (Number.isNaN(value)) return min;
      if (value < min) return min;
      if (value > QTY_MAX) return QTY_MAX;
      return Math.floor(value);
    },
    [product.minQuantity],
  );

  const onQtyChange = (value: number) => setQuantity(clampQty(value));

  // Reset state when product changes or modal reopens.
  useEffect(() => {
    if (open) {
      setSelectedColorHex(firstAvailableColor?.hex ?? null);
      setSelectedSize(null);
      setQuantity(product.minQuantity);
      setSizeError(false);
      setAddedToast(false);
    }
  }, [open, product.styleCode, product.minQuantity, firstAvailableColor?.hex]);

  // Focus management: on open, focus dialog; on close, restore previous focus.
  useEffect(() => {
    if (!open) return;
    lastFocusedRef.current =
      typeof document !== 'undefined'
        ? (document.activeElement as HTMLElement | null)
        : null;
    const id = window.setTimeout(() => {
      const root = dialogRef.current;
      if (!root) return;
      const firstFocusable = root.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus();
    }, 0);
    return () => {
      window.clearTimeout(id);
      const last = lastFocusedRef.current;
      if (last && typeof last.focus === 'function') {
        last.focus();
      }
    };
  }, [open]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // ESC to close + focus trap on Tab.
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!open) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
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
    [open, onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, handleKeyDown]);

  const onAddToCart = () => {
    if (!selectedSize) {
      setSizeError(true);
      return;
    }
    setSizeError(false);
    const colorLabel = selectedColor ? selectedColor.name[locale] : 'default';
    const variantKey = `${selectedColor?.hex ?? 'default'}-${selectedSize}`;
    addItem({
      productId: product.styleCode,
      variantKey,
      productSlug: product.slug,
      titleFr: product.title['fr-ca'],
      titleEn: product.title['en-ca'],
      color: colorLabel,
      size: selectedSize,
      qty: quantity,
      unitPriceCents: product.priceFromCents,
    });
    setAddedToast(true);
    window.setTimeout(() => {
      onClose();
    }, 600);
  };

  if (!open) return null;

  const colorLabel = locale === 'fr-ca' ? 'Couleur' : 'Color';
  const sizeLabel = locale === 'fr-ca' ? 'Taille' : 'Size';
  const qtyLabel = locale === 'fr-ca' ? 'Quantité' : 'Quantity';
  const qtyUnit = locale === 'fr-ca' ? 'unités' : 'units';
  const fromLabel = locale === 'fr-ca' ? 'À partir de ' : 'From ';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label={t('modal.close')}
        onClick={onClose}
        className="absolute inset-0 bg-ink-950/50"
        tabIndex={-1}
      />
      <div
        ref={dialogRef}
        className="relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden bg-canvas-000 shadow-lg sm:h-auto sm:max-h-[80vh] sm:w-full sm:max-w-[800px] sm:rounded-md"
      >
        {/* Header with close */}
        <div className="flex items-center justify-between border-b border-sand-300 px-4 py-3">
          <h2 id={titleId} className="text-title-md leading-tight text-ink-950">
            {product.title[locale]}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('modal.close')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-ink-950 transition-colors duration-base ease-standard hover:bg-sand-100"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>

        {/* Body — 2 col layout (stacks on mobile) */}
        <div className="flex flex-1 flex-col overflow-y-auto sm:grid sm:grid-cols-2 sm:overflow-hidden">
          {/* LEFT: image */}
          <div className="relative aspect-square w-full flex-none bg-sand-100 sm:h-full sm:aspect-auto">
            <Image
              src={imgSrc}
              alt={product.title[locale]}
              fill
              sizes="(min-width: 640px) 400px, 100vw"
              className="object-contain p-6"
            />
          </div>

          {/* RIGHT: details */}
          <div className="flex flex-col gap-4 overflow-y-auto p-4 sm:p-6">
            <p className="text-body-sm italic text-stone-600">
              {product.identityHook[locale]}
            </p>

            <p className="text-body-md text-stone-600">
              {fromLabel}
              <span className="font-semibold text-ink-950">
                {formatCAD(product.priceFromCents, locale)}
              </span>
              {product.minQuantity > 1 ? (
                <span className="ml-2 text-stone-600">
                  · {formatMinQty(product.minQuantity, locale)}
                </span>
              ) : null}
            </p>

            {product.badgeKeys && product.badgeKeys.length > 0 ? (
              <BadgeRow badges={product.badgeKeys} locale={locale} max={3} />
            ) : null}

            {/* Color picker */}
            <div>
              <span className="block text-meta-xs uppercase tracking-wider text-stone-600">
                {colorLabel}
                {selectedColor ? (
                  <span className="ml-2 normal-case text-ink-950">
                    · {selectedColor.name[locale]}
                  </span>
                ) : null}
              </span>
              <div
                role="radiogroup"
                aria-label={colorLabel}
                className="mt-2 flex flex-wrap gap-2"
              >
                {product.colors.map((c) => {
                  const available = c.available !== false;
                  const isSelected = selectedColorHex === c.hex;
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={c.name[locale]}
                      aria-disabled={!available}
                      disabled={!available}
                      onClick={() => available && setSelectedColorHex(c.hex)}
                      className={[
                        'inline-flex h-9 w-9 items-center justify-center rounded-pill p-0.5 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700',
                        available
                          ? 'cursor-pointer'
                          : 'cursor-not-allowed opacity-50',
                      ].join(' ')}
                      title={c.name[locale]}
                    >
                      <ColorSwatch
                        name={c.name[locale]}
                        hex={c.hex}
                        available={available}
                        selected={isSelected}
                        size="md"
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Size picker */}
            <div>
              <span className="block text-meta-xs uppercase tracking-wider text-stone-600">
                {sizeLabel}
                {selectedSize ? (
                  <span className="ml-2 normal-case text-ink-950">
                    · {selectedSize}
                  </span>
                ) : null}
              </span>
              <SizePicker
                className="mt-2"
                sizes={product.sizes}
                selectedSize={selectedSize}
                onSelect={(size) => {
                  setSelectedSize(size);
                  setSizeError(false);
                }}
                locale={locale}
                showSizeGuide={false}
              />
            </div>

            {/* Quantity */}
            <div>
              <label
                htmlFor={`${titleId}-qty`}
                className="block text-meta-xs uppercase tracking-wider text-stone-600"
              >
                {qtyLabel}
              </label>
              <div className="mt-2 inline-flex items-center gap-2">
                <button
                  type="button"
                  aria-label="−"
                  onClick={() => onQtyChange(quantity - 1)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-sand-300 bg-canvas-000 text-ink-950 transition-colors duration-base ease-standard hover:bg-sand-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:opacity-50"
                  disabled={quantity <= product.minQuantity}
                >
                  <Minus aria-hidden className="h-4 w-4" />
                </button>
                <input
                  id={`${titleId}-qty`}
                  type="number"
                  inputMode="numeric"
                  min={product.minQuantity}
                  max={QTY_MAX}
                  value={quantity}
                  onChange={(e) => onQtyChange(Number(e.target.value))}
                  onBlur={(e) => onQtyChange(Number(e.target.value))}
                  className="h-10 w-20 rounded-sm border border-sand-300 bg-canvas-000 px-3 text-center text-body-md font-medium text-ink-950 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
                />
                <button
                  type="button"
                  aria-label="+"
                  onClick={() => onQtyChange(quantity + 1)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-sand-300 bg-canvas-000 text-ink-950 transition-colors duration-base ease-standard hover:bg-sand-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:opacity-50"
                  disabled={quantity >= QTY_MAX}
                >
                  <Plus aria-hidden className="h-4 w-4" />
                </button>
                <span className="ml-1 text-body-sm text-stone-600">
                  {qtyUnit}
                </span>
              </div>
            </div>

            {sizeError ? (
              <p
                role="alert"
                className="rounded-sm border border-error-200 bg-error-50 px-3 py-2 text-body-sm text-error-700"
              >
                {t('modal.sizeError')}
              </p>
            ) : null}
          </div>
        </div>

        {/* Footer CTAs */}
        <div className="flex flex-col gap-2 border-t border-sand-300 bg-canvas-000 p-4 sm:flex-row sm:items-center sm:justify-end">
          <Link
            href={productHref}
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-md border border-ink-950 bg-canvas-000 px-4 text-body-md font-medium text-ink-950 transition-colors duration-base ease-standard hover:bg-sand-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
          >
            {t('modal.viewFull')}
          </Link>
          <Button
            variant="primary"
            size="md"
            onClick={onAddToCart}
            className="w-full sm:w-auto"
          >
            {t('modal.addToCart')}
          </Button>
        </div>

        {/* Toast confirmation */}
        {addedToast ? (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute inset-x-0 bottom-20 mx-auto w-fit rounded-pill bg-ink-950 px-4 py-2 text-body-sm font-medium text-canvas-000 shadow-md"
          >
            {t('modal.addedToast')}
          </div>
        ) : null}
      </div>
    </div>
  );
}
