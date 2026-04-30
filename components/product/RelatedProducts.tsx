import { getTranslations } from 'next-intl/server';

import { Container } from '@/components/Container';
import { Section } from '@/components/Section';
import { ProductGrid } from '@/components/product/ProductGrid';
import type { Locale, Product } from '@/lib/types';

type Props = {
  products: Product[];
  locale: Locale;
};

/**
 * "Souvent achetés ensemble" / "Often bought together" — server component
 * rendered near the bottom of the PDP. Hides itself entirely when the
 * recommendations list is empty so the page doesn't carry a dead heading.
 */
export async function RelatedProducts({ products, locale }: Props) {
  if (products.length === 0) return null;

  const t = await getTranslations({ locale, namespace: 'recommendations' });

  return (
    <Section tone="warm">
      <Container size="xl">
        <div className="md:max-w-2xl">
          <h2 className="text-title-xl text-ink-950">{t('related.heading')}</h2>
        </div>
        <ProductGrid
          products={products}
          locale={locale}
          columns={4}
          className="mt-10"
        />
      </Container>
    </Section>
  );
}
