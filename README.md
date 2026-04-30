# Vision Affichage — v2

Bilingual marketing + catalogue site for Vision Affichage. Next.js 15 App Router, TypeScript strict, Tailwind 3.4, next-intl, pnpm 9.

## Commands

```bash
pnpm install         # install deps
pnpm dev             # dev server on http://localhost:3000
pnpm build           # production build
pnpm start           # start production server
pnpm typecheck       # tsc --noEmit
pnpm lint            # next lint
pnpm placeholders    # regenerate /public/placeholders/* SVGs
```

## Structure

```
app/
  layout.tsx                 # passthrough root (next-intl pattern)
  globals.css                # tailwind layers + CSS tokens
  [locale]/
    layout.tsx               # html/body, NextIntlClientProvider, Header/Footer, metadata + hreflang
    page.tsx                 # home (Wave 1: hero only)
components/                  # Header, Footer, Button, Container, Section, LanguageSwitcher, SkipLink, Hreflang
i18n/
  routing.ts                 # locales, defaultLocale, navigation helpers
  request.ts                 # message loader for RSC
lib/                         # types + fixture data (products, industries, reviews, clients, site)
messages/
  fr-ca.json
  en-ca.json
public/
  favicon.svg
  placeholders/              # generated SVGs (run `pnpm placeholders`)
scripts/
  generate-placeholders.cjs  # pure-Node SVG generator (no extra deps)
docs/decisions/              # ADRs
```

## Adding a product

Edit `lib/products.ts`, append a `Product` entry. Required fields: `styleCode`, unique `slug`, `category`, bilingual `title` / `identityHook` / `description` / `bestFor`, `badges`, `colors`, `sizes`, `brand`, `decorationDefault`. To get a placeholder image, add an entry to the `products` array in `scripts/generate-placeholders.cjs` then run `pnpm placeholders`.

## Adding a locale

1. Add the BCP-47 tag (e.g. `'es-mx'`) to `routing.locales` in `i18n/routing.ts` and update `localeToHtmlLang`.
2. Create `messages/<locale>.json` mirroring the keys in `messages/fr-ca.json`.
3. Update every `Bilingual` type literal in `lib/types.ts` and the fixtures in `lib/*.ts`.
4. Add the new tag to `generateMetadata` `alternates.languages` and to the `Hreflang` component.
5. Run `pnpm typecheck` to catch missed translations.
