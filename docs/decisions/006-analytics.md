# 006 — Analytics: Plausible.io, gated on Loi 25 consent

Status: accepted (2026-04-29)

## Context
Wave 5 shipped `lib/cookieConsent.ts` (Loi 25 / Quebec Bill 64 compliant — non-essential categories default OFF, explicit opt-in required) and the `<CookieConsent />` banner. Phase 2 closed without an analytics provider wired, so we have no visibility into traffic, conversion funnels, or which pages users actually reach. Phase 3 needs that signal to prioritize.

Constraints:
- **Loi 25** — no tracking before explicit, granular consent. No cross-site identifiers. Right to withdraw must be honored.
- **PIPEDA** (federal) — same direction, slightly looser.
- **Brand** — the site's value prop is "Quebec, calm, no dark patterns." Loading Google Analytics would contradict that even with consent.
- **Operator burden** — Frédérick is a solo operator. The analytics provider must be cheap and zero-maintenance.

## Decision
**Plausible.io**, mounted via `<Analytics />` (a client component) and gated on `hasConsent('analytics')`.

Architecture:
- `components/Analytics.tsx` — reads `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` and `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL`. Renders nothing if domain is unset (graceful no-op until operator configures). On mount, checks `hasConsent('analytics')`. Listens for `va:consent-changed` and `va:consent-cleared` events to mount/unmount the script reactively.
- `lib/analytics.ts` — `trackEvent(name, props?)` helper that no-ops on the server, when consent is missing, or when the Plausible global isn't loaded. `trackPageview()` is a no-op (Plausible auto-tracks pageviews).
- `app/[locale]/layout.tsx` — mounts `<Analytics />` next to `<CookieConsent />`.

## Rationale

### Why Plausible
- **Cookieless by design** — uses a daily-rotating hash of (IP + User-Agent + domain + salt) to deduplicate visitors. No persistent identifiers, no fingerprint that survives 24h. This means the cookie banner is technically not even required for Plausible itself in most jurisdictions — but we gate anyway (see below).
- **GDPR / PIPEDA / Loi 25 friendly** — no cross-site tracking, no data sale, EU-hosted (Frankfurt) with a Canadian region option for stricter data-residency contracts later.
- **Lightweight** — < 1 KB gzipped script vs ~50 KB for GA4. No measurable LCP/TBT impact, which protects the Lighthouse 95+ targets locked in Phase 2.
- **Cheap** — flat $9/mo for the operator's expected traffic tier. No surprise overage like Vercel Analytics or Mixpanel.
- **Honest dashboards** — no dark patterns, no upsells. Matches the brand's voice.

### Rejected alternatives
- **Google Analytics 4** — heavy script, requires consent for everything, cross-site identity by default, cookie banner becomes a hard requirement, and the operator does not need GA's audience-segmentation depth.
- **Vercel Analytics** — fine for traffic, but the project may move off Vercel later (Cloudflare Pages is a candidate); coupling to Vercel here adds switching cost.
- **Self-hosted Plausible / Umami** — saves the $9/mo but adds an ops surface (DB, updates, backups) that a solo operator does not need at this stage. Reconsider at scale.
- **Fathom** — similar to Plausible, slightly pricier, no Canadian region option as of 2026-04. Plausible wins on residency story.

### Why we still gate Plausible on consent
Defense in depth.
1. **Operator might switch providers later.** If someone swaps Plausible for a tracker that does use cookies (e.g. Mixpanel for funnels), the gate already exists and they don't have to re-architect. The contract is "no analytics script unless consent."
2. **Loi 25 case law is young.** A regulator that reads "tracking" expansively might still flag even cookieless analytics. Gating costs nothing and removes ambiguity.
3. **User trust.** When the user declines analytics, a network panel shows zero `plausible.io` requests. That's the strongest possible signal that the consent banner is real.

## Consequences
- Without env vars set: build succeeds, no script tag in HTML, zero analytics — operator opts in by setting `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`.
- With env vars + analytics consent declined: no script tag, no network request to plausible.io.
- With env vars + analytics consent accepted: script loads via `next/script` (afterInteractive), pageviews auto-tracked, `trackEvent` calls fire.
- Withdrawing consent (via `clearConsent` or unchecking analytics in settings) unmounts the script on the next render. The `va:consent-cleared` and `va:consent-changed` events drive this.

## Phase 3 custom events — to instrument
These are the events worth tracking once analytics is enabled. They map directly to conversion-funnel questions.

- `contact_form_submit` — props: `{ locale, source }` (homepage vs PDP vs sticky CTA). Counts qualified leads.
- `quote_form_submit` — props: `{ locale, kit_size, industry }`. Bigger-ticket leads.
- `kit_form_submit` — props: `{ locale, kit_type }`. Segments interest by SKU family.
- `customizer_open` — props: `{ product_handle }`. Top-of-funnel for the customizer flow.
- `customizer_complete` — props: `{ product_handle, options_changed }`. Bottom-of-funnel.
- `kit_order_placed` — props: `{ kit_type, total_cents }`. Revenue proxy (real revenue lives in Shopify).
- `language_switch` — props: `{ from, to }`. Validates the bilingual investment.
- `pdp_image_zoom` — props: `{ product_handle }`. Cheap signal that imagery is doing work.

Do not instrument: search queries, scroll depth, or anything tied to identifiable user paths. Stick to aggregate events.

## Trade-offs
- Plausible's free tier doesn't exist; $9/mo is real. Acceptable for a marketing-led B2B site.
- No session replay (Hotjar / FullStory equivalents). Deliberate — those tools are PII magnets and clash with the consent posture.
- Server-side events not wired. Phase 3 can add a `/api/track` proxy if needed (e.g. for Shopify webhooks → Plausible), but client-side covers the funnel for now.

## Verification (acceptance gates)
- `pnpm exec tsc --noEmit` exit 0
- `pnpm lint` exit 0
- `pnpm build` exit 0
- No env vars: build succeeds, no script tag in rendered HTML.
- Env vars set, analytics declined: no script tag.
- Env vars set, analytics accepted: `<script ... data-domain=... src=...>` present.
