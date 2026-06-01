/**
 * IFF / ILBM decoder (Amiga Interleaved Bitmap).
 *
 * Supports the common cases: indexed planar bitmaps (1–8 planes), uncompressed
 * or ByteRun1-compressed BODY, EHB (Extra-Half-Bright) and HAM6/HAM8. Mask
 * plane (mask = 1) and transparent-colour (mask = 2) are honoured.
 *
 * Not yet handled (still in the legacy reader): SHAM per-scanline palettes,
 * 24-bit true-colour, interlace pixel-doubling and ANIM deltas.
 */
import { BinaryStream, type ColorArray } from "@dpaint/util";
import { decodeLine, type ByteSource } from "./byteRun1.js";

export type ILBMMode = "indexed" | "ehb" | "ham6" | "ham8" | "truecolor";

export interface DecodedILBM {
  width: number;
  height: number;
  numPlanes: number;
  palette: ColorArray[];
  mode: ILBMMode;
  /** RGBA buffer, width*height*4. */
  data: Uint8ClampedArray;
}

export function decodeILBM(bytes: Uint8Array): DecodedILBM {
  const file = new BinaryStream(new Uint8Array(bytes).buffer, true); // IFF is big-endian
  if (file.readString(4, 0) !== "FORM") throw new Error("Not an IFF FORM");
  file.readUint(); // form size
  const formType = file.readString(4);
  if (formType !== "ILBM") throw new Error(`Unsupported IFF type: ${formType}`);

  let width = 0;
  let height = 0;
  let numPlanes = 0;
  let mask = 0;
  let compression = 0;
  let transparentColor = 0;
  let ehb = false;
  let ham = false;
  let interlaced = false;
  let palette: ColorArray[] = [];
  let shamPalettes: ColorArray[][] | null = null;
  let bodyStart = -1;
  let bodySize = 0;

  const shamWordToRgb = (word: number): ColorArray => {
    const r = (word >> 8) & 0xf;
    const g = (word >> 4) & 0xf;
    const b = word & 0xf;
    return [(r << 4) | r, (g << 4) | g, (b << 4) | b];
  };

  while (!file.isEOF()) {
    const name = file.readString(4);
    if (name.length < 4) break;
    const size = file.readUint();
    const next = file.index + size + (size & 1); // chunks are word-aligned

    if (name === "BMHD") {
      width = file.readWord();
      height = file.readWord();
      file.readShort(); // x
      file.readShort(); // y
      numPlanes = file.readUbyte();
      mask = file.readUbyte();
      compression = file.readUbyte();
      file.readUbyte(); // pad
      transparentColor = file.readWord();
      // remaining fields (aspect, page size) unused
    } else if (name === "CMAP") {
      palette = [];
      const colors = Math.floor(size / 3);
      for (let i = 0; i < colors; i++) {
        palette.push([file.readUbyte(), file.readUbyte(), file.readUbyte()]);
      }
    } else if (name === "CAMG") {
      const v = file.readUint();
      ehb = (v & 0x80) !== 0;
      ham = (v & 0x800) !== 0;
      interlaced = (v & 0x4) !== 0;
    } else if (name === "SHAM") {
      // Sliced HAM: version word, then 16 colour words per scanline palette.
      const version = file.readWord();
      if (version === 0 && size >= 2) {
        const paletteCount = Math.floor((size - 2) / 2 / 16);
        shamPalettes = [];
        for (let p = 0; p < paletteCount; p++) {
          const pal: ColorArray[] = [];
          for (let i = 0; i < 16; i++) pal.push(shamWordToRgb(file.readWord()));
          shamPalettes.push(pal);
        }
      }
    } else if (name === "BODY") {
      bodyStart = file.index;
      bodySize = size;
    }

    file.goto(next);
    if (name === "BODY") break;
  }

  if (width === 0 || height === 0) throw new Error("ILBM missing BMHD");
  if (bodyStart < 0) throw new Error("ILBM missing BODY");

  // Determine mode + extend the palette for EHB.
  let mode: ILBMMode = "indexed";
  let colorPlanes = numPlanes;
  const trueColor = !ham && numPlanes === 24;
  if (trueColor) {
    mode = "truecolor";
  } else if (ham) {
    colorPlanes = numPlanes >= 7 ? 6 : 4;
    mode = numPlanes >= 7 ? "ham8" : "ham6";
  } else if (ehb) {
    mode = "ehb";
    for (let i = 0; i < 32 && i < palette.length; i++) {
      const c = palette[i]!;
      palette[i + 32] = [c[0]! >> 1, c[1]! >> 1, c[2]! >> 1];
    }
  }

  const planesPerRow = numPlanes + (mask === 1 ? 1 : 0);
  const rowBytes = ((width + 15) >> 4) << 1;
  const expectedLen = rowBytes * planesPerRow * height;

  // Get the raw (deinterleaved) plane bytes.
  let flat: Uint8Array;
  if (compression === 1) {
    const source: ByteSource = {
      dataView: file.dataView,
      index: bodyStart,
      goto(v: number) {
        this.index = v;
      },
    };
    // ILBM ByteRun1 uses 0x80 as a no-op; decode the whole BODY as one stream.
    flat = decodeLine(source, bodyStart, expectedLen, bodyStart + bodySize).line;
  } else {
    flat = new Uint8Array(expectedLen);
    for (let i = 0; i < expectedLen && bodyStart + i < file.length; i++) {
      flat[i] = file.dataView.getUint8(bodyStart + i);
    }
  }

  const data = new Uint8ClampedArray(width * height * 4);
  const lowMask = (1 << colorPlanes) - 1;

  for (let y = 0; y < height; y++) {
    const rowBase = y * planesPerRow * rowBytes;
    let prev: ColorArray = [0, 0, 0];
    // SHAM provides a per-scanline base palette (halved row index when interlaced).
    let rowPalette = palette;
    if (shamPalettes && shamPalettes.length) {
      const idx = Math.min(interlaced ? y >> 1 : y, shamPalettes.length - 1);
      rowPalette = shamPalettes[idx]!;
    }
    for (let x = 0; x < width; x++) {
      const byteIndex = x >> 3;
      const bit = 0x80 >> (x & 7);

      let pixel = 0;
      for (let p = 0; p < numPlanes; p++) {
        const v = flat[rowBase + p * rowBytes + byteIndex]!;
        if (v & bit) pixel |= 1 << p;
      }

      let color: ColorArray;
      let alpha = 255;
      if (trueColor) {
        color = [pixel & 0xff, (pixel >> 8) & 0xff, (pixel >> 16) & 0xff];
      } else if (ham) {
        const index = pixel & lowMask;
        const modifier = pixel >> colorPlanes;
        if (modifier === 0) {
          color = (rowPalette[index] ?? [0, 0, 0]).slice() as ColorArray;
        } else {
          const value = (index << (8 - colorPlanes)) & 0xff;
          color = prev.slice() as ColorArray;
          if (modifier === 1) color[2] = value;
          else if (modifier === 2) color[0] = value;
          else if (modifier === 3) color[1] = value;
        }
        prev = color;
      } else {
        color = palette[pixel] ?? [0, 0, 0];
        if (mask === 2 && pixel === transparentColor) alpha = 0;
        if (mask === 1) {
          const maskByte = flat[rowBase + numPlanes * rowBytes + byteIndex]!;
          alpha = maskByte & bit ? 255 : 0;
        }
      }

      const o = (y * width + x) * 4;
      data[o] = color[0]!;
      data[o + 1] = color[1]!;
      data[o + 2] = color[2]!;
      data[o + 3] = alpha;
    }
  }

  return { width, height, numPlanes, palette, mode, data };
}

export interface ILBMEncodeInput {
  width: number;
  height: number;
  /** Palette index per pixel, width*height. */
  pixels: ArrayLike<number>;
  palette: ColorArray[];
}

function planesNeeded(paletteLength: number): number {
  let planes = 1;
  while (1 << planes < paletteLength) planes++;
  return planes;
}

/**
 * Encode an indexed image as an uncompressed ILBM (FORM/ILBM with
 * BMHD + CMAP + BODY). Round-trips with {@link decodeILBM}.
 */
export function encodeILBM(input: ILBMEncodeInput): Uint8Array {
  const { width, height, pixels, palette } = input;
  const numPlanes = planesNeeded(palette.length);
  const rowBytes = ((width + 15) >> 4) << 1;
  const bodySize = rowBytes * numPlanes * height;

  const cmapSize = palette.length * 3;
  const cmapPad = cmapSize & 1;

  const formContent =
    4 /* ILBM */ + (8 + 20) /* BMHD */ + (8 + cmapSize + cmapPad) + (8 + bodySize);
  const total = 8 + formContent;
  const f = new BinaryStream(new ArrayBuffer(total), true);

  f.writeString("FORM");
  f.writeUint(formContent);
  f.writeString("ILBM");

  f.writeString("BMHD");
  f.writeUint(20);
  f.writeWord(width);
  f.writeWord(height);
  f.writeWord(0); // x
  f.writeWord(0); // y
  f.writeUbyte(numPlanes);
  f.writeUbyte(0); // mask
  f.writeUbyte(0); // compression: none
  f.writeUbyte(0); // pad
  f.writeWord(0); // transparent colour
  f.writeUbyte(1); // xAspect
  f.writeUbyte(1); // yAspect
  f.writeWord(width); // page width
  f.writeWord(height); // page height

  f.writeString("CMAP");
  f.writeUint(cmapSize);
  for (const c of palette) {
    f.writeUbyte(c[0]!);
    f.writeUbyte(c[1]!);
    f.writeUbyte(c[2]!);
  }
  if (cmapPad) f.writeUbyte(0);

  f.writeString("BODY");
  f.writeUint(bodySize);
  const row = new Uint8Array(rowBytes * numPlanes);
  for (let y = 0; y < height; y++) {
    row.fill(0);
    for (let x = 0; x < width; x++) {
      const pixel = pixels[y * width + x]! & 0xff;
      const byteIndex = x >> 3;
      const bit = 0x80 >> (x & 7);
      for (let p = 0; p < numPlanes; p++) {
        if (pixel & (1 << p)) row[p * rowBytes + byteIndex] |= bit;
      }
    }
    f.writeByteArray(row);
  }

  return new Uint8Array(f.buffer);
}

export interface ILBM24EncodeInput {
  width: number;
  height: number;
  /** RGBA pixel buffer, width*height*4 (alpha ignored). */
  data: Uint8Array | Uint8ClampedArray;
}

/**
 * Encode a 24-bit true-colour ILBM (24 planes, no CMAP), uncompressed.
 * Round-trips with {@link decodeILBM}.
 */
export function encodeTrueColorILBM(input: ILBM24EncodeInput): Uint8Array {
  const { width, height, data } = input;
  const numPlanes = 24;
  const rowBytes = ((width + 15) >> 4) << 1;
  const bodySize = rowBytes * numPlanes * height;

  const formContent = 4 /* ILBM */ + (8 + 20) /* BMHD */ + (8 + bodySize);
  const total = 8 + formContent;
  const f = new BinaryStream(new ArrayBuffer(total), true);

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
  f.writeUbyte(0); // mask
  f.writeUbyte(0); // compression: none
  f.writeUbyte(0); // pad
  f.writeWord(0);
  f.writeUbyte(1);
  f.writeUbyte(1);
  f.writeWord(width);
  f.writeWord(height);

  f.writeString("BODY");
  f.writeUint(bodySize);
  const row = new Uint8Array(rowBytes * numPlanes);
  for (let y = 0; y < height; y++) {
    row.fill(0);
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const value = data[o]! | (data[o + 1]! << 8) | (data[o + 2]! << 16);
      const byteIndex = x >> 3;
      const bit = 0x80 >> (x & 7);
      for (let p = 0; p < numPlanes; p++) {
        if (value & (1 << p)) row[p * rowBytes + byteIndex] |= bit;
      }
    }
    f.writeByteArray(row);
  }

  return new Uint8Array(f.buffer);
}

export interface HAMEncodeInput {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray; // RGBA
  /** Base palette (up to 16 colours for HAM6). */
  palette: ColorArray[];
}

/**
 * Encode an RGBA image as a HAM6 ILBM (6 planes, CAMG HAM flag). A greedy
 * per-scanline encoder: each pixel is either a base-palette index or a single
 * 4-bit channel modification of the previous pixel — whichever is closest.
 * Round-trips exactly for images that only use base-palette colours.
 */
export function encodeHAM6(input: HAMEncodeInput): Uint8Array {
  const { width, height, data } = input;
  const palette = input.palette.slice(0, 16);
  const numPlanes = 6;
  const rowBytes = ((width + 15) >> 4) << 1;
  const bodySize = rowBytes * numPlanes * height;

  const dist = (r: number, g: number, b: number, c: ColorArray) => {
    const dr = r - c[0]!;
    const dg = g - c[1]!;
    const db = b - c[2]!;
    return dr * dr + dg * dg + db * db;
  };

  // 6-bit code per pixel: (modifier << 4) | value(0..15)
  const codes = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    let prev: ColorArray = [0, 0, 0];
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const r = data[o]!;
      const g = data[o + 1]!;
      const b = data[o + 2]!;
      let bestCost = Infinity;
      let bestCode = 0;
      let bestColor: ColorArray = [0, 0, 0];

      for (let i = 0; i < palette.length; i++) {
        const cost = dist(r, g, b, palette[i]!);
        if (cost < bestCost) {
          bestCost = cost;
          bestCode = i; // modifier 0
          bestColor = palette[i]!;
        }
      }
      // modifier 1 = B, 2 = R, 3 = G
      const tryModify = (modifier: number, channel: number, value: number) => {
        const v4 = value >> 4;
        const expanded = v4 << 4;
        const c: ColorArray = [prev[0]!, prev[1]!, prev[2]!];
        c[channel] = expanded;
        const cost = dist(r, g, b, c);
        if (cost < bestCost) {
          bestCost = cost;
          bestCode = (modifier << 4) | v4;
          bestColor = c;
        }
      };
      tryModify(1, 2, b);
      tryModify(2, 0, r);
      tryModify(3, 1, g);

      codes[y * width + x] = bestCode;
      prev = bestColor;
    }
  }

  const formContent = 4 + (8 + 20) + (8 + 12) + (8 + palette.length * 3) + ((palette.length * 3) & 1) + (8 + bodySize);
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
  f.writeUint(4);
  f.writeUint(0x800); // HAM flag

  const cmapSize = palette.length * 3;
  f.writeString("CMAP");
  f.writeUint(cmapSize);
  for (const c of palette) {
    f.writeUbyte(c[0]!);
    f.writeUbyte(c[1]!);
    f.writeUbyte(c[2]!);
  }
  if (cmapSize & 1) f.writeUbyte(0);

  f.writeString("BODY");
  f.writeUint(bodySize);
  const row = new Uint8Array(rowBytes * numPlanes);
  for (let y = 0; y < height; y++) {
    row.fill(0);
    for (let x = 0; x < width; x++) {
      const code = codes[y * width + x]!;
      const byteIndex = x >> 3;
      const bit = 0x80 >> (x & 7);
      for (let p = 0; p < numPlanes; p++) {
        if (code & (1 << p)) row[p * rowBytes + byteIndex] |= bit;
      }
    }
    f.writeByteArray(row);
  }

  return new Uint8Array(f.buffer);
}

const IFF = { decodeILBM, encodeILBM, encodeTrueColorILBM, encodeHAM6 };
export default IFF;
