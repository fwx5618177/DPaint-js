import { describe, it, expect } from "vitest";
import { rotateArbitrary, stackBlur } from "../src/rotate.js";

function solid(w: number, h: number, color: number[]) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = color[0]!;
    out[i + 1] = color[1]!;
    out[i + 2] = color[2]!;
    out[i + 3] = 255;
  }
  return out;
}

describe("rotateArbitrary", () => {
  it("is (near) identity at 0 degrees", () => {
    const src = solid(4, 4, [10, 20, 30]);
    const r = rotateArbitrary(src, 4, 4, 0);
    expect(r.width).toBe(4);
    expect(r.height).toBe(4);
    expect([r.data[0], r.data[1], r.data[2], r.data[3]]).toEqual([10, 20, 30, 255]);
  });

  it("expands the canvas for a 45° rotation", () => {
    const r = rotateArbitrary(solid(10, 10, [1, 2, 3]), 10, 10, 45);
    expect(r.width).toBeGreaterThan(10);
    expect(r.height).toBeGreaterThan(10);
  });

  it("90° rotation swaps dimensions", () => {
    const r = rotateArbitrary(solid(6, 4, [9, 9, 9]), 6, 4, 90);
    expect(r.width).toBe(4);
    expect(r.height).toBe(6);
  });

  it("is deterministic", () => {
    const src = solid(8, 8, [4, 5, 6]);
    expect(Array.from(rotateArbitrary(src, 8, 8, 30).data)).toEqual(
      Array.from(rotateArbitrary(src, 8, 8, 30).data),
    );
  });
});

describe("stackBlur", () => {
  it("returns a copy for radius < 1", () => {
    const src = solid(3, 3, [50, 60, 70]);
    expect(Array.from(stackBlur(src, 3, 3, 0))).toEqual(Array.from(src));
  });
  it("leaves a uniform image unchanged", () => {
    const src = solid(5, 5, [80, 80, 80]);
    const out = stackBlur(src, 5, 5, 2);
    expect(out.every((v, i) => (i % 4 === 3 ? v === 255 : v === 80))).toBe(true);
  });
  it("smooths a hard edge", () => {
    // left half black, right half white (4 wide) -> middle becomes grey
    const w = 4, h = 1;
    const src = new Uint8ClampedArray([
      0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    ]);
    const out = stackBlur(src, w, h, 1);
    expect(out[4]).toBeGreaterThan(0); // pixel 1 picks up some white
    expect(out[8]).toBeLessThan(255); // pixel 2 picks up some black
  });
});
