'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { routing, type Locale } from '@/i18n/routing';

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const currentLocale = useLocale() as Locale;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('language');

  const target: Locale = currentLocale === 'fr-ca' ? 'en-ca' : 'fr-ca';

  // Strip current locale prefix from pathname.
  const prefix = `/${currentLocale}`;
  const pathWithoutLocale = pathname.startsWith(prefix)
    ? pathname.slice(prefix.length) || '/'
    : pathname;

  const qs = searchParams.toString();
  const href = `/${target}${pathWithoutLocale}${qs ? `?${qs}` : ''}`;

  const labelOther = target === 'fr-ca' ? t('fr') : t('en');
  const shortOther = target === 'fr-ca' ? 'FR' : 'EN';

  void routing; // ensure module is used in dev
  return (
    <Link
      href={href}
      lang={target === 'fr-ca' ? 'fr-CA' : 'en-CA'}
      hrefLang={target === 'fr-ca' ? 'fr-CA' : 'en-CA'}
      aria-label={`${t('switch')}: ${labelOther}`}
      className={`inline-flex h-9 min-w-[44px] items-center justify-center rounded-sm px-3 text-meta-xs uppercase tracking-wider text-ink-950 hover:bg-sand-100 transition-colors duration-base ease-standard ${className}`}
    >
      {shortOther}
    </Link>
  );
}
