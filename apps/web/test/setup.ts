import "@testing-library/jest-dom/vitest";

// jsdom does not implement canvas rendering. The drawing model is unit-tested
// directly and component tests only assert on DOM/state, so we stub the 2D
// context to a no-op null to avoid jsdom's "not implemented" noise.
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
