import { getRequestConfig } from 'next-intl/server';
import { routing, type Locale } from './routing';

function isLocale(value: string | undefined): value is Locale {
  return value === 'fr-ca' || value === 'en-ca';
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale = isLocale(requested) ? requested : routing.defaultLocale;

  const messages = (await import(`../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
  };
});
