import '@testing-library/jest-dom/vitest';

if (typeof window !== 'undefined' && !('ResizeObserver' in window)) {
  class ResizeObserverMock {
    observe() {/* noop */}
    unobserve() {/* noop */}
    disconnect() {/* noop */}
  }
  // @ts-expect-error test shim
  window.ResizeObserver = ResizeObserverMock;
}
