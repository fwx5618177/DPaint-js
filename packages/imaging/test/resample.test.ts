import { describe, it, expect } from "vitest";
import { bicubicResize, areaDownscale, resample, matte } from "../src/resample.js";

function solid(w: number, h: number, color: number[]) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = color[0]!;
    out[i + 1] = color[1]!;
    out[i + 2] = color[2]!;
    out[i + 3] = color[3] ?? 255;
  }
  return out;
}

describe("bicubicResize", () => {
  it("produces the right size and preserves a uniform colour", () => {
    const src = solid(4, 4, [100, 120, 140]);
    const out = bicubicResize(src, 4, 4, 8, 8);
    expect(out.length).toBe(8 * 8 * 4);
    expect([out[0], out[1], out[2]]).toEqual([100, 120, 140]);
    expect([out[out.length - 4], out[out.length - 3], out[out.length - 2]]).toEqual([100, 120, 140]);
  });
  it("is deterministic", () => {
    const src = solid(3, 3, [10, 20, 30]);
    expect(Array.from(bicubicResize(src, 3, 3, 6, 6))).toEqual(Array.from(bicubicResize(src, 3, 3, 6, 6)));
  });
});

describe("areaDownscale", () => {
  it("averages a 2x2 block into one pixel", () => {
    // 2x2 with values 0,100,100,200 -> average 100
    const src = new Uint8ClampedArray([
      0, 0, 0, 255, 100, 100, 100, 255,
      100, 100, 100, 255, 200, 200, 200, 255,
    ]);
    const out = areaDownscale(src, 2, 2, 1, 1);
    expect([out[0], out[1], out[2], out[3]]).toEqual([100, 100, 100, 255]);
  });
});

describe("resample", () => {
  it("uses area-average when shrinking, bicubic when growing", () => {
    const src = solid(4, 4, [50, 60, 70]);
    expect(resample(src, 4, 4, 2, 2).length).toBe(2 * 2 * 4);
    expect(resample(src, 4, 4, 8, 8).length).toBe(8 * 8 * 4);
  });
});

describe("matte", () => {
  it("fills transparent pixels with the neighbour-average colour", () => {
    // centre transparent, surrounded by red
    const w = 3, h = 3;
    const src = solid(w, h, [200, 0, 0]);
    const c = (1 * w + 1) * 4;
    src[c] = 0; src[c + 1] = 0; src[c + 2] = 0; src[c + 3] = 0; // transparent black hole
    const out = matte(src, w, h);
    // colour filled from red neighbours, alpha stays 0
    expect(out[c]).toBe(200);
    expect(out[c + 3]).toBe(0);
  });
});
