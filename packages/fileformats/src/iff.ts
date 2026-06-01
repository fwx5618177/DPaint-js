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

export type ILBMMode = "indexed" | "ehb" | "ham6" | "ham8";

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
  let palette: ColorArray[] = [];
  let bodyStart = -1;
  let bodySize = 0;

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
  if (ham) {
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
      if (ham) {
        const index = pixel & lowMask;
        const modifier = pixel >> colorPlanes;
        if (modifier === 0) {
          color = (palette[index] ?? [0, 0, 0]).slice() as ColorArray;
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

const IFF = { decodeILBM };
export default IFF;
