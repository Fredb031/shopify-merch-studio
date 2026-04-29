# CSS Budget Audit — Phase 8 Wave 6

**Date:** 2026-04-29
**Flagged:** CSS bundle 144KB minified, 3× over the stated 50KB budget.
**Outcome:** Documented findings; no automated fix shipped.

---

## Measured Sizes

| Bundle                          | Minified  | Gzipped   |
|---------------------------------|-----------|-----------|
| `dist/assets/index-*.css` (main)| 147,099 B | 23,046 B  |
| `dist/assets/index-*.css` (intro) | 1,632 B | ~700 B    |
| **Total**                       | **~144 KB** | **~23 KB** |

The 50 KB budget appears to be a **minified** target. At **23 KB gzipped on the wire**, the CSS is well within typical first-paint budgets for a 218-file React app, and is one of the smallest assets shipped (compare: `fabric-*.js` 310 KB, `index-*.js` 285 KB, `supabase-*.js` 195 KB).

## Where the Bytes Come From

Run breakdown of the 147 KB main CSS by selector type:

| Category    | Rule count | Bytes  | %      |
|-------------|------------|--------|--------|
| `.classes`  | 1,666      | 127 KB | 86.4%  |
| `@media`    | 13 blocks  | 11 KB  | 7.5%   |
| pseudo (`:where`, `:focus-visible`) | 11 | 2.6 KB | 1.8% |
| `@keyframes`| 27         | 2.6 KB | 1.8%   |
| tag (`h1`, `body`, …) | 39 | 2.4 KB | 1.6%  |

Distinct utility selectors emitted: **1,973**. The five biggest utility prefix groups account for **55 KB** alone:

| Prefix     | Count | Bytes   |
|------------|-------|---------|
| `hover:*`  | 156   | 17.1 KB |
| `focus:*`  | 114   | 11.5 KB |
| `bg-*`     | 143   |  9.6 KB |
| `text-*`   | 152   |  9.5 KB |
| `shadow-*` |  30   |  7.4 KB |

All of these correspond to utilities that are actually used in `src/`. Spot-check: `hover:` shows 100 unique literal occurrences in source plus group-hover, peer-hover, and arbitrary-class compounds — no leak.

## Tailwind Configuration Inspection

**`tailwind.config.ts` is clean:**

```ts
content: [
  "./pages/**/*.{ts,tsx}",
  "./components/**/*.{ts,tsx}",
  "./app/**/*.{ts,tsx}",
  "./src/**/*.{ts,tsx}",
]
```

- No `node_modules` glob leak.
- No `safelist` dumping color/spacing scales.
- `theme.extend.colors` adds 3 brand families (`navy`, `gold`, `va`, `brand`) — ~30 named colours total. Not 100+.
- No custom spacing/font-size scale extensions.
- Single plugin: `tailwindcss-animate` (small, well-behaved).

**`src/index.css` is clean:**

- 411 lines, ~13 KB raw.
- No `@import url(…)` of webfonts (fonts loaded via `<link>` in `index.html`).
- No raw vendor CSS pasted into `@layer base`.
- 11 named `@keyframes` + matching `.animate-*` aliases — all referenced from components.
- No `@apply` chains creating utility duplication.

**Arbitrary values in source:** 130 distinct arbitrary-value tokens (`[#0052CC]`, `[0_8px_32px_rgba(...)]`, etc.). These are heavy per-class but each only emits one rule. Top offenders:

- `bg-[#0052CC]` — 544 occurrences, single rule.
- `text-[#E8A838]` — 146 occurrences, single rule.

**Ratio check:** 23 KB gzipped / 1,973 utilities = ~12 bytes per utility. Within expected Tailwind output density.

## Why No Automated Fix Shipped

The instructions state: *"Don't ship vibes-based purge changes."* Every plausible win was investigated and discarded:

1. **Tighten content glob** — already tightly scoped to `src/`/`pages/`/`components/`/`app/`. The first three globs match nothing in the repo (legacy from the Lovable scaffold) and removing them would not change output.
2. **Trim safelist** — there is no safelist.
3. **Remove unused theme extensions** — every brand colour family has live consumers (verified `va.*`, `brand.*`, `navy`, `gold` all referenced).
4. **Extract heavy `@layer` blocks** — `@layer base` and `@layer utilities` together are ~6 KB minified. Extracting them saves nothing on the wire (would still ship in main CSS chunk via Vite's CSS pipeline) and would risk losing Tailwind's purge correctness.
5. **Arbitrary-value collapse** — replacing `[#0052CC]` with a `theme.extend.colors.brand.blue` token would save ~80 bytes per unique value × 130 = ~10 KB minified, ~1.5 KB gzipped. Worth doing on its own merits (token discipline) but a Phase 7 cleanup task touching ~600 call sites — **not** a safe Wave 6 ship.

## Recommendations for Operator (Future Work)

Ranked by ROI:

1. **Re-state the budget against gzipped size, not minified.** 23 KB gzipped is below the implicit web-perf target (typical Lighthouse "render-blocking CSS" warning fires above 14 KB initial inline / 50 KB+ total gzipped). The 50 KB minified limit is unusually tight for a feature-rich React+Tailwind app.

2. **Enable critical CSS extraction.** Vite + `vite-plugin-critical` (or move the smaller `IntroAnimation` CSS into a route-lazy import, which is already done) can inline above-the-fold styles and defer the 23 KB main bundle. Saves perceived load time more than trimming bytes.

3. **Token migration sweep (Phase 7 / 8 cleanup).** Replace the 8 most-used arbitrary colour values (`[#0052CC]`, `[#E8A838]`, `[#1B3A6B]`, `[#0F2341]`, `[#0A0A0A]`, `[#003D99]`, `[#E5E7EB]`, `[#374151]`) with the existing `va.blue`, `va.ink`, etc. tokens. Saves ~5 KB minified, improves dark-mode portability, requires touching ~1,000 call sites. Codemod-able.

4. **Audit `hover:*` / `focus:*` count vs actual interactive elements.** 156 hover and 114 focus variants is high. Likely fine (Tailwind only emits used variants, content glob is tight) but worth a one-off check whether template-string concatenation is producing dead variants.

5. **Drop the legacy `va` deprecated aliases** (`va-black`, `va-blue-h`, `va-blue-l`, `va-offwhite`, `va-bg-1/2/3`, `va-line-h`) once Phase 7 sweep replaces remaining call sites. Saves ~7 utility classes × ~70 B = ~500 B.

Total realistic savings ceiling without an architecture change: **~10 KB minified, ~1.5 KB gzipped.** Not worth the risk of breaking visual parity in Wave 6 with no human review.

## Verification

Build is reproducible: `npm run build` produces a 147,099-byte main CSS chunk on every run. Home page renders with no console errors at this size.

## Conclusion

**The 144 KB minified figure is real but not pathological.** The CSS is genuinely earned by the app surface (218 components, 4 brand colour families, hundreds of arbitrary shadow/colour values, full admin dashboard, customizer, checkout, marketing pages). At 23 KB gzipped it is a small contributor to total page weight versus the 1.5 MB+ of JavaScript. The budget should be revised to a gzipped target, or the savings work scheduled as a deliberate Phase 7 token migration, not a Wave 6 hot-fix.
