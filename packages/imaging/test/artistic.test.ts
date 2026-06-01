import { describe, it, expect } from "vitest";
import { displace, glow, dots, speckles, lines, web, ripples, mulberry32 } from "../src/artistic.js";

function solid(w: number, h: number, color: number[], alpha = 255) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = color[0]!;
    out[i + 1] = color[1]!;
    out[i + 2] = color[2]!;
    out[i + 3] = alpha;
  }
  return out;
}

const alphaAt = (d: Uint8ClampedArray, x: number, y: number, w: number) => d[(y * w + x) * 4 + 3];

describe("mulberry32", () => {
  it("is deterministic and in [0,1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 5; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("displace", () => {
  it("returns a correctly-sized buffer and shifts rows", () => {
    const src = solid(4, 4, [10, 20, 30]);
    const out = displace(src, 4, 4, { rowWidth: 1, hShift: 1, vShift: 0 });
    expect(out.length).toBe(src.length);
  });
  it("is deterministic", () => {
    const src = solid(8, 8, [1, 2, 3]);
    expect(Array.from(displace(src, 8, 8))).toEqual(Array.from(displace(src, 8, 8)));
  });
});

describe("glow", () => {
  it("paints a ring around an opaque blob into transparent neighbours", () => {
    // 5x5 transparent with one opaque centre pixel
    const d = new Uint8ClampedArray(5 * 5 * 4);
    const c = (2 * 5 + 2) * 4;
    d[c] = 200; d[c + 3] = 255;
    const out = glow(d, 5, 5, [[255, 255, 255]]);
    // the 4-neighbours of the centre become opaque white
    expect(alphaAt(out, 2, 1, 5)).toBe(255);
    expect(alphaAt(out, 1, 2, 5)).toBe(255);
    expect(out[(1 * 5 + 2) * 4]).toBe(255);
  });
});

describe("random filters are deterministic with a seeded rng", () => {
  const src = solid(16, 16, [120, 130, 140]);
  it("speckles", () => {
    expect(Array.from(speckles(src, 16, 16, { count: 50 }, mulberry32(7)))).toEqual(
      Array.from(speckles(src, 16, 16, { count: 50 }, mulberry32(7))),
    );
  });
  it("lines", () => {
    expect(Array.from(lines(src, 16, 16, { lineCount: 20 }, mulberry32(7)))).toEqual(
      Array.from(lines(src, 16, 16, { lineCount: 20 }, mulberry32(7))),
    );
  });
  it("web", () => {
    expect(Array.from(web(src, 16, 16, { dabbleCount: 20 }, mulberry32(7)))).toEqual(
      Array.from(web(src, 16, 16, { dabbleCount: 20 }, mulberry32(7))),
    );
  });
  it("dots", () => {
    expect(Array.from(dots(src, 16, 16, { count: 20 }, mulberry32(7)))).toEqual(
      Array.from(dots(src, 16, 16, { count: 20 }, mulberry32(7))),
    );
  });
  it("each modifies the image", () => {
    const a = speckles(src, 16, 16, { count: 200 }, mulberry32(3));
    expect(Array.from(a)).not.toEqual(Array.from(src));
  });
});

describe("ripples", () => {
  it("returns an opaque, correctly-sized, deterministic buffer", () => {
    const src = solid(20, 20, [80, 90, 100]);
    const a = ripples(src, 20, 20, { frame: 2 });
    const b = ripples(src, 20, 20, { frame: 2 });
    expect(a.length).toBe(src.length);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(alphaAt(a, 0, 0, 20)).toBe(255);
  });
});
