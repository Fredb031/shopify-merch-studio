import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Container } from '@/components/Container';
import { Section } from '@/components/Section';
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'legal.cookies' });

  return {
    title: t('title'),
    description: t('intro'),
    alternates: getAlternates('/legal/cookies', locale),
    openGraph: {
      type: 'website',
      locale: locale === 'fr-ca' ? 'fr_CA' : 'en_CA',
      title: `${t('title')} · ${siteConfig.name}`,
      description: t('intro'),
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}/legal/cookies`,
    },
    robots: { index: true, follow: true },
  };
}

const ROW_KEYS = [
  'consent',
  'cart',
  'locale',
  'analyticsFuture',
  'marketingFuture',
] as const;

export default async function CookiesPolicyPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'legal.cookies' });

  return (
    <Section tone="warm">
      <Container size="lg">
        <article className="max-w-4xl">
          <p className="text-meta-xs font-semibold uppercase tracking-wider text-stone-600">
            {t('eyebrow')}
          </p>
          <h1 className="mt-4 text-display-lg text-ink-950 md:text-display-xl">
            {t('title')}
          </h1>
          <p className="mt-3 text-body-sm text-stone-600">
            {t('lastUpdatedLabel')}: {t('lastUpdated')}
          </p>
          <p className="mt-8 text-body-lg text-stone-600">{t('intro')}</p>

          <div className="mt-10 overflow-x-auto rounded-md border border-sand-300">
            <table className="w-full border-collapse text-left text-body-sm">
              <thead className="bg-sand-100 text-ink-950">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('table.headers.name')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('table.headers.category')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('table.headers.purpose')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('table.headers.duration')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('table.headers.party')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-canvas-000 text-stone-600">
                {ROW_KEYS.map((row) => (
                  <tr key={row} className="border-t border-sand-300 align-top">
                    <td className="px-4 py-3 font-mono text-meta-xs text-ink-950">
                      {t(`rows.${row}.name`)}
                    </td>
                    <td className="px-4 py-3">{t(`rows.${row}.category`)}</td>
                    <td className="px-4 py-3">{t(`rows.${row}.purpose`)}</td>
                    <td className="px-4 py-3">{t(`rows.${row}.duration`)}</td>
                    <td className="px-4 py-3">{t(`rows.${row}.party`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-8 text-body-md text-stone-600">{t('manage')}</p>
        </article>
      </Container>
    </Section>
  );
}
