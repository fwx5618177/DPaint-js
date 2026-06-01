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

// jsdom's Blob/File do not implement async text(); polyfill via FileReader so
// save/load flows work in tests (real browsers provide this natively).
if (!Blob.prototype.text) {
  Blob.prototype.text = function (this: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}
if (!Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function (this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

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
