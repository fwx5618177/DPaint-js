import { describe, it, expect } from "vitest";
import { BinaryStream } from "@dpaint/primitives";
import { decodePSD, encodePSD } from "../src/psd.js";
import { detectFormat } from "../src/detect.js";

/** Build a tiny raw (uncompressed) 8-bit RGB PSD with 3 channels. */
function buildRgbPsd(width: number, height: number, r: number[], g: number[], b: number[]): Uint8Array {
  const n = width * height;
  const total = 26 + 4 + 4 + 4 + 2 + n * 3;
  const f = new BinaryStream(new ArrayBuffer(total), true);
  f.writeString("8BPS");
  f.writeWord(1); // version
  f.fill(0, 6); // reserved
  f.writeWord(3); // channels
  f.writeUint(height);
  f.writeUint(width);
  f.writeWord(8); // depth
  f.writeWord(3); // mode RGB
  f.writeUint(0); // colour-mode data length
  f.writeUint(0); // image resources length
  f.writeUint(0); // layer & mask info length
  f.writeWord(0); // compression: raw
  for (const v of r) f.writeUbyte(v);
  for (const v of g) f.writeUbyte(v);
  for (const v of b) f.writeUbyte(v);
  return new Uint8Array(f.buffer);
}

describe("decodePSD — raw RGB", () => {
  it("is detected as a PSD", () => {
    const psd = buildRgbPsd(1, 1, [10], [20], [30]);
    expect(detectFormat(psd)).toBe("PSD");
  });

  it("decodes planar channels into interleaved RGBA", () => {
    const psd = buildRgbPsd(
      2,
      2,
      [10, 40, 70, 100],
      [20, 50, 80, 110],
      [30, 60, 90, 120],
    );
    const decoded = decodePSD(psd);
    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(2);
    expect(Array.from(decoded.data)).toEqual([
      10, 20, 30, 255,
      40, 50, 60, 255,
      70, 80, 90, 255,
      100, 110, 120, 255,
    ]);
  });

  it("rejects non-PSD input", () => {
    expect(() => decodePSD(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow();
  });
});

describe("encodePSD → decodePSD round-trip", () => {
  it("round-trips RGBA pixels", () => {
    const width = 3;
    const height = 2;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = i * 10;
      data[i * 4 + 1] = i * 20;
      data[i * 4 + 2] = i * 30;
      data[i * 4 + 3] = 200 + i;
    }
    const psd = encodePSD({ width, height, data });
    expect(detectFormat(psd)).toBe("PSD");
    const decoded = decodePSD(psd);
    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
    expect(Array.from(decoded.data)).toEqual(Array.from(data));
  });
});
