import "@testing-library/jest-dom";

// jsdom — the environment vitest runs in — ships a minimal DOM but
// deliberately omits a handful of browser APIs that components in this
// codebase touch during render (IntroAnimation reads matchMedia for
// reduced-motion, CountUp/StepsTimeline observe viewport entry through
// IntersectionObserver, the customizer canvas listens for ResizeObserver
// callbacks). Without these globals stubbed, the very first render in a
// component test throws ReferenceError before the assertion can run.
//
// The stubs intentionally return inert values: matches:false so motion
// components render their final state synchronously, and observer
// constructors that no-op so effects mount without crashing. Tests that
// need to drive these APIs can replace the stub with vi.fn() per-suite.

Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    // dispatchEvent must return boolean per the EventTarget contract;
    // returning undefined silently breaks consumers that branch on it.
    dispatchEvent: () => true,
  }),
});

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

class MockResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  configurable: true,
  value: MockResizeObserver,
});
