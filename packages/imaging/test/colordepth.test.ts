import { describe, it, expect } from "vitest";
import {
  reduceColor,
  reduceColorDepth,
  reducePalette,
  extraHalfBrite,
} from "../src/colordepth.js";
import type { ColorArray } from "@dpaint/util";

describe("reduceColor", () => {
  it("is a no-op at full 8-bit depth", () => {
    expect(reduceColor([12, 34, 56], 8)).toEqual([12, 34, 56]);
  });
  it("snaps white/black at 12-bit and 9-bit (Atari 9-bit white expands to 238)", () => {
    expect(reduceColor([255, 255, 255], 4)).toEqual([255, 255, 255]);
    expect(reduceColor([0, 0, 0], 4)).toEqual([0, 0, 0]);
    // 9-bit: top value 7 expands via (7<<5)+(7<<1) = 238
    expect(reduceColor([255, 255, 255], 3)).toEqual([238, 238, 238]);
  });
  it("quantizes to a coarser grid at 12-bit (16 levels per channel)", () => {
    // 12-bit: r4 = r>>4, expanded = (r4<<4)|r4
    expect(reduceColor([200, 0, 0], 4)).toEqual([(12 << 4) | 12, 0, 0]);
  });
});

describe("reduceColorDepth", () => {
  it("reduces every pixel and preserves alpha", () => {
    const rgba = new Uint8ClampedArray([200, 0, 0, 128, 0, 0, 0, 255]);
    const out = reduceColorDepth(rgba, 4);
    expect(out[0]).toBe((12 << 4) | 12);
    expect(out[3]).toBe(128); // alpha preserved
  });
});

describe("reducePalette", () => {
  it("reduces all palette entries", () => {
    const pal: ColorArray[] = [
      [255, 255, 255],
      [200, 100, 50],
    ];
    const out = reducePalette(pal, 4);
    expect(out[0]).toEqual([255, 255, 255]);
    expect(out).toHaveLength(2);
  });
});

describe("extraHalfBrite", () => {
  it("extends 32 colours to 64 with half-bright copies", () => {
    const pal: ColorArray[] = Array.from({ length: 32 }, (_, i) => [i * 8, 0, 0]);
    const out = extraHalfBrite(pal);
    expect(out).toHaveLength(64);
    expect(out[32]).toEqual([0, 0, 0]);
    expect(out[33]).toEqual([(8 >> 1), 0, 0]);
    expect(out[63]).toEqual([(31 * 8) >> 1, 0, 0]);
  });
});
