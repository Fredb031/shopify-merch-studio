import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Container } from '@/components/Container';
import { Section } from '@/components/Section';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { HeroBlock } from '@/components/sections/HeroBlock';
import { TrustStrip } from '@/components/sections/TrustStrip';
import { IndustryGrid } from '@/components/sections/IndustryGrid';

import { industries } from '@/lib/industries';
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
    ? 'À propos · Vision Affichage'
    : 'About · Vision Affichage';
  const description = isFr
    ? 'Atelier de broderie et sérigraphie québécois depuis 2021. 33 000+ vêtements livrés à 500+ entreprises sans compromis.'
    : 'Quebec embroidery and screen-print shop since 2021. 33,000+ garments delivered to 500+ businesses without compromise.';

  return {
    title,
    description,
    alternates: getAlternates('/a-propos', locale),
    openGraph: {
      type: 'website',
      locale: isFr ? 'fr_CA' : 'en_CA',
      title,
      description,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}/a-propos`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

const VALUE_KEYS = ['local', 'french', 'leadtime'] as const;

export default async function AProposPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'about' });
  const tBc = await getTranslations({ locale, namespace: 'breadcrumbs' });

  const base = `/${locale}`;
  const storyParas = ['p1', 'p2', 'p3'] as const;
  const stats = ['1', '2', '3'] as const;

  return (
    <>
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

      <HeroBlock
        tone="warm"
        eyebrow={t('hero.eyebrow')}
        headline={t('hero.headline')}
        subhead={t('hero.subhead')}
        primaryCta={{
          label: t('hero.ctaPrimary'),
          href: `${base}/produits`,
        }}
        secondaryCta={{
          label: t('hero.ctaSecondary'),
          href: `${base}/soumission`,
        }}
      />

      <Section tone="default">
        <Container size="2xl">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-7">
              <h2 className="text-display-md text-ink-950 md:text-display-lg">
                {t('story.heading')}
              </h2>
              <div className="mt-8 space-y-5 text-body-lg text-stone-600 max-w-[68ch]">
                {storyParas.map((key) => (
                  <p key={key}>{t(`story.${key}`)}</p>
                ))}
              </div>
            </div>
            <div className="lg:col-span-5">
              <div className="rounded-lg border border-sand-300 bg-canvas-050 p-8">
                <p className="text-meta-xs font-semibold uppercase tracking-wider text-stone-600">
                  {t('stats.eyebrow')}
                </p>
                <ul className="mt-6 space-y-6">
                  {stats.map((key) => (
                    <li key={key} className="border-b border-sand-300 pb-6 last:border-b-0 last:pb-0">
                      <p className="text-display-md text-ink-950">
                        {t(`stats.${key}.value`)}
                      </p>
                      <p className="mt-2 text-body-md text-stone-600">
                        {t(`stats.${key}.label`)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="warm">
        <Container size="2xl">
          <div className="max-w-3xl">
            <h2 className="text-display-md text-ink-950 md:text-display-lg">
              {t('values.heading')}
            </h2>
            <p className="mt-6 text-body-lg text-stone-600">
              {t('values.subhead')}
            </p>
          </div>
          <ul className="mt-12 grid gap-6 md:grid-cols-3">
            {VALUE_KEYS.map((key) => (
              <li
                key={key}
                className="rounded-lg border border-sand-300 bg-canvas-000 p-6"
              >
                <h3 className="text-title-lg text-ink-950">
                  {t(`values.${key}.title`)}
                </h3>
                <p className="mt-3 text-body-md text-stone-600">
                  {t(`values.${key}.body`)}
                </p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <TrustStrip locale={locale} variant="warm" />

      <Section tone="default">
        <Container size="2xl">
          <div className="max-w-3xl">
            <h2 className="text-display-md text-ink-950 md:text-display-lg">
              {t('industries.heading')}
            </h2>
            <p className="mt-6 text-body-lg text-stone-600">
              {t('industries.subhead')}
            </p>
          </div>
          <IndustryGrid
            industries={industries}
            locale={locale}
            className="mt-12"
          />
        </Container>
      </Section>

      <HeroBlock
        tone="sand"
        eyebrow={t('cta.eyebrow')}
        headline={t('cta.headline')}
        subhead={t('cta.subhead')}
        primaryCta={{
          label: t('cta.ctaPrimary'),
          href: `${base}/produits`,
        }}
        secondaryCta={{
          label: t('cta.ctaSecondary'),
          href: `${base}/soumission`,
        }}
      />
    </>
  );
}
