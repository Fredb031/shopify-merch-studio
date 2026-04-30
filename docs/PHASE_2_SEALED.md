# Phase 2 — SEALED

**Date:** 2026-04-29
**Tag:** `v2-phase2-sealed`
**Branch:** `v2/rebrand`
**Final SSG count:** 75 pages (71 prior + 4 legal)
**Final commit (sealer):** see `git log` after this doc lands

---

## What sealed Phase 2

Wave 5 closed the four remaining acceptance criteria so Phase 2 could be
locked behind an annotated tag.

### 1. Loi 25 cookie consent (production blocker — CLOSED)

- New client component mounts at the root of the locale layout. Banner
  appears only when no `va-cookie-consent` choice has been recorded.
- **Reject** is given equal visual weight as **Accept** — Loi 25 requires
  the refusal to be as easy as the acceptance.
- A footer **Cookie preferences** button re-opens the banner via a
  `va:cookie-consent:show` CustomEvent.
- New routes: `/{locale}/legal/confidentialite` (full Loi 25 privacy
  policy) and `/{locale}/legal/cookies` (cookie inventory + consent table).
- Sitemap updated: 4 new entries (2 routes × 2 locales).

### 2. Per-page OG overrides

A new `getOgImageUrl(title, subtitle?)` helper in `lib/seo.ts` builds a
`/api/og?title=…&subtitle=…` URL with both params URL-encoded. Applied to
8 social-shareable routes × 2 locales:

1. `/{locale}` — root layout (already shipped in Wave 4)
2. `/{locale}/produits` — PLP
3. `/{locale}/produits/[slug]` — PDP (per-product title in OG card)
4. `/{locale}/industries` — industries listing
5. `/{locale}/industries/[slug]` — per-industry hero line in OG subtitle
6. `/{locale}/avis`
7. `/{locale}/kit`
8. `/{locale}/comment-ca-marche`
9. `/{locale}/a-propos`

Verification: `view-source` on `/fr-ca/produits/atc1015-tshirt-pre-retreci`
shows `og:image` content URL containing the URL-encoded product title.

### 3. Industry SVG hero upgrade

Replaced the six gradient + label placeholders in
`/public/placeholders/industries/` with abstract scenes evoking each
industry: construction (steel beams + safety tape + hard hat),
paysagement (leaf forms + horizon), restauration (place setting + chef
hat), demenagement (stacked boxes + diagonal arrow), metiers (crossed
wrench + screwdriver + mechanical band), bureau (desk + monitor + window
grid).

### 4. Four `.fixme` tests un-fixme'd

- `account-activity` quote card — switched to `context.addInitScript()` so
  sessionStorage is seeded before page mount; corrected to the real
  `StoredQuote` shape.
- `purchase-happy-path` — uses the post-Wave-3 split CTA "Ajouter sans
  logo" to skip the customizer detour.
- `quote-form` — selectors fixed (`ul label` for product checkboxes; full
  6-step submission produces `Q-XXXX` ref).
- `kit-order` — selectors fixed (article-scoped Starter card; full kit
  order produces `K-XXXX` ref).

The fifth fixme — `customizer-flow.spec.ts` — remains skipped per its
own comment: a real raster + vector fixture under `tests/fixtures/` is
required to exercise the client-side classification pipeline. Tracked
in the Phase 3 queue.

---

## Verification gates (all PASS)

| Gate | Result |
|---|---|
| `pnpm exec tsc --noEmit` | clean (exit 0) |
| `pnpm lint` | clean (exit 0) |
| `pnpm build` | 75/75 SSG (exit 0) |
| `pnpm exec playwright test tests/` | 25 passed, 1 skipped, 0 failed |
| Smoke: `/fr-ca`, `/en-ca` | 200 |
| Smoke: `/sitemap.xml` | 200, 52 `<loc>` entries |
| Smoke: `/robots.txt` | 200, contains `/api/`, `/customiser`, `/account` in disallow |
| Smoke: `/api/og?title=Test&subtitle=Hello` | 200 image/png |
| Smoke: `/fr-ca/legal/confidentialite` | 200 |
| Smoke: `/fr-ca/legal/cookies` | 200 |
| OG override on PDP | URL contains URL-encoded product title |
| Cookie banner mount | `CookieConsent` reference in HTML; renders client-side |

## Phase 3 queue

1. Stripe Checkout Session + webhook (real PSP)
2. Persistent backend for quotes / kits / orders (Drizzle + Postgres / Supabase)
3. Real product + industry photography
4. GA4 + transactional email (Resend or Postmark)
5. Real raster/vector fixture for the customizer E2E test
6. Cookie-consent gating wired into the analytics SDK once GA4 lands
