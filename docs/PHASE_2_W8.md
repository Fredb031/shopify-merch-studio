# Phase 2 — Wave 8

**Tag**: `v2-phase2-w8`
**Date**: 2026-04-30
**Branch**: `v2/rebrand`
**Predecessor**: `v2-phase2-w7` (`160bf95`)

Wave 8 closes Phase 2 with four conversion-focused commerce surfaces. Every
addition is fully static, fully bilingual, and persists state locally
(`localStorage` / `sessionStorage`) so nothing requires the still-unbuilt
Phase 3 backend.

---

## Wave 8 commits

Four feature commits + one verification commit, landing on `v2/rebrand`:

| SHA | Author | Message |
| --- | --- | --- |
| `5e25326` | parallel agent | feat(v2/quickview): peek modal on ProductCard — view key details + ATC without full PDP nav |
| `7d31cba` | parallel agent | feat(v2/cart): slide-in cart drawer — click cart icon for in-page preview |
| `9a67963` | parallel agent | feat(v2/reviews): replace mailto with proper review submission form at /avis/soumettre |
| `ae8d137` | parallel agent | feat(v2/wishlist): save-for-later with Zustand + /wishlist page + header icon |
| (this) | verification | docs(v2): Phase 2 wave 8 — wishlist + cart drawer + quick-view + review submit + tag w8 |

---

## What landed

### 1. Wishlist + `/wishlist` page (`ae8d137`)

- New zustand store `lib/wishlist.ts` — persisted to `va-wishlist-v1`
  localStorage; `productIds[]`, `add`/`remove`/`toggle`/`has`/`clear`/`count`.
- `components/product/WishlistButton.tsx` — heart toggle with pulse animation
  (gated on `prefers-reduced-motion`), inline ARIA-live toast ("Ajouté",
  "Retiré"), `aria-pressed` state. Two sizes (`sm` / `md`).
- Header gains a heart icon (`aria-label="Mes favoris"`) linking to
  `/wishlist`, with a count badge that mounts only after hydration.
- `/[locale]/wishlist` — bilingual page with hydration-safe shimmer, empty
  state (icon + CTA), populated state grid (4-column ProductGrid + clear
  button), and a footer link back to `/produits`.
- Integrated on `ProductCard` (top-right overlay) and `PdpClient` (above
  the StickyActionBar) so the heart appears in every catalogue surface.

### 2. Cart drawer (`7d31cba`)

- `lib/cart.ts` extended with `isDrawerOpen` boolean + `openDrawer` /
  `closeDrawer` / `toggleDrawer` actions.
- `components/cart/CartDrawer.tsx` — 400 px-wide right-slide modal, full
  focus-trap (Tab cycle, Esc closes, scrim click closes), body scroll
  lock, `prefers-reduced-motion`-aware 240 ms slide-in.
- Empty state, line items with qty +/-, remove, customizer logo badge,
  `OrderSummary` footer with subtotal, "Continuer le magasinage" CTA,
  "Voir le panier complet" link to `/panier`.
- Mounted globally inside `Header.tsx`. Triggered by header cart icon and
  by the PDP "Ajouter sans logo" CTA (replaces the old `/panier` redirect).
- The full `/panier` route is intentionally preserved for SEO and deep
  linking; both surfaces share the same store.

### 3. Quick-view modal (`5e25326`)

- `components/product/QuickViewModal.tsx` — 800 px max-width modal with
  side-by-side image + summary on desktop, full-screen on mobile.
- Owns its own variant state: color radiogroup, SizePicker, qty input
  with `min`/`max` clamping, Add-to-cart that fires the existing
  `useCart.addItem` then triggers a 600 ms confirmation toast and closes.
- Includes "Voir la fiche complète" link back to the full PDP.
- `components/product/QuickViewButton.tsx` overlays the ProductCard
  (mobile: always visible; desktop: opacity 0 until card hover or
  focus-within). Pill-shaped slate-700 button with eye icon.
- Pure progressive enhancement — JavaScript-disabled clients still hit
  the PDP through the underlying card link.

### 4. Review submission form (`9a67963`)

- `lib/reviewSubmitForm.ts` — Zod schema (`reviewSubmitSchema`) for name,
  email, optional company/role/productId, rating (1-5 int), title (max 80),
  body (30-1000 chars), `consentPublish: true` literal, marketing opt-in.
- Stores last submission to `sessionStorage["va-last-review"]` (Phase 3
  swaps for a moderation backend).
- `/[locale]/avis/soumettre` — react-hook-form + zodResolver, custom
  star-rating radiogroup, character counters on title + body, success
  state with `R-XXX` reference id, back link to `/avis`.
- Replaces the old `mailto:` CTA on `/avis` with a proper in-page form.

---

## Translation surface added

New top-level namespaces in `messages/{fr-ca,en-ca}.json`:

- `wishlist` — labels, page (heading, subhead, empty, clear), toast.
- `cartDrawer` — heading, count plural, close, viewFull, checkout, empty.
- `quickView` — modal labels, button, ATC, success toast.
- `reviewSubmit` — page (heading/breadcrumbs), form fields + success +
  errors block.

All keys exist in both locales; `pnpm build` shows no `MISSING_MESSAGE`
warnings.

---

## Surgical fixes landed in this verification commit

Two fixes on top of the parallel-agent feature commits to keep the
`pnpm exec playwright test` suite at 26 / 26 green:

1. **`components/CookieConsent.tsx`** — dropped the opacity 0 → 1 phase of
   the slide-up keyframe (kept the `translateY` slide). axe-core was
   capturing the banner mid-fade and computing a partly-blended
   background of `#adadae`, throwing color-contrast violations on
   `/fr-ca/produits` and `/fr-ca/produits/atc1015-tshirt-pre-retreci`.
   Also swapped the "Personnaliser" button's `hover:text-canvas-000/80`
   modifier for `hover:bg-canvas-000/10` so the underline button keeps
   full-white contrast in every state. (axe.contrast 100 % → 100 %)
2. **`tests/purchase-happy-path.spec.ts`** — accept the cookie banner
   before clicking through the funnel (otherwise the banner intercepts
   pointer events on the cart drawer scrim), and route through the new
   "Voir le panier complet" link in the drawer instead of expecting a
   direct `/panier` redirect after PDP "Ajouter sans logo".

---

## Verification gates (final)

| Gate                      | Result                                |
| ------------------------- | ------------------------------------- |
| `pnpm exec tsc --noEmit`  | exit 0                                |
| `pnpm lint`               | exit 0 — no warnings or errors        |
| `pnpm build`              | exit 0 — **84 SSG pages**             |
| `pnpm exec playwright test tests/` | **26 / 26 passing** (~25 s) |

### Smoke (`pnpm start` on :3000)

| Route                                       | HTTP |
| ------------------------------------------- | ---- |
| `/fr-ca`, `/en-ca`                          | 200  |
| `/fr-ca/produits`                           | 200  |
| `/fr-ca/produits/atc1000-tshirt-essentiel`  | 200  |
| `/fr-ca/wishlist`, `/en-ca/wishlist` (NEW)  | 200  |
| `/fr-ca/avis/soumettre`, `/en-ca/avis/soumettre` (NEW) | 200 |
| `/fr-ca/avis`                               | 200  |
| `/fr-ca/panier`, `/fr-ca/checkout`          | 200  |
| `/fr-ca/account`, `/fr-ca/customiser`       | 200  |
| `/fr-ca/infolettre`, `/fr-ca/legal/*`       | 200  |
| `/fr-ca/industries/construction`            | 200  |
| `/fr-ca/contact`, `/fr-ca/faq`              | 200  |
| `/fr-ca/comment-ca-marche`, `/fr-ca/a-propos`, `/fr-ca/kit` | 200 |

### DOM smoke

- Header — `aria-label="Mes favoris"` (heart link to `/wishlist`),
  `aria-label="Panier"` with `aria-haspopup="dialog"` (cart drawer
  trigger).
- ProductCard — `aria-label="Ajouter à mes favoris"` overlay heart and
  the QuickViewButton with `aria-haspopup="dialog"` + eye icon.
- PDP — `WishlistButton` rendered above the StickyActionBar.
- `/fr-ca/avis/soumettre` — visible "Partage ton expérience" heading,
  star rating, title + body fields, consent checkbox.

---

## Cumulative state — Waves 1 through 8

> Foundation laid in Phase 1. Phase 2 added eight waves of polish and
> commerce surfaces; tag history below.

| Wave | Tag                       | Theme                                                                 |
| ---- | ------------------------- | --------------------------------------------------------------------- |
| 1-3  | (cumulative)              | Customizer rebuild · quote/kit forms · SanMar wiring · about/faq/process · account · realistic placeholders |
| 4    | `v2-phase2-final`         | E2E coverage (8 spec files) · industry copy/case studies/proof points · sitemap/robots/OG · bundle audit |
| 5    | `v2-phase2-sealed`        | Loi 25 cookie consent · OG title/subtitle overrides · industry SVGs   |
| 6    | `v2-phase2-final-2.5`     | Plausible analytics gated on consent · branded 404 · 6 loading skeletons · PWA manifest + dynamic icons |
| 7    | `v2-phase2-w7`            | Cmd+K global search · CASL newsletter (`/infolettre`) · clean print stylesheets · related products + cart upsell |
| 8    | **`v2-phase2-w8`** (this) | Wishlist + `/wishlist` · cart drawer · quick-view modal · review submission (`/avis/soumettre`) |

**Page count progression**: Phase 1 baseline ≈ 30 pages → wave 4 ≈ 60 → wave 6
≈ 70 → wave 7 = 80 → **wave 8 = 84 SSG pages** (every locale × every route,
including the two new routes `/wishlist` and `/avis/soumettre`).

### 16-feature surface added since Phase 1 baseline

1. Customizer round-trip with proof-first upload + cart auto-add
2. Multi-step quote form (`/soumission`) with reference id
3. Discovery kit (`/kit`) with sample fee + waiver flow
4. Loi 25 cookie consent banner + `/legal/{confidentialite,cookies}`
5. Plausible analytics (consent-gated)
6. Branded 404 page + 6 route-specific loading skeletons
7. PWA manifest + dynamic VA-monogram icons
8. Per-page Open Graph title/subtitle overrides + `/api/og` runtime image
9. Global Cmd+K search dialog with combobox
10. CASL-compliant newsletter signup (`/infolettre`)
11. Print stylesheet for order / quote / kit / contact confirmations
12. PDP related-products + cart upsell heuristic
13. **(W8)** Wishlist + `/wishlist` page
14. **(W8)** Slide-in cart drawer
15. **(W8)** Product quick-view modal
16. **(W8)** Review submission form (`/avis/soumettre`)

---

## Phase 3 operator queue (unchanged)

These remain the operator-side tasks that block making the site fully
production-grade. Wave 8 deliberately did not pre-empt them.

1. **Real backend** — replace localStorage stubs (cart, wishlist, account
   activity, review submissions, contact tickets, kit orders) with a real
   DB (Postgres + Drizzle / Supabase) + auth (better-auth or Clerk).
2. **Real payment gateway** — wire Stripe Checkout Session + webhook to
   replace the mock card flow in `/checkout` (PCI-DSS SAQ A scope).
3. **Real photography** — every `/placeholders/products/*.svg` is a
   brand-tinted abstract; commission lifestyle + hero shots for the top
   10 SKUs minimum, plus replace the abstract industry SVG heroes.
4. **ESP integration** — wire `/infolettre` and contact-form
   `marketingConsent` into a real provider (Mailchimp / Klaviyo / Brevo /
   Postmark) with double-opt-in delivery.
5. **Custom analytics events** — Plausible currently fires page-views only.
   Map: `cta_click_quote`, `cta_click_kit`, `customizer_save`, `cart_add`,
   `wishlist_add`, `quick_view_open`, `review_submit`, `search_query`.
   Set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` to enable.
6. **Review moderation backend** — `/avis/soumettre` currently stores the
   last submission in sessionStorage; Phase 3 needs a moderation queue +
   email notification + publish-to-`lib/reviews.ts` flow.
7. **Recommender upgrade** — replace the hand-tuned cross-category
   recommender + `<CartUpsell>` heuristic with a real co-purchase model
   once order volume justifies it.
8. **Final legal copy** — `/confidentialite`, `/conditions` still on
   `PhaseTwoStub` awaiting operator-approved policy text.

---

## File index (Wave 8)

New (from parallel agents):

- `lib/wishlist.ts` (`ae8d137`)
- `lib/reviewSubmitForm.ts` (`9a67963`)
- `components/product/WishlistButton.tsx` (`ae8d137`)
- `components/product/QuickViewModal.tsx` (`5e25326`)
- `components/product/QuickViewButton.tsx` (`5e25326`)
- `components/cart/CartDrawer.tsx` (`7d31cba`)
- `app/[locale]/wishlist/page.tsx` (`ae8d137`)
- `app/[locale]/avis/soumettre/page.tsx` (`9a67963`)
- `app/[locale]/avis/soumettre/ReviewSubmitClient.tsx` (`9a67963`)

Modified by parallel agents:

- `components/Header.tsx` — heart link, cart drawer trigger, count badges.
- `components/product/ProductCard.tsx` — wishlist + quick-view overlays.
- `app/[locale]/produits/[slug]/PdpClient.tsx` — wishlist row + drawer-open
  on "Ajouter sans logo".
- `lib/cart.ts` — `isDrawerOpen` + drawer actions.
- `messages/{fr-ca,en-ca}.json` — new namespaces.

Modified by this verification commit:

- `components/CookieConsent.tsx` — drop opacity fade, swap underline-button
  hover modifier (axe-clean fix).
- `tests/purchase-happy-path.spec.ts` — accept cookies + traverse the new
  drawer flow.
- `README.md` — refreshed feature surface + Phase 3 queue.
- `docs/PHASE_2_W8.md` — this file.
