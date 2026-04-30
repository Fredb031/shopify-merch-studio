import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Container } from '@/components/Container';
import { Section } from '@/components/Section';
import { getAlternates } from '@/lib/seo';
import { siteConfig } from '@/lib/site';
import { routing, type Locale } from '@/i18n/routing';

import { InfolettreClient } from './InfolettreClient';

function isLocale(value: string): value is Locale {
  return value === 'fr-ca' || value === 'en-ca';
}

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const isFr = locale === 'fr-ca';
  const title = isFr
    ? 'Infolettre · Vision Affichage'
    : 'Newsletter · Vision Affichage';
  const description = isFr
    ? 'Conseils mensuels pour habiller ton équipe. Désabonnement en 1 clic. Conforme à la loi canadienne anti-pourriel.'
    : 'Monthly tips for outfitting your team. One-click unsubscribe. Compliant with Canadian anti-spam legislation.';

  return {
    title,
    description,
    alternates: getAlternates('/infolettre', locale),
    openGraph: {
      type: 'website',
      locale: isFr ? 'fr_CA' : 'en_CA',
      title,
      description,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}/infolettre`,
    },
  };
}

export default async function InfolettrePage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const sp = await searchParams;
  const rawEmail = sp.email;
  const defaultEmail =
    typeof rawEmail === 'string' && rawEmail.length > 0 && rawEmail.length <= 254
      ? rawEmail
      : undefined;

  const tBreadcrumbs = await getTranslations({
    locale,
    namespace: 'breadcrumbs',
  });
  const t = await getTranslations({ locale, namespace: 'newsletter.page' });

  const breadcrumbItems = [
    { label: tBreadcrumbs('home'), href: `/${locale}` },
    { label: t('hero.headline') },
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
          <InfolettreClient locale={locale} defaultEmail={defaultEmail} />
        </Container>
      </Section>
    </>
  );
}
