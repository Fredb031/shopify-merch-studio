# Vision Affichage

Québec B2B custom-merch storefront — order branded apparel, promo goods, and signage with a live in-browser designer.

Built on React + Vite, headless-Shopify for commerce, Supabase for auth, and fabric.js for the product customizer.

---

## Tech stack

- **Frontend:** React 18, Vite 5, TypeScript 5, React Router 6
- **Styling:** Tailwind CSS 3 + shadcn/ui primitives, framer-motion, GSAP
- **State:** Zustand (cart, customizer), TanStack React Query (server cache)
- **Commerce:** Shopify Storefront API (headless)
- **Auth / data:** Supabase (JS client v2)
- **Customizer:** fabric.js 5 canvas editor
- **Quality:** Vitest + Testing Library, Playwright smoke tests, ESLint 9

## Architecture

```
src/
├── pages/          # Route components (home, shop, product, customizer, admin, ...)
├── components/     # Reusable UI (shadcn primitives + domain components)
├── lib/            # Shopify client, Supabase client, utils, analytics
├── data/           # Static catalog data, copy, i18n strings
├── hooks/          # Custom React hooks (useCart, useCustomizer, ...)
├── stores/         # Zustand stores
├── integrations/   # Third-party wiring (Supabase, Zapier, Shopify)
├── types/          # Shared TypeScript types
└── test/           # Vitest setup + unit tests
```

Static sitemap.xml is generated pre-build by `scripts/generate-sitemap.ts`.

## Quick start

```bash
npm ci
npm run dev          # http://localhost:8080
```

Production build (runs sitemap generator first):

```bash
npm run build
npm run preview
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Generates `public/sitemap.xml`, then builds for prod |
| `npm run build:dev` | Dev-mode build (unminified, source maps) |
| `npm run preview` | Serve the built bundle locally |
| `npm run lint` | ESLint across the repo |
| `npm run test` | Vitest unit tests (run once) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:smoke` | Playwright smoke suite (`tests/smoke.spec.ts`) |

## Environment variables

Create a `.env.local` at the repo root:

| Var | Purpose |
| --- | --- |
| `VITE_SHOPIFY_STOREFRONT_DOMAIN` | `xxxx.myshopify.com` |
| `VITE_SHOPIFY_STOREFRONT_TOKEN` | Storefront API public access token |
| `VITE_SHOPIFY_API_VERSION` | e.g. `2024-10` |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_ZAPIER_MAIL_WEBHOOK` | Zapier webhook for quote-request emails |

All client-exposed vars must be prefixed `VITE_`. Server-only secrets belong in Supabase/Shopify admin, never in this repo.

## Brand tokens

Defined in `tailwind.config.ts` and surfaced as CSS variables:

| Token | Hex |
| --- | --- |
| Navy (primary) | `#1B3A6B` |
| Gold (accent) | `#E8A838` |
| Charcoal | `#0F2341` |
| Cream | `#F5F2E8` |

## Testing

- **Unit / component:** `npm run test` — Vitest + Testing Library (jsdom).
- **Smoke (E2E):** `npm run test:smoke` — Playwright, targets the built preview.

CI runs both on every PR via GitHub Actions (`.github/workflows/`).

## Contributing

- Pull requests use the template at `.github/pull_request_template.md`.
- Issue templates live in `.github/ISSUE_TEMPLATE/`.
- Keep commits focused and conventional (`feat:`, `fix:`, `docs:`, ...).

Longer-running initiatives are tracked in `SITE-UPGRADE-TASKS.md`.

## License

Proprietary — © Vision Affichage. All rights reserved.
