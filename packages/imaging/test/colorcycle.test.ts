import { describe, it, expect } from "vitest";
import { cyclePalette, type ColorRange } from "../src/colorcycle.js";
import type { ColorArray } from "@dpaint/util";

const PALETTE: ColorArray[] = [
  [0, 0, 0], // A
  [1, 1, 1], // B
  [2, 2, 2], // C
  [3, 3, 3], // D
];

const names = (p: ColorArray[]) => p.map((c) => c[0]);

describe("cyclePalette", () => {
  const full: ColorRange[] = [{ low: 0, high: 3 }];

  it("forward step of 1 rotates colours toward high (wrapping)", () => {
    expect(names(cyclePalette(PALETTE, full, 1))).toEqual([3, 0, 1, 2]);
  });

  it("reverse step of 1 rotates the other way", () => {
    expect(names(cyclePalette(PALETTE, [{ low: 0, high: 3, reverse: true }], 1))).toEqual([
      1, 2, 3, 0,
    ]);
  });

  it("a full-length step is the identity", () => {
    expect(names(cyclePalette(PALETTE, full, 4))).toEqual([0, 1, 2, 3]);
    expect(names(cyclePalette(PALETTE, full, 0))).toEqual([0, 1, 2, 3]);
  });

  it("only rotates within the given range", () => {
    // rotate only indices 1..2
    expect(names(cyclePalette(PALETTE, [{ low: 1, high: 2 }], 1))).toEqual([0, 2, 1, 3]);
  });

  it("skips inactive or length<=1 ranges", () => {
    expect(names(cyclePalette(PALETTE, [{ low: 0, high: 3, active: false }], 1))).toEqual([
      0, 1, 2, 3,
    ]);
    expect(names(cyclePalette(PALETTE, [{ low: 2, high: 2 }], 1))).toEqual([0, 1, 2, 3]);
  });

  it("returns a deep copy (does not mutate the input palette)", () => {
    const out = cyclePalette(PALETTE, full, 1);
    out[0]![0] = 99;
    expect(PALETTE[0]![0]).toBe(0);
  });

  it("clamps ranges to the palette bounds", () => {
    expect(() => cyclePalette(PALETTE, [{ low: -5, high: 99 }], 2)).not.toThrow();
    expect(names(cyclePalette(PALETTE, [{ low: -5, high: 99 }], 2))).toEqual([2, 3, 0, 1]);
  });
});
