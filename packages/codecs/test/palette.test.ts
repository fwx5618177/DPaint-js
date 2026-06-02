import { describe, it, expect } from "vitest";
import {
  encodeACT,
  decodeACT,
  encodeJASC,
  decodeJASC,
  decodePaletteFile,
} from "../src/palette.js";

describe("palette files", () => {
  it("round-trips an Adobe Color Table (.act)", () => {
    const pal: [number, number, number][] = [
      [10, 20, 30],
      [40, 50, 60],
      [255, 255, 255],
    ];
    const bytes = encodeACT(pal);
    expect(bytes.length).toBe(768);
    const back = decodeACT(bytes);
    expect(back.slice(0, 3)).toEqual(pal);
  });

  it("round-trips a JASC-PAL palette", () => {
    const pal: [number, number, number][] = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    const bytes = encodeJASC(pal);
    const text = new TextDecoder().decode(bytes);
    expect(text.startsWith("JASC-PAL")).toBe(true);
    expect(decodeJASC(bytes)).toEqual(pal);
  });

  it("auto-detects JASC text vs ACT binary", () => {
    const jasc = encodeJASC([[7, 8, 9]]);
    expect(decodePaletteFile(jasc, "x.pal")).toEqual([[7, 8, 9]]);
    const act = encodeACT([[11, 12, 13]]);
    expect(decodePaletteFile(act, "x.act")[0]).toEqual([11, 12, 13]);
  });
});
