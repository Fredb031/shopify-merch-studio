import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Container } from '@/components/Container';
import { Section } from '@/components/Section';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { FaqAccordion, type FaqEntry } from '@/components/sections/FaqAccordion';
import { FaqJsonLd } from '@/components/seo/FaqJsonLd';
import { HeroBlock } from '@/components/sections/HeroBlock';

import { getAlternates } from '@/lib/seo';
import { siteConfig } from '@/lib/site';
import { routing, type Locale } from '@/i18n/routing';

function isLocale(value: string): value is Locale {
  return value === 'fr-ca' || value === 'en-ca';
}

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const isFr = locale === 'fr-ca';
  const title = isFr
    ? 'Questions fréquentes · Vision Affichage'
    : 'FAQ · Vision Affichage';
  const description = isFr
    ? 'Réponses aux questions fréquentes sur la commande, la personnalisation, la livraison, les retours, les tailles et les comptes corporatifs.'
    : 'Answers to frequent questions on ordering, customization, shipping, returns, sizing, and corporate accounts.';

  return {
    title,
    description,
    alternates: getAlternates('/faq', locale),
    openGraph: {
      type: 'website',
      locale: isFr ? 'fr_CA' : 'en_CA',
      title,
      description,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}/faq`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

const CATEGORIES = [
  { id: 'order', count: 4 },
  { id: 'custom', count: 4 },
  { id: 'shipping', count: 3 },
  { id: 'returns', count: 3 },
  { id: 'sizing', count: 2 },
  { id: 'business', count: 3 },
] as const;

export default async function FaqPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'faq' });
  const tBc = await getTranslations({ locale, namespace: 'breadcrumbs' });

  const base = `/${locale}`;

  const allItems: FaqEntry[] = [];
  const categoryGroups = CATEGORIES.map((cat) => {
    const entries: FaqEntry[] = Array.from({ length: cat.count }, (_, idx) => {
      const i = idx + 1;
      return {
        q: t(`categories.${cat.id}.items.${i}.q`),
        a: t(`categories.${cat.id}.items.${i}.a`),
      };
    });
    allItems.push(...entries);
    return {
      id: cat.id,
      title: t(`categories.${cat.id}.title`),
      entries,
    };
  });

  const jsonLdItems = allItems.map((item) => ({
    question: item.q,
    answer: item.a,
  }));

  return (
    <>
      <FaqJsonLd items={jsonLdItems} />
      <Section tone="default" className="py-8 md:py-10">
        <Container size="2xl">
          <Breadcrumbs
            locale={locale}
            items={[
              { label: tBc('home'), href: base },
              { label: t('breadcrumb') },
            ]}
          />
        </Container>
      </Section>

      <Section tone="warm" className="pt-4 md:pt-6">
        <Container size="2xl">
          <div className="max-w-3xl">
            <p className="text-meta-xs font-semibold uppercase tracking-wider text-stone-600">
              {t('eyebrow')}
            </p>
            <h1 className="mt-4 text-display-lg text-ink-950 md:text-display-xl">
              {t('pageHeading')}
            </h1>
            <p className="mt-6 text-body-lg text-stone-600">{t('subhead')}</p>
          </div>
        </Container>
      </Section>

      <Section tone="default">
        <Container size="2xl">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <aside className="lg:col-span-3">
              <p className="text-meta-xs font-semibold uppercase tracking-wider text-stone-600">
                {t('categoriesLabel')}
              </p>
              <ul className="mt-4 space-y-2">
                {categoryGroups.map((cat) => (
                  <li key={cat.id}>
                    <a
                      href={`#${cat.id}`}
                      className="text-body-md text-ink-950 underline-offset-4 hover:underline"
                    >
                      {cat.title}
                    </a>
                  </li>
                ))}
              </ul>
            </aside>

            <div className="lg:col-span-9">
              {categoryGroups.map((cat) => (
                <section
                  key={cat.id}
                  id={cat.id}
                  className="mb-12 scroll-mt-24 last:mb-0"
                >
                  <h2 className="text-display-sm text-ink-950 md:text-display-md">
                    {cat.title}
                  </h2>
                  <FaqAccordion
                    items={cat.entries}
                    locale={locale}
                    className="mt-4"
                  />
                </section>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      <HeroBlock
        tone="sand"
        eyebrow={t('cta.eyebrow')}
        headline={t('cta.headline')}
        subhead={t('cta.subhead')}
        primaryCta={{
          label: t('cta.ctaPrimary'),
          href: `${base}/contact`,
        }}
        secondaryCta={{
          label: t('cta.ctaSecondary'),
          href: `${base}/soumission`,
        }}
      />
    </>
  );
}
