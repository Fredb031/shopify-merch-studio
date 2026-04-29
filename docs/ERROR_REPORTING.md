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
