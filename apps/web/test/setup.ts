import "@testing-library/jest-dom/vitest";

// jsdom does not implement canvas rendering. The drawing model is unit-tested
// directly and component tests only assert on DOM/state, so we stub the 2D
// context to a no-op null to avoid jsdom's "not implemented" noise.
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// jsdom's Pointer Capture API throws "Not implemented"; stub to no-ops so the
// pointer interaction handlers run to completion.
Element.prototype.setPointerCapture = () => {};
Element.prototype.releasePointerCapture = () => {};
Element.prototype.hasPointerCapture = () => false;

// jsdom does not implement PointerEvent. Without it, dispatched pointer events
// drop clientX/clientY. Polyfill it as a MouseEvent subclass so coordinate data
// flows through to the React handlers.
if (typeof (globalThis as { PointerEvent?: unknown }).PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
    }
  }
  (globalThis as { PointerEvent?: unknown }).PointerEvent =
    PointerEventPolyfill as unknown as typeof PointerEvent;
}
