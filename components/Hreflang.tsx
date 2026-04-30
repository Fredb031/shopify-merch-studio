import { siteConfig } from '@/lib/site';
import { routing } from '@/i18n/routing';

type Props = {
  pathWithoutLocale: string;
};

export function Hreflang({ pathWithoutLocale }: Props) {
  const path = pathWithoutLocale.startsWith('/') ? pathWithoutLocale : `/${pathWithoutLocale}`;
  const norm = path === '/' ? '' : path;

  return (
    <>
      {routing.locales.map((locale) => {
        const tag = locale === 'fr-ca' ? 'fr-CA' : 'en-CA';
        return (
          <link
            key={tag}
            rel="alternate"
            hrefLang={tag}
            href={`${siteConfig.url}/${locale}${norm}`}
          />
        );
      })}
      <link
        rel="alternate"
        hrefLang="x-default"
        href={`${siteConfig.url}/${routing.defaultLocale}${norm}`}
      />
    </>
  );
}
