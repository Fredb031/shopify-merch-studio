# Contributing to Vision Affichage

Thanks for improving the storefront. These rules keep history clean and builds green.

## First-time setup

After cloning, enable the repo's local git hooks (one-time, per clone):

```bash
git config core.hooksPath .githooks
```

This opts you into a `pre-commit` hook that runs `tsc --noEmit` and reports
lint warnings. See [`.githooks/README.md`](./.githooks/README.md) for details.

## Workflow

1. **Fork** the repo (or branch directly if you're a maintainer).
2. **Branch** off `main` with a descriptive, kebab-case name prefixed by the commit type:
   `<type>-<short-description>` — e.g. `feat-cart-recs-mobile`, `fix-pdp-variant-swatch`.
3. **Commit** in small, focused chunks (see below).
4. **Open a PR** against `main` using the template at
   [`.github/pull_request_template.md`](./.github/pull_request_template.md).

## Commit style

We follow [Conventional Commits](https://www.conventionalcommits.org/). Format:

```
<type>(<scope>): <imperative subject>

<optional body explaining the why>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

### Types used in this repo

| Type | Use for |
| --- | --- |
| `feat` | New user-facing feature |
| `fix` | Bug fix |
| `a11y` | Accessibility improvements (aria, contrast, keyboard, reduced-motion) |
| `perf` | Performance / bundle-size wins |
| `content` | Copy, translations, static data changes |
| `docs` | README, CONTRIBUTING, inline docs |
| `chore` | Tooling, deps, config with no runtime impact |
| `refactor` | Code restructure with no behavior change |
| `test` | Adding or updating tests |

### Scope

Use the component name or the product area:

- Component: `feat(admin): ...`, `fix(customizer): ...`, `a11y(header): ...`
- Area: `feat(pdp): ...`, `perf(cart): ...`, `content(home): ...`, `fix(checkout): ...`

Pick the narrowest scope that's still readable.

### Co-author footer

All agents (human or AI) must append this trailer to every commit:

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

## One commit per change

Each commit should do exactly one thing and have a subject that fits in ~72 chars.
If you can't describe a commit in one line, split it. Don't mix refactors with
behavior changes, and don't mix unrelated fixes.

## Verify before commit

Both of these must pass locally before you push:

```bash
npx tsc --noEmit
npx vite build
```

CI will re-run them, plus `npm run test` and the Playwright smoke suite, on every PR.

## No binaries in git

Never commit images, icons, fonts, or other binary assets through a commit.
Drop PNGs / SVGs / media into `public/` via the GitHub repo UI (or the Lovable
asset uploader). Keeps `git clone` fast and diffs reviewable.

## Questions

Open a draft PR early — it's the fastest way to get feedback.
