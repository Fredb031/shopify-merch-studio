# Vision Affichage — Phase 1-6 Audit Report

**Date:** 2026-04-18
**Scope:** Code-based architecture audit + critical-path fixes + conversion-pattern additions.

## Honest scope of this audit

This pass was done from inside the codebase (full read access to /tmp/site-fix + GitHub repo + Shopify Admin via Zapier MCP). I do NOT have a headless browser in this environment — there are no actual screenshots, no live runtime breakpoint tests, no real DOM-rendered pixel checks. Every "visual" claim is inferred from the code, not seen.

What that changes:
- I caught structural bugs (state desync, missing wires, dead branches) cleanly.
- I cannot verify with certainty that, say, a flexbox aligns visually at 390px. Run in a real browser to confirm.
- The Phase-5 "test 3 times end-to-end" requirement was satisfied as static analysis + typecheck + commit verification, NOT as live click-throughs. Frederick should run the purchase flow himself in production once before declaring done.

---

## What I found, by severity

### P0 — broken (one critical)

**Cart never reached Shopify.** The customizer wrote items to a local Zustand store (`src/store/cartStore.ts`) but the multi-variant flow (which is the actual price-point pattern Frederick uses — multiple colors × sizes per session) skipped the Shopify Storefront cart store (`src/stores/cartStore.ts`) entirely. As a result, `shopifyCart.checkoutUrl` was always `null`, the on-site `/checkout` page's "Pay" button had no Shopify URL to redirect to, and the fallback dumped customers on the bare `myshopify.com/cart` with no customizer context.

**Fix:** `VariantQty` type now carries `shopifyVariantId`. `MultiVariantPicker` receives full `ShopifyVariantColor[]` (with `sizeOptions`) and resolves each cell to a real variant ID. `ProductCustomizer.handleAddToCart` writes ONE local cart line per color group **and** pushes one Shopify cart line per (color × size) variant. Local cart line stores `shopifyVariantIds[]` so removals stay in sync. `Checkout.handlePay` polls for `getCheckoutUrl` up to 6 × 350ms while `isLoading` to handle the async race, then either redirects to the real Shopify checkout or surfaces a localized error with the support number.

### P1 — functionally wrong (two)

1. **Login button missing on most pages.** `<Navbar />` was being mounted on ProductDetail / Cart / Account / Checkout / Products / TrackOrder without `onOpenLogin`. Since the Connexion button only rendered when `onOpenLogin` was passed, customers who hit a product page directly couldn't sign in. **Fix:** Navbar now manages its own LoginModal internally as a fallback. Pages can still pass `onOpenLogin` to override. Login button shows everywhere, with mobile shrinking to icon-only.

2. **Customizer center button did nothing.** The logo placement `useEffect` was deps-locked to `[ready, logoUrl, zoneId]`. Updating `currentPlacement.x/y` from the parent (e.g. center button) never triggered re-positioning. **Fix:** new `useEffect` watches `currentPlacement.x/y/width/rotation` and moves the existing fabric image in place — no rebuild, no flicker.

### P2 — UX friction (several, fixed in earlier commits)

- Customizer modal too tall on mobile → footer ("Continue" / "Add to cart") and X close button hidden. **Fix:** modal height 92dvh, grid rows `auto minmax(0,1fr) auto`, canvas aspect ratio reduced.
- ProductDetail had separate front/back thumbnails that confused color picking. **Fix:** single hover-to-flip image — default = front in selected color, hover = back in same color. Pill in corner shows `Survol pour dos` → `Dos`.
- Color pastilles falling back to gray (#888) when Shopify returned a color name not in the local catalog. **Fix:** falls back to `colorNameToHex()` from `shopify.ts` (70+ FR/EN mappings).
- Logo + placement reset when picking a different color. **Fix:** canvas init `useEffect` split into two — init runs once on mount + resize, photo-swap effect reacts to `imageDevant`/`imageDos`/`activeView`/`garmentColor`. Logo state survives.

### P3 — aesthetic (deferred to autonomous agent)

The autonomous burst agent is running perpetually with 26 focuses (typography polish, hero copy A/B, mobile filter sheet, micro-animations, etc.) and ships small commits to `autonomous-improvements` for human review. Tracked separately.

### P4 — opportunity (added in this pass)

- **CartRecommendations** module on `/cart`: 3 products NOT in cart, biased to same category as existing items. "Souvent commandé avec" headline (peer signal) + "Économise sur la livraison" microcopy (financial frame). Inserted between cart lines and order total — last high-attention slot before payment commitment.
- **Urgency banner on checkout** above Pay button: emerald "⚡ Commande avant 15h — livrée d'ici le jeudi 24 avril" with client-side calculated ship-by date. Past 3pm bumps one business day. Reduces commitment hesitation at the exact moment of friction.
- **AI chat** replacing the static help bubble: knowledge-base-grounded responder with 14 covered intents (price, delivery, colors, taxes, payment, returns, warranty, edits, custom quotes, etc.) in both FR and EN. Quick-prompt chips on first open. Drop-in replacement: swap `answerLocal()` with a fetch to a Supabase edge function calling Anthropic Messages API for a real LLM upgrade.
- **`/track` and `/track/:orderNumber`** order tracking: matches against real Shopify orders (Zapier-snapshotted). 4-stage visual stepper with ETA pill.
- **`/account`** customer profile + order history.
- **Customer Account → admin invite flow → AcceptInvite** wired end-to-end with Supabase Auth (pending migration apply by Frederick).

---

## What I changed aesthetically + the reasoning

| Change | Reason (psychology / conversion) |
|---|---|
| ProductDetail title swap (SKU above as small mono, category as big extrabold) | A first-time visitor needs to recognize "T-Shirt" instantly. SKU is internal noise — useful for the team, not the customer. Demoting it lowers cognitive load and lifts perceived clarity. |
| ProductDetail color pastilles → real visual swatches with selection ring + checkmark | Buyers decide on color visually, not verbally. Text labels force a translation step. Swatches collapse decision time. |
| Single hover-to-flip product image (no thumbnail strip) | Two thumbnails (front/back) created a contradiction with the right-column color picker — bottom-left could show black while right-side picker said "Marine". Single image bound to selected color removes the contradiction entirely. |
| Customizer canvas — gradient cream background + "studio light" radial in corner + drop shadow | Studio-photo aesthetic primes premium/quality perception. Plain white reads "default" / "unfinished". |
| Customizer "Real color" emerald badge top-left | Trust signal: confirms the picked color is showing the actual photo, not a tinted approximation. Pre-empts the "is this what I'll actually get?" anxiety. |
| Center button as a prominent gradient CTA + divider "ou choisis une zone" | The most-used placement (chest center) was buried in a list of equally-weighted zones. Promoting it with a visual hierarchy (size, gradient) reflects how customers actually use the tool. |
| Checkout urgency banner | Time-bound delivery promise reduces friction at the exact moment of payment commitment. Specific date + day-of-week beats generic "5 days". |
| CartRecommendations cross-sell | Peer signal ("Souvent commandé avec") is the highest-leverage e-commerce conversion pattern. Same-category bias maximizes likelihood of relevance. |

---

## Things I did NOT touch and why

- **Steps timeline animation** (Frederick mentioned wanting more interactivity around it). Currently has a scale-in animation per step with a gradient progress line. I left it alone in this pass because the existing animation is on-brand and additional motion risks crowding the section. If Frederick wants more, I'd add hover-state expanded detail per step rather than ambient motion.
- **Removing the "blond" t-shirt duplicates** Frederick mentioned. The audit found NO duplicate SKUs in the local catalog — all 22 products have unique SKUs. ATC1000 / ATC1000L / ATC1000Y are men/women/kids variants of the same line, which is intentional. If Frederick meant something else, he should point at a specific Shopify URL.
- **Newsletter Resend wiring.** SiteFooter persists subscriber emails to localStorage; wiring to Resend or Mailchimp requires an API key. Pattern documented in code; ready to swap in.
- **Real LLM in AIChat.** Local rule-based responder ships now and works without external dependencies. Drop-in replacement with Anthropic Messages API (via Supabase edge function) when Frederick is ready.

---

## Tests I ran

- `npx tsc --noEmit` after every batch. Zero TypeScript errors at every commit.
- Code-level wire verification: traced every cart action from customizer → store → checkout. Identified the desync gap before fixing.
- Architecture map verified by an Explore subagent. Full inventory of routes, pages, components, stores, hooks, data layer, backend, i18n, dead code.
- Targeted second audit on duplicates, mixed strings, dead links, auto-popup nuisances, mobile breakpoints, accessibility, dead code. Result: codebase is cleaner than expected — no broken hrefs, no console.log spam, no missing alts, no fixed widths blocking mobile.

What I did NOT run:
- Live browser tests at 375 / 390 / 768 / 1280 / 1440 / 1920px.
- Real screenshot comparison to visionaffichage.com production.
- End-to-end purchase flow with a real card. Frederick should do this himself before announcing the cart-fix as fixed.

---

## What remains

1. **Frederick action: Apply the Supabase migration** (`supabase/migrations/0001_auth_quotes_invites.sql`) in Supabase Studio, then `supabase functions deploy admin-invite-vendor`. Without this, signup/login/forgot-password against the real backend doesn't work — the dev fallbacks still allow the demo accounts though.
2. **Frederick action: Sign up at /admin/signup with `contact@fredbouchard.ca`** to claim the President role automatically (handled by trigger in the migration).
3. **Verify the cart-sync fix in production.** I confirmed the wiring statically; an actual test purchase is the only way to be sure the Shopify cart ID flows properly across navigations.
4. **ATC6277 + ATCF2600 missing on Shopify.** Two SKUs in `src/data/products.ts` aren't represented as Shopify products. Either archive them locally or create the Shopify products. Up to Frederick.
5. **The autonomous burst agent** continues to ship polish commits to the `autonomous-improvements` branch. Review and merge when convenient.

---

## Recommendations for next steps

1. Apply the Supabase migration. This is the gate to real auth + invite flow.
2. Run a smoke test: add 2 colors × 3 sizes to cart from a product page → review on `/cart` → click Pay → verify Shopify checkout opens with the right line items.
3. Decide on AT6277 / ATCF2600.
4. When ready: wire the AIChat rule-based responder to a real LLM via Supabase edge function. The interface stays the same; just swap `answerLocal()`.
5. Newsletter signup → Resend (15 min job once you have a Resend API key).
6. Eventually consolidate `useAuth` hook + `useAuthStore` into one canonical pattern. They overlap and one of them will silently get stale.
