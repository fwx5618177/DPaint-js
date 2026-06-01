import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { BinaryStream, type ColorArray } from "@dpaint/util";
import { decodeILBM, encodeILBM, encodeTrueColorILBM } from "../src/iff.js";
import { detectFormat } from "../src/detect.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(here, "fixtures");

/** Build a tiny uncompressed 2-plane indexed ILBM (4×1, indices 0,1,2,3). */
function buildSampleILBM(): Uint8Array {
  const palette = [
    [0, 0, 0],
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
  ];
  // plane0 bit0 for x=0..3 -> 0,1,0,1 -> 0b01010000; plane1 bit1 -> 0,0,1,1 -> 0b00110000
  const body = [0x50, 0x00, 0x30, 0x00];

  const formContentSize = 4 /* ILBM */ + (8 + 20) /* BMHD */ + (8 + 12) /* CMAP */ + (8 + body.length);
  const total = 8 + formContentSize;
  const f = new BinaryStream(new ArrayBuffer(total), true);

  f.writeString("FORM");
  f.writeUint(formContentSize);
  f.writeString("ILBM");

  f.writeString("BMHD");
  f.writeUint(20);
  f.writeWord(4); // width
  f.writeWord(1); // height
  f.writeWord(0); // x
  f.writeWord(0); // y
  f.writeUbyte(2); // numPlanes
  f.writeUbyte(0); // mask
  f.writeUbyte(0); // compression
  f.writeUbyte(0); // pad
  f.writeWord(0); // transparent colour
  f.writeUbyte(1); // xAspect
  f.writeUbyte(1); // yAspect
  f.writeWord(4); // pageWidth
  f.writeWord(1); // pageHeight

  f.writeString("CMAP");
  f.writeUint(12);
  for (const c of palette) {
    f.writeUbyte(c[0]!);
    f.writeUbyte(c[1]!);
    f.writeUbyte(c[2]!);
  }

  f.writeString("BODY");
  f.writeUint(body.length);
  f.writeByteArray(body);

  return new Uint8Array(f.buffer);
}

describe("decodeILBM — synthetic indexed image", () => {
  it("decodes planar bitplanes to the expected RGBA pixels", () => {
    const decoded = decodeILBM(buildSampleILBM());
    expect(decoded.width).toBe(4);
    expect(decoded.height).toBe(1);
    expect(decoded.numPlanes).toBe(2);
    expect(decoded.mode).toBe("indexed");
    expect(Array.from(decoded.data)).toEqual([
      0, 0, 0, 255, // index 0 -> black
      255, 0, 0, 255, // index 1 -> red
      0, 255, 0, 255, // index 2 -> green
      0, 0, 255, 255, // index 3 -> blue
    ]);
  });

  it("rejects non-IFF input", () => {
    expect(() => decodeILBM(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow();
  });
});

describe("encodeILBM round-trip", () => {
  const PALETTE: ColorArray[] = [
    [0, 0, 0],
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
    [0, 255, 255],
    [255, 0, 255],
    [255, 255, 255],
  ];

  it("produces a FORM/ILBM recognised by detectFormat", () => {
    const ilbm = encodeILBM({ width: 2, height: 2, pixels: [0, 1, 2, 3], palette: PALETTE });
    expect(detectFormat(ilbm)).toBe("ILBM");
  });

  it("round-trips indexed pixels through encode → decode", () => {
    const width = 13; // deliberately not a multiple of 16 (exercises row padding)
    const height = 5;
    const pixels = Array.from({ length: width * height }, (_, i) => i % PALETTE.length);
    const decoded = decodeILBM(encodeILBM({ width, height, pixels, palette: PALETTE }));

    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
    for (let i = 0; i < width * height; i++) {
      const expected = PALETTE[i % PALETTE.length]!;
      const o = i * 4;
      expect([decoded.data[o], decoded.data[o + 1], decoded.data[o + 2], decoded.data[o + 3]]).toEqual([
        expected[0],
        expected[1],
        expected[2],
        255,
      ]);
    }
  });

  it("preserves the palette", () => {
    const decoded = decodeILBM(
      encodeILBM({ width: 1, height: 1, pixels: [0], palette: PALETTE }),
    );
    expect(decoded.palette).toEqual(PALETTE);
  });
});

describe("24-bit true-colour ILBM round-trip", () => {
  it("round-trips arbitrary RGB through encode → decode", () => {
    const width = 11;
    const height = 3;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const o = i * 4;
      data[o] = (i * 7) % 256;
      data[o + 1] = (i * 13) % 256;
      data[o + 2] = (i * 29) % 256;
      data[o + 3] = 255;
    }
    const decoded = decodeILBM(encodeTrueColorILBM({ width, height, data }));
    expect(decoded.mode).toBe("truecolor");
    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
    expect(Array.from(decoded.data)).toEqual(Array.from(data));
  });
});

describe("decodeILBM — real fixtures", () => {
  it("decodes the 320×256 SHAM ILBM to the right dimensions and buffer size", () => {
    const data = new Uint8Array(readFileSync(resolve(fixtures, "TEST_IMAGE_320x256_SHAM.iff")));
    const decoded = decodeILBM(data);
    expect(decoded.width).toBe(320);
    expect(decoded.height).toBe(256);
    expect(decoded.data.length).toBe(320 * 256 * 4);
    // HAM mode should be detected (CAMG HAM flag set)
    expect(decoded.mode === "ham6" || decoded.mode === "ham8").toBe(true);
  });

  it("decodes the 16×4 HAM6 ILBM fixture", () => {
    const data = new Uint8Array(readFileSync(resolve(fixtures, "sham-16x4-ham6.ilbm")));
    const decoded = decodeILBM(data);
    expect(decoded.width).toBe(16);
    expect(decoded.height).toBe(4);
    expect(decoded.data.length).toBe(16 * 4 * 4);
  });
});
