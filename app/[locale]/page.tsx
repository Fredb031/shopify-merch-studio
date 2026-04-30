import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Container } from '@/components/Container';
import { Button } from '@/components/Button';
import type { Locale } from '@/i18n/routing';

function isLocale(value: string): value is Locale {
  return value === 'fr-ca' || value === 'en-ca';
}

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'hero' });

  return (
    <section className="bg-ink-950 text-canvas-050">
      <Container size="2xl">
        <div className="grid gap-10 py-20 md:grid-cols-12 md:py-28 lg:py-32">
          <div className="md:col-span-8 lg:col-span-7">
            <p className="text-meta-xs uppercase tracking-wider text-sand-300">
              Vision Affichage
            </p>
            <h1 className="mt-6 text-display-lg md:text-display-xl text-canvas-000">
              {t('headline')}
            </h1>
            <p className="mt-6 max-w-xl text-body-lg text-sand-100">
              {t('subhead')}
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button href={`/${locale}/soumission`} variant="primary" size="lg" className="bg-canvas-000 text-ink-950 hover:bg-sand-100">
                {t('ctaPrimary')}
              </Button>
              <Button href={`/${locale}/catalogue`} variant="tertiary" size="lg" className="border border-sand-300 text-canvas-000 hover:bg-ink-800">
                {t('ctaSecondary')}
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
