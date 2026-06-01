import { describe, it, expect } from "vitest";
import {
  nearestColorIndex,
  quantizeToPalette,
  medianCut,
  buildPaletteFromImage,
} from "../src/quantize.js";
import type { ColorArray } from "@dpaint/primitives";

const PALETTE: ColorArray[] = [
  [0, 0, 0],
  [255, 255, 255],
  [255, 0, 0],
  [0, 255, 0],
];

function rgba(...colors: number[][]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(colors.length * 4);
  colors.forEach((c, i) => {
    out[i * 4] = c[0]!;
    out[i * 4 + 1] = c[1]!;
    out[i * 4 + 2] = c[2]!;
    out[i * 4 + 3] = c[3] ?? 255;
  });
  return out;
}

describe("nearestColorIndex", () => {
  it("finds an exact match", () => {
    expect(nearestColorIndex([255, 0, 0], PALETTE)).toBe(2);
    expect(nearestColorIndex([0, 0, 0], PALETTE)).toBe(0);
  });
  it("finds the closest approximate colour", () => {
    expect(nearestColorIndex([250, 5, 5], PALETTE)).toBe(2);
    expect(nearestColorIndex([200, 200, 200], PALETTE)).toBe(1);
  });
});

describe("quantizeToPalette", () => {
  it("maps each pixel to a palette index", () => {
    const indices = quantizeToPalette(rgba([0, 0, 0], [255, 255, 255], [255, 0, 0]), PALETTE);
    expect(Array.from(indices)).toEqual([0, 1, 2]);
  });
});

describe("medianCut", () => {
  it("returns the exact colours when count matches distinct colours", () => {
    const img = rgba([10, 20, 30], [200, 100, 50]);
    const palette = medianCut(img, 2);
    expect(palette).toHaveLength(2);
    // each box holds a single colour, so the average equals that colour
    const set = palette.map((c) => c.join(","));
    expect(set).toContain("10,20,30");
    expect(set).toContain("200,100,50");
  });

  it("reduces many colours down to the requested count", () => {
    const colors = Array.from({ length: 32 }, (_, i) => [i * 8, 0, 0]);
    const palette = medianCut(rgba(...colors), 4);
    expect(palette).toHaveLength(4);
  });

  it("ignores fully transparent pixels", () => {
    const img = rgba([10, 20, 30, 0], [200, 100, 50, 255]);
    const palette = medianCut(img, 2);
    expect(palette.map((c) => c.join(","))).toContain("200,100,50");
  });

  it("handles an all-transparent image", () => {
    const palette = medianCut(rgba([1, 2, 3, 0]), 4);
    expect(palette).toEqual([[0, 0, 0]]);
  });
});

describe("buildPaletteFromImage", () => {
  it("returns distinct colours when they fit", () => {
    const palette = buildPaletteFromImage(rgba([1, 1, 1], [2, 2, 2], [1, 1, 1]), 16);
    expect(palette).toHaveLength(2);
  });
  it("falls back to median cut when over the limit", () => {
    const colors = Array.from({ length: 20 }, (_, i) => [i, i, i]);
    const palette = buildPaletteFromImage(rgba(...colors), 8);
    expect(palette).toHaveLength(8);
  });
});
