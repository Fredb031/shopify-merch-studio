import Link from 'next/link';
import { Inter } from 'next/font/google';

import { siteConfig } from '@/lib/site';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Reaching this means middleware did not catch the path (no locale prefix
// could be inferred). We render a minimal stripped-down French version of
// the locale 404 with a hard link back to the FR home so the user can
// recover. We own <html>/<body> here because the locale layout never wraps
// us at this depth.
export default function RootNotFound() {
  return (
    <html lang="fr-CA" className={inter.variable}>
      <body className="font-sans antialiased bg-canvas-000 text-ink-950">
        <main className="mx-auto flex min-h-screen w-full max-w-container-lg flex-col justify-center px-6 py-16 md:px-8">
          <p className="text-display-xl text-slate-700">404</p>
          <h1 className="mt-2 text-display-lg text-ink-950">
            Page introuvable
          </h1>
          <p className="mt-4 max-w-2xl text-body-lg text-stone-600">
            Cette page n&rsquo;existe pas ou a &eacute;t&eacute;
            d&eacute;plac&eacute;e.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/fr-ca"
              className="inline-flex h-11 items-center justify-center rounded-md bg-ink-950 px-4 text-body-md font-medium text-canvas-000 transition-colors duration-base ease-standard hover:bg-ink-800"
            >
              Retour &agrave; l&rsquo;accueil
            </Link>
            <Link
              href="/fr-ca/produits"
              className="inline-flex h-11 items-center justify-center rounded-md border border-ink-950 bg-canvas-000 px-4 text-body-md font-medium text-ink-950 transition-colors duration-base ease-standard hover:bg-sand-100"
            >
              Magasiner les uniformes
            </Link>
          </div>

          <p className="mt-10 text-body-md text-stone-600">
            Tu cherches quelque chose en particulier ?{' '}
            <a
              href={`mailto:${siteConfig.email}`}
              className="font-medium text-ink-950 underline underline-offset-2 hover:no-underline"
            >
              &Eacute;cris-nous
            </a>
            .
          </p>
        </main>
      </body>
    </html>
  );
}
