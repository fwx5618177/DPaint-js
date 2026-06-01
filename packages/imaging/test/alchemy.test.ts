import { describe, it, expect } from "vitest";
import { offset, medianFilter, sharpen } from "../src/alchemy.js";

function img(width: number, height: number, fn: (x: number, y: number) => number[]) {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fn(x, y);
      const o = (y * width + x) * 4;
      out[o] = r!;
      out[o + 1] = g!;
      out[o + 2] = b!;
      out[o + 3] = a ?? 255;
    }
  }
  return out;
}

const at = (d: Uint8ClampedArray, x: number, y: number, w: number) => {
  const o = (y * w + x) * 4;
  return [d[o], d[o + 1], d[o + 2], d[o + 3]];
};

describe("offset", () => {
  it("shifts pixels with wrap-around", () => {
    // 2×1: pixel0 red, pixel1 green; offset by dx=1 → they swap
    const src = img(2, 1, (x) => (x === 0 ? [255, 0, 0] : [0, 255, 0]));
    const out = offset(src, 2, 1, 1, 0);
    expect(at(out, 0, 0, 2)).toEqual([0, 255, 0, 255]);
    expect(at(out, 1, 0, 2)).toEqual([255, 0, 0, 255]);
  });

  it("is the identity for a full-width offset", () => {
    const src = img(3, 1, (x) => [x * 10, 0, 0]);
    expect(Array.from(offset(src, 3, 1, 3, 0))).toEqual(Array.from(src));
  });
});

describe("medianFilter", () => {
  it("removes a single-pixel outlier (salt noise)", () => {
    // 3×3 black field with one white centre → median is black
    const src = img(3, 3, (x, y) => (x === 1 && y === 1 ? [255, 255, 255] : [0, 0, 0]));
    const out = medianFilter(src, 3, 3, 1);
    expect(at(out, 1, 1, 3)).toEqual([0, 0, 0, 255]);
  });

  it("leaves a uniform image unchanged", () => {
    const src = img(3, 3, () => [40, 50, 60]);
    expect(Array.from(medianFilter(src, 3, 3, 1))).toEqual(Array.from(src));
  });
});

describe("sharpen", () => {
  it("preserves a flat image and alpha", () => {
    const src = img(3, 3, () => [80, 80, 80, 200]);
    const out = sharpen(src, 3, 3);
    expect(at(out, 1, 1, 3)).toEqual([80, 80, 80, 200]);
  });
});
