# 001 — Stack: Next.js 15 + next-intl + Tailwind 3.4

Status: accepted (2026-04-29)

## Context
Vision Affichage v2 is a marketing + catalogue site targeting Quebec SMBs with bilingual fr-CA / en-CA content. Requirements: SEO-strong (hreflang, JSON-LD, fast SSR), low ops surface, simple bilingual routing, and a token-driven design system.

## Decision
- Next.js 15 App Router with React 18 — RSC for fast SSR, file-based routing matches the planned content tree.
- next-intl 3.x — first-class App Router support, locale-prefixed routing (`/fr-ca`, `/en-ca`), zero-config server messages, type-safe namespaces.
- Tailwind 3.4 — token-driven utility CSS aligned with the UX dossier (ink/slate/sand palette, motion scale). Stable; v4 deferred until ecosystem catches up.
- pnpm 9 — fast, deterministic, works well in CI.
- TypeScript strict + `noUncheckedIndexedAccess` — catches array/index bugs early in fixture-driven content.

## Consequences
- Bilingual URL structure baked in from day one; adding more locales is one config edit.
- Marketing pages stay statically rendered (`generateStaticParams`) — fast TTFB, easy CDN caching.
- Tailwind tokens live in `tailwind.config.ts` and CSS vars in `globals.css` — designer-friendly.
- Migrating to Tailwind 4 later will be a config-only change.
