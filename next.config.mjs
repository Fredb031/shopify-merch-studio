import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Tree-shake barrel files at build time. Reduces module graph for these
  // packages, shaving evaluation cost and improving per-route chunk size.
  // See https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'next-intl',
      '@hookform/resolvers',
    ],
  },
  async rewrites() {
    return [
      // PWA / favicon validators frequently expect explicit `.png` URLs.
      // Next emits the dynamic icon routes without an extension, so we
      // rewrite the dotted paths to the dotless metadata routes.
      { source: '/icon.png', destination: '/icon' },
      { source: '/apple-icon.png', destination: '/apple-icon' },
    ];
  },
  async redirects() {
    return [
      // Canonicalize quote route → /soumission
      {
        source: '/:locale(fr-ca|en-ca)/devis',
        destination: '/:locale/soumission',
        permanent: true,
      },
      {
        source: '/:locale(fr-ca|en-ca)/quote',
        destination: '/:locale/soumission',
        permanent: true,
      },
      // Canonicalize discovery kit → /kit
      {
        source: '/:locale(fr-ca|en-ca)/kit-decouverte',
        destination: '/:locale/kit',
        permanent: true,
      },
      {
        source: '/:locale(fr-ca|en-ca)/discovery-kit',
        destination: '/:locale/kit',
        permanent: true,
      },
      // Header link uses /catalogue; canonical PLP is /produits
      {
        source: '/:locale(fr-ca|en-ca)/catalogue',
        destination: '/:locale/produits',
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
