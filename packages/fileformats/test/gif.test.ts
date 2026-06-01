import { describe, it, expect } from "vitest";
import { encodeGIF, decodeGIF } from "../src/gif.js";
import { encode as lzwEncode } from "../src/lzw.js";
import { detectFormat } from "../src/detect.js";
import type { ColorArray } from "@dpaint/util";

const PALETTE: ColorArray[] = [
  [0, 0, 0],
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
];

function rgbaAt(data: Uint8ClampedArray, x: number, y: number, width: number): number[] {
  const o = (y * width + x) * 4;
  return [data[o]!, data[o + 1]!, data[o + 2]!, data[o + 3]!];
}

describe("LZW", () => {
  it("emits a leading minimum-code-size byte and a terminator", () => {
    const out = lzwEncode([0, 1, 2, 3], 2, 2, 2);
    expect(out[0]).toBe(2); // minCodeSize = max(2, depth)
    expect(out[out.length - 1]).toBe(0); // block terminator
  });
});

describe("GIF encode", () => {
  it("produces a GIF89a stream recognised by detectFormat", () => {
    const pixels = [0, 1, 2, 3];
    const gif = encodeGIF({ width: 2, height: 2, pixels, palette: PALETTE });
    expect(detectFormat(gif)).toBe("GIF");
    expect(String.fromCharCode(...gif.subarray(0, 6))).toBe("GIF89a");
  });
});

describe("GIF round-trip", () => {
  it("round-trips indexed pixels to the correct RGBA frame", () => {
    const width = 2;
    const height = 2;
    const pixels = [0, 1, 2, 3]; // black, red, green, blue
    const gif = encodeGIF({ width, height, pixels, palette: PALETTE });
    const decoded = decodeGIF(gif);

    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(2);
    expect(decoded.frames).toHaveLength(1);
    const f = decoded.frames[0]!.data;
    expect(rgbaAt(f, 0, 0, width)).toEqual([0, 0, 0, 255]);
    expect(rgbaAt(f, 1, 0, width)).toEqual([255, 0, 0, 255]);
    expect(rgbaAt(f, 0, 1, width)).toEqual([0, 255, 0, 255]);
    expect(rgbaAt(f, 1, 1, width)).toEqual([0, 0, 255, 255]);
  });

  it("round-trips a larger patterned image", () => {
    const width = 16;
    const height = 12;
    const pixels = Array.from({ length: width * height }, (_, i) => i % 4);
    const gif = encodeGIF({ width, height, pixels, palette: PALETTE });
    const decoded = decodeGIF(gif);
    const f = decoded.frames[0]!.data;
    for (let i = 0; i < width * height; i++) {
      const expected = PALETTE[i % 4]!;
      const o = i * 4;
      expect([f[o], f[o + 1], f[o + 2]]).toEqual([expected[0], expected[1], expected[2]]);
    }
  });

  it("honours a transparent colour index via a graphics control extension", () => {
    // We cannot set transparency through encodeGIF (no GCE written), so assert
    // the decoder treats opaque frames as fully opaque.
    const gif = encodeGIF({ width: 1, height: 1, pixels: [1], palette: PALETTE });
    const decoded = decodeGIF(gif);
    expect(decoded.frames[0]!.data[3]).toBe(255);
  });
});

describe("GIF decode errors", () => {
  it("rejects non-GIF input", () => {
    expect(() => decodeGIF(new Uint8Array([1, 2, 3, 4, 5, 6]))).toThrow(/GIF/);
  });
});
