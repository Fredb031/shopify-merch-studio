'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/Button';
import { Container } from '@/components/Container';
import { Section } from '@/components/Section';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProductGrid } from '@/components/product/ProductGrid';
import { products as ALL_PRODUCTS } from '@/lib/products';
import { useWishlist } from '@/lib/wishlist';
import type { Locale } from '@/lib/types';

function isLocale(value: string): value is Locale {
  return value === 'fr-ca' || value === 'en-ca';
}

type Props = {
  params: Promise<{ locale: string }>;
};

export default function WishlistPage({ params }: Props) {
  const { locale: rawLocale } = use(params);
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'fr-ca';

  const t = useTranslations('wishlist');
  const tBreadcrumbs = useTranslations('breadcrumbs');

  const productIds = useWishlist((s) => s.productIds);
  const clear = useWishlist((s) => s.clear);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const savedProducts = mounted
    ? ALL_PRODUCTS.filter((p) => productIds.includes(p.styleCode))
    : [];

  const breadcrumbItems = [
    { label: tBreadcrumbs('home'), href: `/${locale}` },
    { label: t('page.breadcrumb') },
  ];

  return (
    <>
      <div className="bg-canvas-050">
        <Container size="2xl">
          <div className="pt-6">
            <Breadcrumbs items={breadcrumbItems} locale={locale} />
          </div>
        </Container>
      </div>

      <Section tone="default">
        <Container size="2xl">
          <header className="mb-8 flex items-center gap-3">
            <span
              aria-hidden
              className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-sand-100 text-error-700"
            >
              <Heart className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <h1 className="text-display-md font-semibold text-ink-950">
              {t('page.heading')}
            </h1>
          </header>

          {!mounted ? (
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              <div className="h-72 animate-pulse rounded-md bg-sand-100" />
              <div className="h-72 animate-pulse rounded-md bg-sand-100" />
              <div className="h-72 animate-pulse rounded-md bg-sand-100" />
              <div className="h-72 animate-pulse rounded-md bg-sand-100" />
            </div>
          ) : savedProducts.length === 0 ? (
            <EmptyState
              icon={Heart}
              title={t('page.empty.title')}
              description={t('page.empty.body')}
              action={
                <Button href={`/${locale}/produits`} variant="primary" size="md">
                  {t('page.empty.cta')}
                </Button>
              }
            />
          ) : (
            <>
              <ProductGrid
                products={savedProducts}
                locale={locale}
                columns={4}
              />
              <div className="mt-10 flex justify-end">
                <button
                  type="button"
                  onClick={() => clear()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-sand-300 bg-canvas-000 px-3 text-body-sm font-medium text-ink-950 hover:bg-sand-100 transition-colors duration-base ease-standard"
                >
                  {t('page.clear')}
                </button>
              </div>
            </>
          )}

          <p className="mt-8 text-body-sm text-stone-600">
            <Link
              href={`/${locale}/produits`}
              className="underline underline-offset-2 hover:text-ink-950"
            >
              {t('page.empty.cta')}
            </Link>
          </p>
        </Container>
      </Section>
    </>
  );
}
