import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['fr-ca', 'en-ca'] as const,
  defaultLocale: 'fr-ca',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

export const localeToHtmlLang: Record<Locale, string> = {
  'fr-ca': 'fr-CA',
  'en-ca': 'en-CA',
};
