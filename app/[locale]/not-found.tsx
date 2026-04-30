import { headers } from 'next/headers';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Container } from '@/components/Container';
import { siteConfig } from '@/lib/site';
import { routing, type Locale } from '@/i18n/routing';

function isLocale(value: string): value is Locale {
  return value === 'fr-ca' || value === 'en-ca';
}

// Best-effort: peek at the pathname to determine which locale the user was
// on. Falls back to the default locale.
async function resolveLocale(): Promise<Locale> {
  try {
    const h = await headers();
    const url =
      h.get('x-pathname') ||
      h.get('next-url') ||
      h.get('x-invoke-path') ||
      h.get('referer') ||
      '';
    const match = url.match(/\/(fr-ca|en-ca)(\/|$)/);
    const candidate = match?.[1];
    if (candidate && isLocale(candidate)) {
      return candidate;
    }
  } catch {
    // ignore
  }
  return routing.defaultLocale;
}

export default async function LocaleNotFound() {
  const locale = await resolveLocale();
  const t = await getTranslations({ locale, namespace: 'notFound' });
  const prefix = `/${locale}`;

  const cards: Array<{ href: string; label: string }> = [
    { href: `${prefix}/produits`, label: t('links.shop') },
    { href: `${prefix}/soumission`, label: t('links.quote') },
    { href: `${prefix}/industries`, label: t('links.industries') },
    { href: `${prefix}/contact`, label: t('links.contact') },
  ];

  return (
    <Container size="lg" className="py-16">
      <p className="text-display-xl text-slate-700">404</p>
      <h1 className="mt-2 text-display-lg text-ink-950">{t('heading')}</h1>
      <p className="mt-4 max-w-2xl text-body-lg text-stone-600">{t('body')}</p>

      <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <li key={card.href}>
            <Link
              href={card.href}
              className="group flex items-center justify-between rounded-md border border-sand-300 bg-canvas-000 px-5 py-4 transition-colors duration-base ease-standard hover:border-ink-950 hover:bg-sand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
            >
              <span className="text-body-md font-medium text-ink-950">
                {card.label}
              </span>
              <ArrowRight
                aria-hidden
                className="h-4 w-4 text-stone-500 transition-transform duration-base ease-standard group-hover:translate-x-0.5 group-hover:text-ink-950"
              />
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-body-md text-stone-600">
        {t('helper')}{' '}
        <a
          href={`mailto:${siteConfig.email}`}
          className="font-medium text-ink-950 underline underline-offset-2 hover:no-underline"
        >
          {t('mailto.cta')}
        </a>
        .
      </p>
    </Container>
  );
}
