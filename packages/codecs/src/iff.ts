/**
 * IFF / ILBM decoder (Amiga Interleaved Bitmap).
 *
 * Supports the common cases: indexed planar bitmaps (1–8 planes), uncompressed
 * or ByteRun1-compressed BODY, EHB (Extra-Half-Bright) and HAM6/HAM8. Mask
 * plane (mask = 1) and transparent-colour (mask = 2) are honoured.
 *
 * SHAM per-scanline palettes, 24-bit true-colour and interlace are handled.
 * IFF ANIM (multi-frame) is decoded separately by {@link decodeANIM} (the
 * common Byte-Vertical-Delta / DPaint mode-5 compression).
 */
import { BinaryStream, type ColorArray } from "@dpaint/primitives";
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

export interface DecodedANIM {
  width: number;
  height: number;
  palette: ColorArray[];
  /** One RGBA buffer (width*height*4) per animation frame. */
  frames: Uint8ClampedArray[];
}

/** Convert a deinterleaved plane-byte buffer to RGBA (indexed / EHB / HAM). */
function ilbmFlatToRGBA(
  flat: Uint8Array,
  width: number,
  height: number,
  numPlanes: number,
  planesPerRow: number,
  rowBytes: number,
  palette: ColorArray[],
  opts: { ham: boolean; ehb: boolean; mask: number },
): Uint8ClampedArray {
  const { ham, ehb, mask } = opts;
  const pal = palette.map((c) => c.slice() as ColorArray);
  let colorPlanes = numPlanes;
  if (ham) {
    colorPlanes = numPlanes >= 7 ? 6 : 4;
  } else if (ehb) {
    for (let i = 0; i < 32 && i < pal.length; i++) {
      const c = pal[i]!;
      pal[i + 32] = [c[0]! >> 1, c[1]! >> 1, c[2]! >> 1];
    }
  }
  const lowMask = (1 << colorPlanes) - 1;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const rowBase = y * planesPerRow * rowBytes;
    let prev: ColorArray = [0, 0, 0];
    for (let x = 0; x < width; x++) {
      const byteIndex = x >> 3;
      const bit = 0x80 >> (x & 7);
      let pixel = 0;
      for (let p = 0; p < numPlanes; p++) {
        if (flat[rowBase + p * rowBytes + byteIndex]! & bit) pixel |= 1 << p;
      }
      let color: ColorArray;
      let alpha = 255;
      if (ham) {
        const index = pixel & lowMask;
        const modifier = pixel >> colorPlanes;
        if (modifier === 0) {
          color = (pal[index] ?? [0, 0, 0]).slice() as ColorArray;
        } else {
          const value = (index << (8 - colorPlanes)) & 0xff;
          color = prev.slice() as ColorArray;
          if (modifier === 1) color[2] = value;
          else if (modifier === 2) color[0] = value;
          else if (modifier === 3) color[1] = value;
        }
        prev = color;
      } else {
        color = pal[pixel] ?? [0, 0, 0];
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
  return data;
}

/**
 * Apply an IFF ANIM Byte-Vertical-Delta (compression 5, the Deluxe Paint
 * default) DLTA chunk in place onto a copy of the previous frame's plane bytes.
 */
function applyByteVerticalDelta(
  file: BinaryStream,
  dltaStart: number,
  flat: Uint8Array,
  height: number,
  numPlanes: number,
  planesPerRow: number,
  rowBytes: number,
): void {
  const pointers: number[] = [];
  file.goto(dltaStart);
  for (let i = 0; i < 8; i++) pointers.push(file.readUint());
  const colCount = rowBytes; // one byte column = 8 pixels
  const bitPlaneCount = Math.min(numPlanes, 8);
  for (let p = 0; p < bitPlaneCount; p++) {
    const ptr = pointers[p]!;
    if (!ptr) continue;
    file.goto(dltaStart + ptr);
    for (let col = 0; col < colCount; col++) {
      const opCount = file.readUbyte();
      let y = 0;
      for (let op = 0; op < opCount; op++) {
        const code = file.readUbyte();
        if (code === 0) {
          // same op: run of one repeated byte
          const cnt = file.readUbyte();
          const b = file.readUbyte();
          for (let i = 0; i < cnt; i++) {
            if (y < height) flat[y * planesPerRow * rowBytes + p * rowBytes + col] = b;
            y++;
          }
        } else if (code < 128) {
          y += code; // skip op
        } else {
          // uniq op: literal bytes
          const cnt = code - 128;
          for (let i = 0; i < cnt; i++) {
            const b = file.readUbyte();
            if (y < height) flat[y * planesPerRow * rowBytes + p * rowBytes + col] = b;
            y++;
          }
        }
      }
    }
  }
}

/**
 * Decode an IFF ANIM (multi-frame ILBM animation). The first embedded FORM ILBM
 * is a full frame; subsequent frames are DLTA deltas against the previous frame.
 * Only Byte-Vertical-Delta (compression 5) is decoded — like the original app,
 * other delta modes leave the frame as a copy of its predecessor.
 */
export function decodeANIM(bytes: Uint8Array): DecodedANIM {
  const file = new BinaryStream(new Uint8Array(bytes).buffer, true);
  if (file.readString(4, 0) !== "FORM") throw new Error("Not an IFF FORM");
  file.readUint(); // form size
  if (file.readString(4) !== "ANIM") throw new Error("Not an IFF ANIM");

  let width = 0;
  let height = 0;
  let numPlanes = 0;
  let mask = 0;
  let ehb = false;
  let ham = false;
  let palette: ColorArray[] = [];
  let planesPerRow = 0;
  let rowBytes = 0;
  let prevFlat: Uint8Array | null = null;
  const frames: Uint8ClampedArray[] = [];

  while (!file.isEOF()) {
    const name = file.readString(4);
    if (name.length < 4) break;
    const size = file.readUint();
    const next = file.index + size + (size & 1);

    if (name === "FORM") {
      file.readString(4); // nested form type (ILBM)
      let compression = 0;
      let animComp = -1;
      let bodyStart = -1;
      let bodySize = 0;
      let dltaStart = -1;
      while (file.index < next) {
        const cn = file.readString(4);
        if (cn.length < 4) break;
        const cs = file.readUint();
        const cnext = file.index + cs + (cs & 1);
        if (cn === "BMHD") {
          width = file.readWord();
          height = file.readWord();
          file.readShort();
          file.readShort();
          numPlanes = file.readUbyte();
          mask = file.readUbyte();
          compression = file.readUbyte();
        } else if (cn === "CMAP") {
          palette = [];
          const colors = Math.floor(cs / 3);
          for (let i = 0; i < colors; i++) {
            palette.push([file.readUbyte(), file.readUbyte(), file.readUbyte()]);
          }
        } else if (cn === "CAMG") {
          const v = file.readUint();
          ehb = (v & 0x80) !== 0;
          ham = (v & 0x800) !== 0;
        } else if (cn === "ANHD") {
          animComp = file.readUbyte();
        } else if (cn === "BODY") {
          bodyStart = file.index;
          bodySize = cs;
        } else if (cn === "DLTA") {
          dltaStart = file.index;
        }
        file.goto(cnext);
      }

      planesPerRow = numPlanes + (mask === 1 ? 1 : 0);
      rowBytes = ((width + 15) >> 4) << 1;
      const flatLen = rowBytes * planesPerRow * height;

      let flat: Uint8Array | null = null;
      if (bodyStart >= 0) {
        if (compression === 1) {
          const source: ByteSource = {
            dataView: file.dataView,
            index: bodyStart,
            goto(v: number) {
              this.index = v;
            },
          };
          flat = decodeLine(source, bodyStart, flatLen, bodyStart + bodySize).line;
        } else {
          flat = new Uint8Array(flatLen);
          for (let i = 0; i < flatLen && bodyStart + i < file.length; i++) {
            flat[i] = file.dataView.getUint8(bodyStart + i);
          }
        }
      } else if (dltaStart >= 0 && prevFlat) {
        flat = new Uint8Array(prevFlat); // start from the reference frame
        if (animComp === 5) {
          applyByteVerticalDelta(file, dltaStart, flat, height, numPlanes, planesPerRow, rowBytes);
        }
      }

      if (flat) {
        prevFlat = flat;
        frames.push(
          ilbmFlatToRGBA(flat, width, height, numPlanes, planesPerRow, rowBytes, palette, {
            ham,
            ehb,
            mask,
          }),
        );
      }
    }
    file.goto(next);
  }

  if (frames.length === 0) throw new Error("IFF ANIM contains no frames");
  return { width, height, palette, frames };
}

/**
 * Decode an IFF "PBM " image — the **chunky** (one byte per pixel) variant used
 * by the PC version of Deluxe Paint, optionally ByteRun1 (PackBits) compressed.
 */
export function decodePBM(bytes: Uint8Array): DecodedILBM {
  const file = new BinaryStream(new Uint8Array(bytes).buffer, true);
  if (file.readString(4, 0) !== "FORM") throw new Error("Not an IFF FORM");
  file.readUint();
  if (file.readString(4) !== "PBM ") throw new Error("Not an IFF PBM");

  let width = 0;
  let height = 0;
  let compression = 0;
  let palette: ColorArray[] = [];
  let bodyStart = -1;
  let bodySize = 0;

  while (!file.isEOF()) {
    const name = file.readString(4);
    if (name.length < 4) break;
    const size = file.readUint();
    const next = file.index + size + (size & 1);
    if (name === "BMHD") {
      width = file.readWord();
      height = file.readWord();
      file.readShort();
      file.readShort();
      file.readUbyte(); // numPlanes (8 for chunky)
      file.readUbyte(); // mask
      compression = file.readUbyte();
    } else if (name === "CMAP") {
      palette = [];
      const colors = Math.floor(size / 3);
      for (let i = 0; i < colors; i++) {
        palette.push([file.readUbyte(), file.readUbyte(), file.readUbyte()]);
      }
    } else if (name === "BODY") {
      bodyStart = file.index;
      bodySize = size;
    }
    file.goto(next);
    if (name === "BODY") break;
  }

  if (width === 0 || height === 0) throw new Error("PBM missing BMHD");
  if (bodyStart < 0) throw new Error("PBM missing BODY");

  const rowLen = width + (width & 1); // rows are padded to an even byte length
  const expected = rowLen * height;
  let chunky: Uint8Array;
  if (compression === 1) {
    const source: ByteSource = {
      dataView: file.dataView,
      index: bodyStart,
      goto(v: number) {
        this.index = v;
      },
    };
    chunky = decodeLine(source, bodyStart, expected, bodyStart + bodySize).line;
  } else {
    chunky = new Uint8Array(expected);
    for (let i = 0; i < expected && bodyStart + i < file.length; i++) {
      chunky[i] = file.dataView.getUint8(bodyStart + i);
    }
  }

  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = chunky[y * rowLen + x]!;
      const c = palette[idx] ?? [0, 0, 0];
      const o = (y * width + x) * 4;
      data[o] = c[0]!;
      data[o + 1] = c[1]!;
      data[o + 2] = c[2]!;
      data[o + 3] = 255;
    }
  }

  return { width, height, numPlanes: 8, palette, mode: "indexed", data };
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
 * Encode an RGBA image as a HAM ILBM (HAM6 = 6 planes, HAM8 = 8 planes, CAMG
 * HAM flag). A greedy per-scanline encoder: each pixel is either a base-palette
 * index or a single channel modification of the previous pixel — whichever is
 * closest. Round-trips exactly for images that only use base-palette colours.
 */
export function encodeHAM(input: HAMEncodeInput, planes: 6 | 8 = 6): Uint8Array {
  const { width, height, data } = input;
  const colorPlanes = planes >= 7 ? 6 : 4;
  const maxColors = 1 << colorPlanes;
  const valueShift = 8 - colorPlanes; // bits dropped when reducing a channel
  const palette = input.palette.slice(0, maxColors);
  const numPlanes = planes;
  const rowBytes = ((width + 15) >> 4) << 1;
  const bodySize = rowBytes * numPlanes * height;

  const dist = (r: number, g: number, b: number, c: ColorArray) => {
    const dr = r - c[0]!;
    const dg = g - c[1]!;
    const db = b - c[2]!;
    return dr * dr + dg * dg + db * db;
  };

  // code per pixel: (modifier << colorPlanes) | value(0..maxColors-1)
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
        const v = value >> valueShift;
        const expanded = (v << valueShift) & 0xff;
        const c: ColorArray = [prev[0]!, prev[1]!, prev[2]!];
        c[channel] = expanded;
        const cost = dist(r, g, b, c);
        if (cost < bestCost) {
          bestCost = cost;
          bestCode = (modifier << colorPlanes) | v;
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

  const cmapSize = palette.length * 3;
  const formContent = 4 + (8 + 20) + (8 + 4) + (8 + cmapSize) + (cmapSize & 1) + (8 + bodySize);
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

/** Encode as HAM6 (16-colour base palette). */
export function encodeHAM6(input: HAMEncodeInput): Uint8Array {
  return encodeHAM(input, 6);
}

/** Encode as HAM8 (64-colour base palette). */
export function encodeHAM8(input: HAMEncodeInput): Uint8Array {
  return encodeHAM(input, 8);
}

export interface SHAMEncodeInput {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray; // RGBA
}

/**
 * Encode an RGBA image as a sliced-HAM (SHAM) ILBM: HAM6 with an independent
 * 16-colour palette per scanline. Each row's palette is the distinct 12-bit
 * colours of that row (first 16); round-trips exactly when a row uses <= 16
 * distinct 12-bit colours.
 */
export function encodeSHAM(input: SHAMEncodeInput): Uint8Array {
  const { width, height, data } = input;
  const numPlanes = 6;
  const colorPlanes = 4;
  const rowBytes = ((width + 15) >> 4) << 1;
  const bodySize = rowBytes * numPlanes * height;

  // Build a 16-colour (12-bit) palette per scanline, and HAM6-encode each row.
  const rowWords: number[][] = []; // 16 SHAM words per row
  const codes = new Uint8Array(width * height);
  const dist = (r: number, g: number, b: number, c: ColorArray) => {
    const dr = r - c[0]!, dg = g - c[1]!, db = b - c[2]!;
    return dr * dr + dg * dg + db * db;
  };

  for (let y = 0; y < height; y++) {
    // distinct 12-bit colours of this row (expanded form + words)
    const seen = new Map<number, ColorArray>();
    for (let x = 0; x < width && seen.size < 16; x++) {
      const o = (y * width + x) * 4;
      const r4 = data[o]! >> 4, g4 = data[o + 1]! >> 4, b4 = data[o + 2]! >> 4;
      const key = (r4 << 8) | (g4 << 4) | b4;
      if (!seen.has(key)) seen.set(key, [(r4 << 4) | r4, (g4 << 4) | g4, (b4 << 4) | b4]);
    }
    const palette = Array.from(seen.values());
    const words: number[] = [];
    for (let i = 0; i < 16; i++) {
      const r4 = (palette[i]?.[0] ?? 0) >> 4;
      const g4 = (palette[i]?.[1] ?? 0) >> 4;
      const b4 = (palette[i]?.[2] ?? 0) >> 4;
      words.push((r4 << 8) | (g4 << 4) | b4);
    }
    rowWords.push(words);

    let prev: ColorArray = [0, 0, 0];
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const r = data[o]!, g = data[o + 1]!, b = data[o + 2]!;
      let bestCost = Infinity, bestCode = 0, bestColor: ColorArray = [0, 0, 0];
      for (let i = 0; i < palette.length; i++) {
        const cost = dist(r, g, b, palette[i]!);
        if (cost < bestCost) { bestCost = cost; bestCode = i; bestColor = palette[i]!; }
      }
      const tryModify = (modifier: number, channel: number, value: number) => {
        const v = value >> 4;
        const c: ColorArray = [prev[0]!, prev[1]!, prev[2]!];
        c[channel] = (v << 4) & 0xff;
        const cost = dist(r, g, b, c);
        if (cost < bestCost) { bestCost = cost; bestCode = (modifier << colorPlanes) | v; bestColor = c; }
      };
      tryModify(1, 2, b);
      tryModify(2, 0, r);
      tryModify(3, 1, g);
      codes[y * width + x] = bestCode;
      prev = bestColor;
    }
  }

  const shamSize = 2 + height * 16 * 2;
  const cmap = rowWords[0]!.map((wrd) => {
    const r4 = (wrd >> 8) & 0xf, g4 = (wrd >> 4) & 0xf, b4 = wrd & 0xf;
    return [(r4 << 4) | r4, (g4 << 4) | g4, (b4 << 4) | b4] as ColorArray;
  });
  const cmapSize = cmap.length * 3;

  const formContent =
    4 + (8 + 20) + (8 + 4) + (8 + cmapSize) + (cmapSize & 1) + (8 + shamSize) + (8 + bodySize);
  const f = new BinaryStream(new ArrayBuffer(8 + formContent), true);
  f.writeString("FORM");
  f.writeUint(formContent);
  f.writeString("ILBM");

  f.writeString("BMHD");
  f.writeUint(20);
  f.writeWord(width); f.writeWord(height); f.writeWord(0); f.writeWord(0);
  f.writeUbyte(numPlanes); f.writeUbyte(0); f.writeUbyte(0); f.writeUbyte(0);
  f.writeWord(0); f.writeUbyte(1); f.writeUbyte(1); f.writeWord(width); f.writeWord(height);

  f.writeString("CAMG");
  f.writeUint(4);
  f.writeUint(0x800); // HAM flag

  f.writeString("CMAP");
  f.writeUint(cmapSize);
  for (const c of cmap) { f.writeUbyte(c[0]!); f.writeUbyte(c[1]!); f.writeUbyte(c[2]!); }
  if (cmapSize & 1) f.writeUbyte(0);

  f.writeString("SHAM");
  f.writeUint(shamSize);
  f.writeWord(0); // version
  for (const words of rowWords) for (const wrd of words) f.writeWord(wrd);

  f.writeString("BODY");
  f.writeUint(bodySize);
  const row = new Uint8Array(rowBytes * numPlanes);
  for (let y = 0; y < height; y++) {
    row.fill(0);
    for (let x = 0; x < width; x++) {
      const code = codes[y * width + x]!;
      const byteIndex = x >> 3;
      const bit = 0x80 >> (x & 7);
      for (let p = 0; p < numPlanes; p++) if (code & (1 << p)) row[p * rowBytes + byteIndex] |= bit;
    }
    f.writeByteArray(row);
  }

  return new Uint8Array(f.buffer);
}

const IFF = { decodeILBM, decodeANIM, decodePBM, encodeILBM, encodeTrueColorILBM, encodeHAM, encodeHAM6, encodeHAM8, encodeSHAM };
export default IFF;
