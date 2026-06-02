import { describe, it, expect } from "vitest";
import { rotateRegion, flipRegion } from "../src/brush";
import type { PixelRegion } from "../src/ImageDocument";

/** Build a 2×1 region: pixel 0 red, pixel 1 green. */
function region(): PixelRegion {
  const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
  return { width: 2, height: 1, data };
}

describe("brush region transforms", () => {
  it("rotates 90° swapping dimensions", () => {
    const r = rotateRegion(region(), false);
    expect(r.width).toBe(1);
    expect(r.height).toBe(2);
    // the two pixels are preserved (red + green somewhere)
    const colors = new Set<string>();
    for (let i = 0; i < r.data.length; i += 4) {
      colors.add(`${r.data[i]},${r.data[i + 1]},${r.data[i + 2]}`);
    }
    expect(colors.has("255,0,0")).toBe(true);
    expect(colors.has("0,255,0")).toBe(true);
  });

  it("rotating left then right is identity in size", () => {
    const r = rotateRegion(rotateRegion(region(), true), false);
    expect(r.width).toBe(2);
    expect(r.height).toBe(1);
  });

  it("flips horizontally, swapping the two pixels", () => {
    const r = flipRegion(region(), true);
    expect([r.data[0], r.data[1], r.data[2]]).toEqual([0, 255, 0]);
    expect([r.data[4], r.data[5], r.data[6]]).toEqual([255, 0, 0]);
  });

  it("flips vertically (no-op for a single row, dimensions kept)", () => {
    const r = flipRegion(region(), false);
    expect(r.width).toBe(2);
    expect(r.height).toBe(1);
  });
});
