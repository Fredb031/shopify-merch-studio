import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Container } from '@/components/Container';
import { Section } from '@/components/Section';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { HeroBlock } from '@/components/sections/HeroBlock';
import { TrustStrip } from '@/components/sections/TrustStrip';

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
    ? 'Comment ça marche · Vision Affichage'
    : 'How it works · Vision Affichage';
  const description = isFr
    ? 'De la sélection des vêtements à la livraison en cinq jours ouvrables : maquette en 24h, production locale, livraison Québec et Ontario.'
    : 'From apparel selection to delivery in five business days: 24h proof, local production, shipping across Quebec and Ontario.';

  return {
    title,
    description,
    alternates: getAlternates('/comment-ca-marche', locale),
    openGraph: {
      type: 'website',
      locale: isFr ? 'fr_CA' : 'en_CA',
      title,
      description,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}/comment-ca-marche`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

const STEP_KEYS = ['1', '2', '3', '4', '5'] as const;
const FACTOR_KEYS = ['1', '2', '3'] as const;
const TABLE_ROWS = ['embroidery', 'screenprint'] as const;
const TABLE_COLS = ['idealFor', 'colors', 'detail', 'durability', 'unitCost'] as const;

export default async function CommentCaMarchePage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'process' });
  const tBc = await getTranslations({ locale, namespace: 'breadcrumbs' });

  const base = `/${locale}`;

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
          <div className="max-w-3xl">
            <h2 className="text-display-md text-ink-950 md:text-display-lg">
              {t('steps.heading')}
            </h2>
            <p className="mt-6 text-body-lg text-stone-600">
              {t('steps.subhead')}
            </p>
          </div>
          <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            {STEP_KEYS.map((key) => (
              <li
                key={key}
                className="flex flex-col rounded-lg border border-sand-300 bg-canvas-000 p-6"
              >
                <span className="text-meta-xs font-semibold uppercase tracking-wider text-stone-600">
                  {t('steps.stepLabel', { n: key })}
                </span>
                <h3 className="mt-3 text-title-lg text-ink-950">
                  {t(`steps.${key}.title`)}
                </h3>
                <p className="mt-3 text-body-md text-stone-600">
                  {t(`steps.${key}.body`)}
                </p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <TrustStrip locale={locale} variant="warm" />

      <Section tone="warm">
        <Container size="2xl">
          <div className="max-w-3xl">
            <h2 className="text-display-md text-ink-950 md:text-display-lg">
              {t('methods.heading')}
            </h2>
            <p className="mt-6 text-body-lg text-stone-600">
              {t('methods.subhead')}
            </p>
          </div>
          <div className="mt-10 overflow-x-auto rounded-lg border border-sand-300 bg-canvas-000">
            <table className="w-full min-w-[640px] text-left text-body-md">
              <thead className="border-b border-sand-300 bg-canvas-050">
                <tr>
                  <th className="px-4 py-3 text-meta-xs font-semibold uppercase tracking-wider text-stone-600">
                    {t('methods.columns.method')}
                  </th>
                  {TABLE_COLS.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-meta-xs font-semibold uppercase tracking-wider text-stone-600"
                    >
                      {t(`methods.columns.${col}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-300">
                {TABLE_ROWS.map((row) => (
                  <tr key={row}>
                    <th
                      scope="row"
                      className="px-4 py-4 align-top text-title-md text-ink-950"
                    >
                      {t(`methods.${row}.name`)}
                    </th>
                    {TABLE_COLS.map((col) => (
                      <td key={col} className="px-4 py-4 align-top text-stone-600">
                        {t(`methods.${row}.${col}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </Section>

      <Section tone="default">
        <Container size="2xl">
          <div className="rounded-lg border border-sand-300 bg-canvas-050 p-8 md:p-10">
            <p className="text-meta-xs font-semibold uppercase tracking-wider text-stone-600">
              {t('factors.eyebrow')}
            </p>
            <h2 className="mt-3 text-display-sm text-ink-950 md:text-display-md">
              {t('factors.heading')}
            </h2>
            <p className="mt-4 text-body-lg text-stone-600 max-w-3xl">
              {t('factors.subhead')}
            </p>
            <ul className="mt-6 grid gap-6 md:grid-cols-3">
              {FACTOR_KEYS.map((key) => (
                <li key={key}>
                  <h3 className="text-title-md text-ink-950">
                    {t(`factors.${key}.title`)}
                  </h3>
                  <p className="mt-2 text-body-md text-stone-600">
                    {t(`factors.${key}.body`)}
                  </p>
                </li>
              ))}
            </ul>
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
