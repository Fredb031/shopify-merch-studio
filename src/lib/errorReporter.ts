/**
 * Thin error-reporting abstraction.
 *
 * Why this exists
 * ---------------
 * The app's ErrorBoundary used to call `console.error` directly inside
 * `componentDidCatch`. That's fine in dev but useless in production —
 * an exception that brings down the tree should reach a real monitor
 * (Sentry, Datadog, LogRocket, ...). We don't ship an SDK by default
 * because every production-grade error monitor adds 50KB+ to the bundle
 * and is a paid-account decision the operator should make explicitly.
 *
 * The abstraction is the deliverable: any module that wants to forward
 * an exception calls `captureException(err, ctx)` from this file. At
 * app boot, the operator wires their chosen monitor by handing a real
 * `ErrorReporter` impl to `setErrorReporter()`. Until they do, the
 * default noop reporter only logs in DEV.
 *
 * See `docs/ERROR_REPORTING.md` for wire-up recipes.
 */

export type ErrorContext = {
  /** Logical surface the error happened in (e.g. "ErrorBoundary", "CartCheckout"). */
  component?: string;
  /** What the user / system was attempting (e.g. "submit-quote", "load-pdp"). */
  action?: string;
  /** Authenticated user id, when known. Stays out of the body for PII reasons. */
  userId?: string;
  /** Free-form structured context. Don't put secrets in here. */
  metadata?: Record<string, unknown>;
};

export interface ErrorReporter {
  captureException(error: Error, context?: ErrorContext): void;
  captureMessage(message: string, context?: ErrorContext): void;
  setUser(user: { id: string; email?: string } | null): void;
}

// Default impl: no network, no SDK, just a DEV-gated console echo.
// Importantly the noop never throws — error reporting must never be
// the thing that crashes the app.
const noopReporter: ErrorReporter = {
  captureException(error, context) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[errorReporter]', error, context);
    }
  },
  captureMessage(message, context) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[errorReporter]', message, context);
    }
  },
  setUser() {
    /* noop */
  },
};

let activeReporter: ErrorReporter = noopReporter;

/**
 * Swap the active reporter. Call once at app boot after initialising
 * your monitor of choice (Sentry.init, datadogRum.init, ...). Calling
 * again replaces the previous impl — useful in tests.
 */
export function setErrorReporter(reporter: ErrorReporter) {
  activeReporter = reporter;
}

/** Forward an exception to whatever reporter is currently active. */
export function captureException(error: Error, context?: ErrorContext) {
  activeReporter.captureException(error, context);
}

/** Forward a non-Error message (e.g. "checkout retried 3x") to the active reporter. */
export function captureMessage(message: string, context?: ErrorContext) {
  activeReporter.captureMessage(message, context);
}

/** Identify the current user on the active reporter, or clear (`null`) on logout. */
export function setReportingUser(user: { id: string; email?: string } | null) {
  activeReporter.setUser(user);
}
