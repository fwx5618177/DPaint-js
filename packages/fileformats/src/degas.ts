/**
 * Atari ST DEGAS (.PI1/.PI2/.PI3) and NeoChrome (.NEO) uncompressed bitmaps.
 *
 * Resolution word → screen mode:
 *   0 = low    320×200, 4 planes, 16 colours
 *   1 = medium 640×200, 2 planes,  4 colours
 *   2 = high   640×400, 1 plane,   2 colours
 *
 * Ported from the legacy reader; returns RGBA instead of a canvas.
 */
import { BinaryStream, type ColorArray } from "@dpaint/util";

export interface DecodedDEGAS {
  width: number;
  height: number;
  palette: ColorArray[];
  data: Uint8ClampedArray;
}

interface Mode {
  width: number;
  height: number;
  planes: number;
}

const MODES: Record<number, Mode> = {
  0: { width: 320, height: 200, planes: 4 },
  1: { width: 640, height: 200, planes: 2 },
  2: { width: 640, height: 400, planes: 1 },
};

/** 3-bit Atari ST colour component (0–7) → 8-bit. */
function expand3(v: number): number {
  return (v << 5) | (v << 2) | (v >> 1);
}

function readPalette(file: BinaryStream): ColorArray[] {
  const palette: ColorArray[] = [];
  for (let i = 0; i < 16; i++) {
    const word = file.readWord();
    palette.push([expand3((word >> 8) & 0x7), expand3((word >> 4) & 0x7), expand3(word & 0x7)]);
  }
  return palette;
}

function decodePixels(file: BinaryStream, width: number, height: number, planes: number): Uint8Array {
  const wordsPerLine = width / 16;
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let g = 0; g < wordsPerLine; g++) {
      const pw: number[] = [];
      for (let p = 0; p < planes; p++) pw[p] = file.readWord();
      for (let b = 15; b >= 0; b--) {
        const x = g * 16 + (15 - b);
        let idx = 0;
        for (let p = 0; p < planes; p++) idx |= ((pw[p]! >> b) & 1) << p;
        pixels[y * width + x] = idx;
      }
    }
  }
  return pixels;
}

function toRGBA(pixels: Uint8Array, palette: ColorArray[], width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i++) {
    const c = palette[pixels[i]!] ?? [0, 0, 0];
    out[i * 4] = c[0]!;
    out[i * 4 + 1] = c[1]!;
    out[i * 4 + 2] = c[2]!;
    out[i * 4 + 3] = 255;
  }
  return out;
}

function stream(bytes: Uint8Array): BinaryStream {
  return new BinaryStream(new Uint8Array(bytes).buffer, true); // Atari ST is big-endian
}

/** Decode a DEGAS .PI1/.PI2/.PI3 image. */
export function decodeDEGAS(bytes: Uint8Array): DecodedDEGAS {
  const file = stream(bytes);
  const res = file.readWord();
  const mode = MODES[res];
  if (!mode) throw new Error(`Unsupported DEGAS resolution: ${res}`);
  const { width, height, planes } = mode;
  const palette = readPalette(file);
  const pixels = decodePixels(file, width, height, planes);
  return { width, height, palette, data: toRGBA(pixels, palette, width, height) };
}

/** Decode a NeoChrome .NEO image. */
export function decodeNeo(bytes: Uint8Array): DecodedDEGAS {
  const file = stream(bytes);
  const flag = file.readWord();
  if (flag !== 0) throw new Error("Unsupported NeoChrome flag");
  const res = file.readWord();
  const mode = MODES[res];
  if (!mode) throw new Error(`Unsupported NeoChrome resolution: ${res}`);
  const { width, height, planes } = mode;
  const palette = readPalette(file); // bytes 4–35
  file.goto(128); // skip metadata
  const pixels = decodePixels(file, width, height, planes);
  return { width, height, palette, data: toRGBA(pixels, palette, width, height) };
}

const DEGAS = { decodeDEGAS, decodeNeo };
export default DEGAS;
