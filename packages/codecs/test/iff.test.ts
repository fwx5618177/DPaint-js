import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { BinaryStream, type ColorArray } from "@dpaint/primitives";
import {
  decodeILBM,
  encodeILBM,
  encodeTrueColorILBM,
  encodeHAM6,
  encodeHAM8,
  encodeSHAM,
} from "../src/iff.js";
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

describe("HAM6 encode → decode", () => {
  const PALETTE: ColorArray[] = [
    [0, 0, 0],
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
  ];

  it("emits a HAM6 ILBM", () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255]);
    const ham = encodeHAM6({ width: 1, height: 1, data, palette: PALETTE });
    expect(detectFormat(ham)).toBe("ILBM");
    expect(decodeILBM(ham).mode).toBe("ham6");
  });

  it("round-trips colours that are exact palette entries", () => {
    const width = 4;
    const height = 2;
    const order = [0, 1, 2, 3, 1, 2, 3, 0];
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const c = PALETTE[order[i]!]!;
      data[i * 4] = c[0]!;
      data[i * 4 + 1] = c[1]!;
      data[i * 4 + 2] = c[2]!;
      data[i * 4 + 3] = 255;
    }
    const decoded = decodeILBM(encodeHAM6({ width, height, data, palette: PALETTE }));
    for (let i = 0; i < width * height; i++) {
      const c = PALETTE[order[i]!]!;
      const o = i * 4;
      expect([decoded.data[o], decoded.data[o + 1], decoded.data[o + 2]]).toEqual([c[0], c[1], c[2]]);
    }
  });
});

describe("HAM8 encode → decode", () => {
  it("emits a HAM8 ILBM and round-trips palette colours", () => {
    const palette: ColorArray[] = Array.from({ length: 64 }, (_, i) => [i * 4, 0, 255 - i * 4]);
    const width = 4;
    const height = 2;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const c = palette[i % 64]!;
      data[i * 4] = c[0]!;
      data[i * 4 + 1] = c[1]!;
      data[i * 4 + 2] = c[2]!;
      data[i * 4 + 3] = 255;
    }
    const decoded = decodeILBM(encodeHAM8({ width, height, data, palette }));
    expect(decoded.mode).toBe("ham8");
    for (let i = 0; i < width * height; i++) {
      const c = palette[i % 64]!;
      const o = i * 4;
      expect([decoded.data[o], decoded.data[o + 1], decoded.data[o + 2]]).toEqual([c[0], c[1], c[2]]);
    }
  });
});

describe("SHAM encode → decode", () => {
  it("round-trips per-row 12-bit colours via sliced palettes", () => {
    // 2x2, each row uses 2 distinct 12-bit-aligned colours
    const width = 2;
    const height = 2;
    const rows = [
      [
        [255, 0, 0],
        [0, 136, 0],
      ],
      [
        [0, 0, 255],
        [136, 136, 0],
      ],
    ];
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const c = rows[y]![x]!;
        const o = (y * width + x) * 4;
        data[o] = c[0]!;
        data[o + 1] = c[1]!;
        data[o + 2] = c[2]!;
        data[o + 3] = 255;
      }
    }
    const decoded = decodeILBM(encodeSHAM({ width, height, data }));
    expect(decoded.mode).toBe("ham6");
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const c = rows[y]![x]!;
        const o = (y * width + x) * 4;
        expect([decoded.data[o], decoded.data[o + 1], decoded.data[o + 2]]).toEqual([c[0], c[1], c[2]]);
      }
    }
  });
});

describe("decodeILBM — SHAM per-scanline palette", () => {
  it("uses a different base palette per row", () => {
    // 2×2 HAM6 (6 planes), all pixels index 0 modifier 0 -> rowPalette[0]
    const width = 2;
    const height = 2;
    const numPlanes = 6;
    const rowBytes = ((width + 15) >> 4) << 1; // 2
    const bodySize = rowBytes * numPlanes * height; // 24
    const shamSize = 2 + 2 * 16 * 2; // version + 2 palettes * 16 words

    const formContent = 4 + (8 + 20) + (8 + 4) + (8 + shamSize) + (8 + bodySize);
    const f = new BinaryStream(new ArrayBuffer(8 + formContent), true);
    f.writeString("FORM");
    f.writeUint(formContent);
    f.writeString("ILBM");

    f.writeString("BMHD");
    f.writeUint(20);
    f.writeWord(width);
    f.writeWord(height);
    f.writeWord(0);
    f.writeWord(0);
    f.writeUbyte(numPlanes);
    f.writeUbyte(0);
    f.writeUbyte(0);
    f.writeUbyte(0);
    f.writeWord(0);
    f.writeUbyte(1);
    f.writeUbyte(1);
    f.writeWord(width);
    f.writeWord(height);

    f.writeString("CAMG");
    f.writeUint(4); // chunk size
    f.writeUint(0x800); // HAM flag

    f.writeString("SHAM");
    f.writeUint(shamSize);
    f.writeWord(0); // version
    // row-0 palette: colour 0 = red (0x0F00 in 0RGB), rest 0
    f.writeWord(0x0f00);
    for (let i = 1; i < 16; i++) f.writeWord(0);
    // row-1 palette: colour 0 = green (0x00F0)
    f.writeWord(0x00f0);
    for (let i = 1; i < 16; i++) f.writeWord(0);

    f.writeString("BODY");
    f.writeUint(bodySize);
    for (let i = 0; i < bodySize; i++) f.writeUbyte(0); // all planes 0

    const decoded = decodeILBM(new Uint8Array(f.buffer));
    expect(decoded.mode).toBe("ham6");
    // row 0 -> red, row 1 -> green (from per-scanline SHAM palettes)
    expect([decoded.data[0], decoded.data[1], decoded.data[2]]).toEqual([255, 0, 0]);
    const row1 = (1 * width + 0) * 4;
    expect([decoded.data[row1], decoded.data[row1 + 1], decoded.data[row1 + 2]]).toEqual([0, 255, 0]);
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
