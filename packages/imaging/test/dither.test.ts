import { describe, it, expect } from "vitest";
import { orderedDither, floydSteinberg, indicesToRGBA } from "../src/dither.js";
import type { ColorArray } from "@dpaint/util";

const BW: ColorArray[] = [
  [0, 0, 0],
  [255, 255, 255],
];

function solid(width: number, height: number, color: number[]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = color[0]!;
    out[i + 1] = color[1]!;
    out[i + 2] = color[2]!;
    out[i + 3] = 255;
  }
  return out;
}

describe("orderedDither", () => {
  it("is deterministic", () => {
    const img = solid(8, 8, [128, 128, 128]);
    const a = orderedDither(img, 8, 8, BW);
    const b = orderedDither(img, 8, 8, BW);
    expect(Array.from(a.indices)).toEqual(Array.from(b.indices));
  });

  it("produces a mix of both palette entries on a mid-grey field", () => {
    const img = solid(4, 4, [128, 128, 128]);
    const { indices } = orderedDither(img, 4, 4, BW, 200);
    const set = new Set(indices);
    expect(set.has(0)).toBe(true);
    expect(set.has(1)).toBe(true);
  });

  it("only emits valid palette indices", () => {
    const img = solid(4, 4, [200, 50, 90]);
    const { indices } = orderedDither(img, 4, 4, BW);
    expect(indices.every((i) => i === 0 || i === 1)).toBe(true);
  });
});

describe("floydSteinberg", () => {
  it("is deterministic", () => {
    const img = solid(8, 8, [100, 100, 100]);
    const a = floydSteinberg(img, 8, 8, BW);
    const b = floydSteinberg(img, 8, 8, BW);
    expect(Array.from(a.indices)).toEqual(Array.from(b.indices));
  });

  it("maps a pure palette colour to itself", () => {
    const img = solid(4, 4, [0, 0, 0]);
    const { indices } = floydSteinberg(img, 4, 4, BW);
    expect(indices.every((i) => i === 0)).toBe(true);
  });

  it("approximates mid-grey with a balanced black/white mix", () => {
    const img = solid(10, 10, [128, 128, 128]);
    const { indices } = floydSteinberg(img, 10, 10, BW);
    const white = indices.reduce((n, i) => n + (i === 1 ? 1 : 0), 0);
    const ratio = white / indices.length;
    expect(ratio).toBeGreaterThan(0.3);
    expect(ratio).toBeLessThan(0.7);
  });
});

describe("indicesToRGBA", () => {
  it("expands indices back to opaque RGBA", () => {
    const rgba = indicesToRGBA(new Uint8Array([0, 1]), BW);
    expect(Array.from(rgba)).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
  });
});
