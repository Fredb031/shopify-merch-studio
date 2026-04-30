# Error Reporting

`src/lib/errorReporter.ts` is the **central choke point** for forwarding
runtime exceptions and structured messages to an external monitor
(Sentry, Datadog RUM, LogRocket, Bugsnag, ...). Every place in the app
that needs to "report this error" goes through it.

## Why a thin abstraction (instead of importing Sentry directly)?

- **Bundle weight:** A real monitor SDK is 50KB+ gzipped on its own.
  Shipping it before the operator has chosen one — and signed up for a
  paid tier — bloats the bundle for zero value.
- **Vendor lock-in:** Replacing Sentry with Datadog (or vice versa) is
  a one-file swap when call sites go through this abstraction. If
  call sites import `@sentry/react` directly, every callsite has to
  change.
- **Testability:** The default implementation is a noop that only
  echoes to `console.{error,warn}` in DEV. Tests can swap in a
  recorder via `setErrorReporter()` without monkey-patching globals.

## Where it's wired today

- `src/components/ErrorBoundary.tsx` calls `captureException` from
  `componentDidCatch` (in addition to keeping a DEV-only `console.error`
  for local debugging).
- The default reporter is the `noopReporter` defined in
  `src/lib/errorReporter.ts`. In production it does nothing; in DEV it
  logs to the console with an `[errorReporter]` prefix.

## Wiring Sentry

```ts
// src/main.tsx (or a dedicated src/lib/initMonitoring.ts called from main.tsx)
import * as Sentry from '@sentry/react';
import { setErrorReporter } from '@/lib/errorReporter';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
});

setErrorReporter({
  captureException: (e, ctx) => Sentry.captureException(e, { contexts: ctx }),
  captureMessage: (m, ctx) => Sentry.captureMessage(m, { contexts: ctx }),
  setUser: (u) => Sentry.setUser(u),
});
```

Add `VITE_SENTRY_DSN` to `.env.local`. Install once: `npm i @sentry/react`.

## Wiring Datadog RUM

```ts
import { datadogRum } from '@datadog/browser-rum';
import { setErrorReporter } from '@/lib/errorReporter';

datadogRum.init({
  applicationId: import.meta.env.VITE_DD_APP_ID,
  clientToken: import.meta.env.VITE_DD_CLIENT_TOKEN,
  site: 'datadoghq.com',
  service: 'vision-affichage',
  env: import.meta.env.MODE,
  sessionSampleRate: 100,
  trackUserInteractions: true,
});

setErrorReporter({
  captureException: (e, ctx) => datadogRum.addError(e, ctx?.metadata ?? {}),
  captureMessage: (m, ctx) =>
    datadogRum.addAction(m, ctx?.metadata ?? {}),
  setUser: (u) =>
    u ? datadogRum.setUser({ id: u.id, email: u.email }) : datadogRum.clearUser(),
});
```

## Wiring LogRocket

```ts
import LogRocket from 'logrocket';
import { setErrorReporter } from '@/lib/errorReporter';

LogRocket.init(import.meta.env.VITE_LOGROCKET_APP_ID);

setErrorReporter({
  captureException: (e, ctx) =>
    LogRocket.captureException(e, { extra: ctx as Record<string, unknown> }),
  captureMessage: (m, ctx) =>
    LogRocket.captureMessage(m, { extra: ctx as Record<string, unknown> }),
  setUser: (u) => (u ? LogRocket.identify(u.id, { email: u.email ?? '' }) : LogRocket.identify('')),
});
```

## API surface

```ts
// src/lib/errorReporter.ts

export type ErrorContext = {
  component?: string;            // logical surface, e.g. "ErrorBoundary"
  action?: string;               // what the user/system was doing
  userId?: string;               // authenticated user id, when known
  metadata?: Record<string, unknown>; // free-form extra context (no secrets)
};

export interface ErrorReporter {
  captureException(error: Error, context?: ErrorContext): void;
  captureMessage(message: string, context?: ErrorContext): void;
  setUser(user: { id: string; email?: string } | null): void;
}

setErrorReporter(reporter: ErrorReporter): void;
captureException(error: Error, context?: ErrorContext): void;
captureMessage(message: string, context?: ErrorContext): void;
setReportingUser(user: { id: string; email?: string } | null): void;
```

## Conventions for callers

- **Never** pass secrets, tokens, or full request bodies into `metadata`.
- **Prefer** `captureException(err, { component, action, metadata })` over
  `console.error` in any code path that runs in production. `console.error`
  is fine inside `if (import.meta.env.DEV)` for local-only diagnostics.
- **Don't** swallow an error then forward it — let it propagate, and let
  ErrorBoundary or the nearest async handler do the forwarding once.
- **Wrap** calls that you don't trust in `try { … } catch { /* never */ }`.
  Error reporting must never be the thing that crashes the app.

## Related files

- `src/lib/errorReporter.ts` — the abstraction itself.
- `src/lib/__tests__/errorReporter.test.ts` — vitest contract pinning.
- `src/components/ErrorBoundary.tsx` — primary caller.

## Production source maps + CI upload

A reporter SDK only gives readable stack traces if it can map minified
prod JS back to source. We generate maps at build time and (optionally)
upload them out-of-band so end users never see them.

### Vite config

`vite.config.ts` sets `build.sourcemap: 'hidden'`. That:

- emits `dist/assets/*.js.map` files alongside the JS
- does **not** inject `//# sourceMappingURL=…` into the shipped JS — so
  users can't grab the maps from the browser network panel
- leaves the maps available locally and to CI for upload to a monitor

`.gitignore` excludes `*.map` so maps never end up in the repo. The
already-existing `dist` rule covers them in the build output too — the
explicit `*.map` rule is belt-and-suspenders for any other tooling that
emits maps outside `dist/`.

### CI workflow: `.github/workflows/build-and-upload-maps.yml`

On every push to `main` (and via `workflow_dispatch`):

1. checkout + Node 20 + `npm ci`
2. `npm run build` (produces `dist/` with hidden maps)
3. verifies `.map` files were generated and that no `sourceMappingURL`
   comment leaked into shipped JS
4. **conditionally** uploads maps to Sentry — only if the
   `SENTRY_AUTH_TOKEN` repo secret is set. Otherwise it logs a
   skip-message and continues green.

The actual `npx @sentry/cli releases …` commands are commented out
until Sentry is wired (account, DSN, project name). To enable:

1. Operator creates a Sentry project named `vision-affichage`.
2. Operator generates a Sentry auth token with `project:releases` scope.
3. Operator adds two repo secrets in GitHub:
   - `SENTRY_AUTH_TOKEN` — the token from step 2
   - `SENTRY_ORG` — the Sentry org slug
4. Operator uncomments the three `npx @sentry/cli` lines in
   `.github/workflows/build-and-upload-maps.yml`.

No app-side code change is required — the `errorReporter` abstraction
already passes errors to whichever monitor is wired in `main.tsx`.

`@sentry/cli` is intentionally **not** added as a devDependency: `npx`
fetches it on demand in CI, so we don't pay the install cost for
contributors who don't run the upload step.

### Release notifications (Slack / Discord)

The workflow posts **three** tiers of notifications via the same
`RELEASE_WEBHOOK_URL` secret:

1. **🚀 Success** — after a successful source-map upload, posts a green
   attachment with commit SHA, branch, and a link to the Actions run.
   Gated on **both** `SENTRY_AUTH_TOKEN` and `RELEASE_WEBHOOK_URL` being
   set, plus job `success()`.
2. **🟡 Partial success** — build went green but `SENTRY_AUTH_TOKEN`
   was unset, so source maps were never uploaded. Posts a yellow
   `warning`-coloured attachment with commit SHA, branch, and a one-line
   reminder to wire `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` so production
   stack traces become symbolicated. Gated on `SENTRY_AUTH_TOKEN == ''`
   AND `RELEASE_WEBHOOK_URL != ''` — so operators who haven't yet wired
   any webhook get the quieter fallback below instead of nothing.
   Closes the silent-skip gap (build looked green, but symbolication
   was secretly off).
3. **🔴 Failure** — if any step in the job fails (Sentry upload, build,
   verify, etc.), posts a red attachment with commit SHA, branch, a
   one-click Investigate link to the run, and an impact statement
   noting that production stack traces will be unsymbolicated until
   the next successful run. Gated on `failure()` and
   `RELEASE_WEBHOOK_URL` being set — closes the silent-CI-red gap so
   a broken upload can't slip past the team unnoticed.

When **no** `RELEASE_WEBHOOK_URL` is configured at all and
`SENTRY_AUTH_TOKEN` is also unset, the workflow falls back to a quiet
`::warning::` annotation in the GitHub Actions UI rather than firing
any webhook traffic — operators who haven't wired anything don't get
spammed.

All three tiers share the **same** webhook secret — no second
secret needed.

Operator setup checklist:

1. In Slack: create an Incoming Webhook for the target channel
   (`Apps → Incoming Webhooks → Add to Slack → pick channel`). Copy the
   `https://hooks.slack.com/services/...` URL.
   - For Discord instead: in the target channel, `Edit Channel →
     Integrations → Webhooks → New Webhook → Copy Webhook URL`. Discord
     accepts the same Slack-compatible payload as long as you append
     `/slack` to the URL (e.g. `.../webhooks/<id>/<token>/slack`).
2. Add a repo secret in GitHub:
   - `RELEASE_WEBHOOK_URL` — the webhook URL from step 1.
3. Push to `main` (or trigger via `workflow_dispatch`). On success the
   workflow posts a green message; on any step failure it posts a red
   message instead.

To disable temporarily, delete the `RELEASE_WEBHOOK_URL` secret — both
notification steps will skip and the workflow will stay green (or red,
based on actual job outcome) without posting.
