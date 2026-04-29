import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  captureException,
  captureMessage,
  setErrorReporter,
  setReportingUser,
  type ErrorReporter,
} from '../errorReporter';

// errorReporter is the central choke point all the rest of the app
// uses to forward exceptions to whichever monitor the operator wired
// (Sentry / Datadog / LogRocket / ...). The default impl is a noop so
// the bundle stays lean; these tests pin the contract that lets a
// future operator drop in a real impl without changing call sites.

describe('errorReporter', () => {
  // Reset to a fresh noop-style impl after every test so swaps in one
  // test never leak into the next. We rebuild a vi.fn-backed reporter
  // each time to keep call counts isolated.
  let lastImpl: ErrorReporter;

  const makeRecorder = (): ErrorReporter => ({
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    setUser: vi.fn(),
  });

  beforeEach(() => {
    lastImpl = makeRecorder();
  });

  afterEach(() => {
    // Restore a clean recorder to avoid bleed-over.
    setErrorReporter(makeRecorder());
  });

  it('default noopReporter does not throw when called before any setup', () => {
    // Pre-setErrorReporter is the boot-time path: a render-time error
    // that happens before main.tsx wires Sentry must still be safe to
    // forward. `expect(...).not.toThrow()` pins that invariant.
    expect(() => captureException(new Error('boom'))).not.toThrow();
    expect(() => captureMessage('hello')).not.toThrow();
    expect(() => setReportingUser({ id: 'u1' })).not.toThrow();
    expect(() => setReportingUser(null)).not.toThrow();
  });

  it('setErrorReporter swaps the active implementation', () => {
    const first = makeRecorder();
    const second = makeRecorder();

    setErrorReporter(first);
    captureException(new Error('first-call'));
    expect(first.captureException).toHaveBeenCalledTimes(1);
    expect(second.captureException).not.toHaveBeenCalled();

    // Swap — subsequent calls should land on `second`, never on `first`.
    setErrorReporter(second);
    captureException(new Error('second-call'));
    expect(first.captureException).toHaveBeenCalledTimes(1);
    expect(second.captureException).toHaveBeenCalledTimes(1);
  });

  it('captureException forwards both error and context to the active reporter', () => {
    setErrorReporter(lastImpl);
    const err = new Error('checkout-failed');
    const ctx = {
      component: 'Checkout',
      action: 'submit-order',
      metadata: { cartId: 'gid://shopify/Cart/abc' },
    };

    captureException(err, ctx);

    expect(lastImpl.captureException).toHaveBeenCalledTimes(1);
    expect(lastImpl.captureException).toHaveBeenCalledWith(err, ctx);
  });

  it('setReportingUser passes user identity (or null on logout) through to setUser', () => {
    setErrorReporter(lastImpl);

    setReportingUser({ id: 'u-42', email: 'op@vision.example' });
    expect(lastImpl.setUser).toHaveBeenCalledWith({ id: 'u-42', email: 'op@vision.example' });

    setReportingUser(null);
    expect(lastImpl.setUser).toHaveBeenLastCalledWith(null);
    expect(lastImpl.setUser).toHaveBeenCalledTimes(2);
  });
});
