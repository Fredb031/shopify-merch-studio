# Git hooks

Repo-tracked git hooks for local dev convenience. Opt-in — nothing runs until
you point git at this directory.

## One-time setup

After cloning the repo, run:

```bash
git config core.hooksPath .githooks
```

This tells git to look here for hook scripts instead of the default
`.git/hooks/` directory. The setting is local to your clone and is not
committed.

To opt back out:

```bash
git config --unset core.hooksPath
```

## What the `pre-commit` hook does

Runs on every `git commit`, before the commit is recorded:

1. **`npx tsc --noEmit`** — full TypeScript type check. **Blocks the commit**
   if there are type errors. Same check CI runs.
2. **`npm run lint`** — ESLint summary. **Advisory only** — the hook prints
   the error/warning count and always exits 0, even if lint fails. Use it as a
   nudge to clean up warnings before pushing, not as a gate.

## Why not husky?

No new dependency, no `prepare` script, no `node_modules` surgery — just a
shell script in the repo and a one-line `git config`. If you prefer husky,
nothing here conflicts with it.

## Bypassing

For emergency commits, standard git bypass works:

```bash
git commit --no-verify -m "..."
```

Use sparingly — CI will still catch type errors on the PR.
