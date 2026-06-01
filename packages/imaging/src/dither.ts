import type { ColorArray } from "@dpaint/util";
import { nearestColorIndex } from "./quantize.js";

/** Normalised 4×4 Bayer ordered-dither threshold matrix (values 0..1). */
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16 - 0.5));

export interface DitherResult {
  width: number;
  height: number;
  /** palette index per pixel */
  indices: Uint8Array;
}

/**
 * Ordered (Bayer 4×4) dithering to a palette. Deterministic. `strength`
 * controls the perturbation amplitude (default 32 levels).
 */
export function orderedDither(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  palette: ColorArray[],
  strength = 32,
): DitherResult {
  const indices = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const t = BAYER_4X4[y % 4]![x % 4]! * strength;
      const r = clamp(rgba[o]! + t);
      const g = clamp(rgba[o + 1]! + t);
      const b = clamp(rgba[o + 2]! + t);
      indices[y * width + x] = nearestColorIndex([r, g, b], palette);
    }
  }
  return { width, height, indices };
}

/**
 * Floyd–Steinberg error-diffusion dithering to a palette. Deterministic.
 */
export function floydSteinberg(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  palette: ColorArray[],
): DitherResult {
  // work in a float buffer so error can accumulate
  const buf = new Float32Array(width * height * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    buf[j] = rgba[i]!;
    buf[j + 1] = rgba[i + 1]!;
    buf[j + 2] = rgba[i + 2]!;
  }

  const indices = new Uint8Array(width * height);
  const addError = (x: number, y: number, er: number, eg: number, eb: number, f: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const j = (y * width + x) * 3;
    buf[j] += er * f;
    buf[j + 1] += eg * f;
    buf[j + 2] += eb * f;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = (y * width + x) * 3;
      const r = clamp(buf[j]!);
      const g = clamp(buf[j + 1]!);
      const b = clamp(buf[j + 2]!);
      const idx = nearestColorIndex([r, g, b], palette);
      indices[y * width + x] = idx;
      const p = palette[idx]!;
      const er = r - p[0]!;
      const eg = g - p[1]!;
      const eb = b - p[2]!;
      addError(x + 1, y, er, eg, eb, 7 / 16);
      addError(x - 1, y + 1, er, eg, eb, 3 / 16);
      addError(x, y + 1, er, eg, eb, 5 / 16);
      addError(x + 1, y + 1, er, eg, eb, 1 / 16);
    }
  }
  return { width, height, indices };
}

/** Expand palette indices back to an RGBA buffer. */
export function indicesToRGBA(
  indices: Uint8Array,
  palette: ColorArray[],
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(indices.length * 4);
  for (let i = 0; i < indices.length; i++) {
    const c = palette[indices[i]!] ?? [0, 0, 0];
    const o = i * 4;
    out[o] = c[0]!;
    out[o + 1] = c[1]!;
    out[o + 2] = c[2]!;
    out[o + 3] = 255;
  }
  return out;
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}
