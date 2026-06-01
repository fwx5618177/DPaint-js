import { describe, it, expect } from "vitest";
import { bitplaneImages } from "../src/bitplanes.js";
import type { ColorArray } from "@dpaint/primitives";

function px(...colors: number[][]) {
  const out = new Uint8ClampedArray(colors.length * 4);
  colors.forEach((c, i) => {
    out[i * 4] = c[0]!; out[i * 4 + 1] = c[1]!; out[i * 4 + 2] = c[2]!; out[i * 4 + 3] = 255;
  });
  return out;
}

describe("bitplaneImages", () => {
  it("produces one plane for a 2-colour palette", () => {
    const palette: ColorArray[] = [[0, 0, 0], [255, 255, 255]];
    const planes = bitplaneImages(px([0, 0, 0], [255, 255, 255]), 2, 1, palette);
    expect(planes).toHaveLength(1);
    // index 0 -> black, index 1 -> white
    expect(planes[0]![0]).toBe(0);
    expect(planes[0]![4]).toBe(255);
  });

  it("produces N planes for a 2^N palette", () => {
    const palette: ColorArray[] = Array.from({ length: 8 }, (_, i) => [i, i, i]);
    const planes = bitplaneImages(px([0, 0, 0]), 1, 1, palette);
    expect(planes).toHaveLength(3);
  });
});
