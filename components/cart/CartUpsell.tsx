'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useCart } from '@/lib/cart';
import { getCartUpsells } from '@/lib/recommendations';
import { formatCAD } from '@/lib/format';
import type { Locale } from '@/lib/types';

type Props = {
  locale: Locale;
};

/**
 * Cart upsell row — "Tu pourrais aussi aimer" / "You might also like".
 *
 * Reads the live Zustand cart state, picks complementary products that aren't
 * already in the cart, and renders a 1×3 grid of small cards. Each card
 * deep-links to the PDP rather than adding to the cart directly — this
 * sidesteps the missing-variant problem (we don't know color/size yet) and
 * keeps the upsell honest: customer chooses the variant on the PDP.
 *
 * Hides itself when there are no suggestions or when the cart is empty.
 */
export function CartUpsell({ locale }: Props) {
  const items = useCart((s) => s.items);
  const t = useTranslations('recommendations');

  const cartProductIds = items.map((i) => i.productId);
  const suggestions = getCartUpsells(cartProductIds, 3);

  if (suggestions.length === 0) return null;

  return (
    <section
      aria-labelledby="cart-upsell-heading"
      className="rounded-lg border border-sand-300 bg-canvas-050 p-4 sm:p-6"
    >
      <h2
        id="cart-upsell-heading"
        className="text-title-md font-medium text-ink-950"
      >
        {t('upsell.heading')}
      </h2>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {suggestions.map((p) => {
          const title = p.title[locale];
          const href = `/${locale}/produits/${p.slug}`;
          const imgSrc = `/placeholders/products/${p.slug}.svg`;
          return (
            <li key={p.styleCode}>
              <Link
                href={href}
                className="group flex items-center gap-3 rounded-md border border-sand-300 bg-canvas-000 p-3 transition-colors duration-base ease-standard hover:border-slate-700 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
              >
                <div className="relative h-14 w-14 flex-none overflow-hidden rounded-sm bg-sand-100">
                  <Image
                    src={imgSrc}
                    alt=""
                    aria-hidden
                    fill
                    sizes="56px"
                    className="object-contain p-1"
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="truncate text-body-sm font-medium text-ink-950">
                    {title}
                  </p>
                  <p className="text-meta-xs text-stone-600">
                    {locale === 'fr-ca' ? 'À partir de ' : 'From '}
                    <span className="font-medium text-ink-950 tabular-nums">
                      {formatCAD(p.priceFromCents, locale)}
                    </span>
                  </p>
                </div>
                <span className="inline-flex flex-none items-center gap-1 text-body-sm font-medium text-slate-700 group-hover:text-ink-950">
                  {t('upsell.viewLink')}
                  <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
