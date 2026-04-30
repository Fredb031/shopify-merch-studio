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
  const t = await getTranslations({ locale, namespace: 'legal.privacy' });
  const title = `${t('title')} · ${siteConfig.name}`;

  return {
    title: t('title'),
    description: t('intro'),
    alternates: getAlternates('/legal/confidentialite', locale),
    openGraph: {
      type: 'website',
      locale: locale === 'fr-ca' ? 'fr_CA' : 'en_CA',
      title,
      description: t('intro'),
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}/legal/confidentialite`,
    },
    robots: { index: true, follow: true },
  };
}

const SECTION_KEYS = [
  'whoWeAre',
  'dataCollected',
  'whyCollected',
  'rightsLoi25',
  'contactUs',
  'retention',
  'thirdCountries',
  'modifications',
  'security',
  'review',
] as const;

export default async function PrivacyPolicyPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'legal.privacy' });

  return (
    <Section tone="warm">
      <Container size="lg">
        <article className="prose-vision max-w-3xl">
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

          <div className="mt-10 space-y-10">
            {SECTION_KEYS.map((key) => (
              <section key={key} aria-labelledby={`legal-section-${key}`}>
                <h2
                  id={`legal-section-${key}`}
                  className="text-title-lg text-ink-950"
                >
                  {t(`sections.${key}.heading`)}
                </h2>
                <div className="mt-3 space-y-3 text-body-md text-stone-600 whitespace-pre-line">
                  {t(`sections.${key}.body`)}
                </div>
              </section>
            ))}
          </div>

          <aside className="mt-12 rounded-md border border-sand-300 bg-sand-100 p-5 text-body-sm text-stone-600">
            {t('phase3Note')}
          </aside>
        </article>
      </Container>
    </Section>
  );
}
