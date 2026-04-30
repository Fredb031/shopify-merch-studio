import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Container } from '@/components/Container';
import { Section } from '@/components/Section';
import { getAlternates } from '@/lib/seo';
import { siteConfig } from '@/lib/site';
import { routing, type Locale } from '@/i18n/routing';
import { AccountClient } from './AccountClient';

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
    ? 'Mon compte · Vision Affichage'
    : 'My account · Vision Affichage';
  const description = isFr
    ? 'Tes activités récentes avec Vision Affichage : soumissions, kits, commandes et messages.'
    : 'Your recent activity with Vision Affichage: quotes, kits, orders, and messages.';

  return {
    title,
    description,
    alternates: getAlternates('/account', locale),
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      type: 'website',
      locale: isFr ? 'fr_CA' : 'en_CA',
      title,
      description,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}/account`,
    },
  };
}

export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const tBreadcrumbs = await getTranslations({
    locale,
    namespace: 'breadcrumbs',
  });
  const t = await getTranslations({ locale, namespace: 'account' });

  const breadcrumbItems = [
    { label: tBreadcrumbs('home'), href: `/${locale}` },
    { label: t('breadcrumb') },
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
          <AccountClient locale={locale} />
        </Container>
      </Section>
    </>
  );
}
