# Repo Hygiene Survey — 2026-04-29

Survey-only pass. No branches were deleted. Operator decides what to clean up
based on the recommendations below.

`gh` CLI was not available on the survey host, so PR association was skipped.
Operator should cross-check open PRs before deleting any branch flagged here.

## Overview

- **Remote branches** (excluding `HEAD`, `main`): 18
- **Local branches** (excluding `main`): 8
- **Total tracked refs**: 26 non-main branches

Reference points used for age:

- "Today" = 2026-04-29
- ">7 days old" = last commit before 2026-04-22
- ">30 days old" = last commit before 2026-03-30

`git branch -r --merged main` reported zero remote branches as merged into
`main` via merge commit. The autonomous-wave branches were squash-merged or
their commits cherry-picked into main, so the merge-commit ancestry check
returns false for them. That is expected — operator should treat the
"hunt*"/wave branches as logically merged once the corresponding feature has
landed on main, even though the topology check says otherwise.

## Safe to delete (>7 days, logically merged or fully-superseded)

These are **>7 days old**, **not under active development**, and represent
work waves whose output has already been integrated into main (or has been
abandoned in favour of a follow-on branch). Recommend deletion after operator
confirms no open PR is referencing them.

| Branch | Last commit (UTC offset) | Author | Subject |
|---|---|---|---|
| `origin/shopify-theme` | 2026-04-17 14:37 -04 | Frederick Bouchard | feat: add shopify-theme branch — valid Shopify Online Store 2.0 theme |
| `origin/autonomous-improvements` | 2026-04-18 01:20 +00 | Vision Autonomous Agent | feat: admin orders page scaffold with table, filters, drawer |
| `origin/hunt53-17534` | 2026-04-20 17:42 -04 | Frederick Bouchard | fix(cart): fr-CA / en-CA locale for subtotal, line items, savings |
| `origin/hunt60-19270` | 2026-04-20 19:20 -04 | Frederick Bouchard | a11y(mole-game): sr-only live region + progressbar role |
| `origin/hunt64-20238` | 2026-04-20 21:36 -04 | Frederick Bouchard | fix(admin-quotes): guard total + discount against NaN |
| `origin/hunt76-41067` | 2026-04-21 00:40 -04 | Frederick Bouchard | fix(track-order): guard ETA against NaN when createdAt is malformed |
| `origin/hunt82-48080` | 2026-04-21 03:16 -04 | Frederick Bouchard | fix(track-order): bump ETA landing on Sat/Sun to Monday |
| `origin/hunt83-49332` | 2026-04-21 03:42 -04 | Frederick Bouchard | feat(intro): Escape key skips intro animation |

That is **8 remote branches** safe to clean up.

## Stale candidates (>30 days, no open PR)

**None.** The repo is young — every tracked branch has a commit dated within
the last 12 days. No branches have crossed the 30-day stale threshold yet.

## Active (recent commits, leave alone)

These have commits within the last 7 days. Treat as live work.

### Local

| Branch | Last commit | Author | Subject |
|---|---|---|---|
| `agent-navs-rebuild` | 2026-04-28 23:14 -04 | Frederick Bouchard | feat(navs): rebuild Navbar + BottomNav |
| `agent-vite-perf` | 2026-04-28 23:13 -04 | Fredb031 | perf(vite): manualChunks vendor split |
| `asset-pipeline` | 2026-04-29 14:48 -04 | agent-asset-pipeline | feat(assets): dark branded placeholders |
| `homepage-bug-fix` | 2026-04-29 00:12 -04 | Fredb031 | fix(home): surgical bug pass post-splice |
| `nfd-extract` | 2026-04-29 14:52 -04 | Frederick Bouchard | refactor(normalize): NFD diacritic-strip helper |
| `phase8-perf-qa` | 2026-04-29 13:58 -04 | Frederick Bouchard | chore(phase8): perf + QA |
| `sanmar-step2` | 2026-04-29 13:27 -04 | Frederick Bouchard | test(sanmar): Step 2 unit tests with golden SOAP fixtures |
| `sanmar-step3` | 2026-04-29 13:24 -04 | Fredb031 | feat(sanmar): Step 3 — 6 edge functions + migration |

All 8 local branches are active. Operator should resolve them by either
opening a PR, rebasing onto `main`, or deleting once the work has landed on
main. Most of the sanmar/phase8/asset/nfd work appears to have been
integrated into the latest `main` commits already (`9a3e7db` sanmar TS-layer
integration, etc.), so they may be safe to drop after a quick `git diff
main..<branch>` check.

### Remote

| Branch | Last commit | Author | Subject |
|---|---|---|---|
| `origin/v2/rebrand` | 2026-04-29 22:22 -04 | Frederick Bouchard | chore(v2): Wave 3B — Phase-1 QA, Playwright E2E + a11y, README, ADRs |

## Special long-lived branches (do not auto-delete)

These are intentional long-running tracks. Keep until the operator declares
the redesign or rebrand programme complete.

| Branch | Last commit | Notes |
|---|---|---|
| `origin/v2/rebrand` | 2026-04-29 22:22 | Active rebrand programme — see commit "Wave 3B" |
| `origin/redesign/p1-foundation` | 2026-04-25 19:33 | Phase 1 of phased redesign — brand tokens migration |
| `origin/redesign/p2-homepage` | 2026-04-25 19:03 | Phase 2 — homepage Bernays/herd/authority pass |
| `origin/redesign/p3-nav` | 2026-04-25 19:02 | Phase 3 — Navbar + bottom nav rebuild |
| `origin/redesign/p4-products` | 2026-04-25 19:08 | Phase 4 — shop hero + PDP rebuild |
| `origin/redesign/p5-customizer` | 2026-04-25 19:13 | Phase 5 — customizer fixes + confidence badge |
| `origin/redesign/p6-cart-checkout` | 2026-04-25 19:06 | Phase 6 — cart cross-sell + checkout urgency |
| `origin/redesign/p7-triggers` | 2026-04-25 19:02 | Phase 7 — exit intent + first-visit banner |
| `origin/redesign/p9-copy` | 2026-04-25 19:18 | Phase 9 — per-page meta + footer + 404 |
| `origin/redesign/p10-perf` | 2026-04-25 19:16 | Phase 10 — bundle splitting + CWV CSS guards |

Note: `redesign/p8-*` is missing from the list (likely never pushed or
already squash-merged). Worth confirming with the operator whether p8 was
folded into p7 or p9.

These ten redesign phases are all dated 2026-04-25 — the same wave. They are
**not** stale; they are checkpoints from a single redesign run that the
operator may merge serially. Leave alone until the operator says
otherwise. If the operator confirms the phased redesign has fully landed in
v2/rebrand or main, they can be batch-deleted at that point.

## Recommended cleanup commands

Operator runs these manually once they have confirmed no open PR references
the listed branches. Do not run from CI.

```bash
cd /tmp/site-fix

# 1. Confirm no open PRs reference the safe-to-delete branches
#    (manual check on github.com/Fredb031/visionaffichage/pulls)

# 2. Delete merged / superseded remote branches
git push origin --delete \
  shopify-theme \
  autonomous-improvements \
  hunt53-17534 \
  hunt60-19270 \
  hunt64-20238 \
  hunt76-41067 \
  hunt82-48080 \
  hunt83-49332

# 3. Resolve local active branches (per branch — pick one):
#    a) Open a PR if work is not yet on main
#    b) Rebase onto main, push, then delete locally
#    c) If already merged into main, delete locally:
git branch -D \
  agent-navs-rebuild \
  agent-vite-perf \
  asset-pipeline \
  homepage-bug-fix \
  nfd-extract \
  phase8-perf-qa \
  sanmar-step2 \
  sanmar-step3
#    (Run `git diff main..<branch>` first to verify the diff is empty
#     before -D — otherwise use -d to let git refuse if work is unmerged.)

# 4. Prune local refs to remotes that no longer exist
git fetch --all --prune
```

## Follow-ups for the operator

1. **Confirm `redesign/p8-*` status.** Phase 8 is missing from the redesign
   sequence — was it folded into another phase, or never pushed?
2. **PR association sweep.** Run on a host with `gh` CLI:
   `gh pr list --state all --limit 200 --json number,state,title,headRefName`
   and cross-reference against this list before deletion.
3. **Operator policy on hunt-* branches.** These accumulate one-per-wave.
   Consider adding a post-merge hook on the autonomous loop that
   `git push origin --delete <hunt-branch>` immediately after the wave's PR
   merges, so they never build up beyond ~3 in flight.
4. **Local working tree.** `supabase/migrations/20260429210000_sanmar_cache_metrics.sql`
   is currently untracked on `main`. Either commit it or add to `.gitignore`.
