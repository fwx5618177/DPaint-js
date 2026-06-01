/**
 * Pure, deterministic RGBA image effects. Each function returns a new buffer
 * (alpha preserved) so they compose cleanly and are trivially testable —
 * unlike the canvas/`Math.random()`-bound legacy "alchemy" effects.
 */

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

type Rgba = Uint8Array | Uint8ClampedArray;

function mapChannels(rgba: Rgba, fn: (c: number) => number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    out[i] = clamp(fn(rgba[i]!));
    out[i + 1] = clamp(fn(rgba[i + 1]!));
    out[i + 2] = clamp(fn(rgba[i + 2]!));
    out[i + 3] = rgba[i + 3]!;
  }
  return out;
}

/** Add a signed delta (-255..255) to each colour channel. */
export function adjustBrightness(rgba: Rgba, delta: number): Uint8ClampedArray {
  return mapChannels(rgba, (c) => c + delta);
}

/** Scale contrast around mid-grey. `factor` 1 = unchanged, >1 = more contrast. */
export function adjustContrast(rgba: Rgba, factor: number): Uint8ClampedArray {
  return mapChannels(rgba, (c) => (c - 128) * factor + 128);
}

/** Reduce each channel to `levels` evenly-spaced steps (>= 2). */
export function posterize(rgba: Rgba, levels: number): Uint8ClampedArray {
  const n = Math.max(2, Math.floor(levels));
  const step = 255 / (n - 1);
  return mapChannels(rgba, (c) => Math.round(Math.round(c / step) * step));
}

/** Black/white threshold by Rec. 601 luma. */
export function threshold(rgba: Rgba, level = 128): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const luma = 0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!;
    const v = luma >= level ? 255 : 0;
    out[i] = v;
    out[i + 1] = v;
    out[i + 2] = v;
    out[i + 3] = rgba[i + 3]!;
  }
  return out;
}

/** Separable box blur of the given pixel `radius` (alpha preserved). */
export function boxBlur(
  rgba: Rgba,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  if (radius < 1) return new Uint8ClampedArray(rgba);
  const horizontal = blurPass(rgba, width, height, radius, true);
  return blurPass(horizontal, width, height, radius, false);
}

function blurPass(
  rgba: Rgba,
  width: number,
  height: number,
  radius: number,
  horizontal: boolean,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length);
  const len = horizontal ? width : height;
  const lines = horizontal ? height : width;
  for (let line = 0; line < lines; line++) {
    for (let i = 0; i < len; i++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k++) {
        const pos = i + k;
        if (pos < 0 || pos >= len) continue;
        const x = horizontal ? pos : line;
        const y = horizontal ? line : pos;
        const o = (y * width + x) * 4;
        r += rgba[o]!;
        g += rgba[o + 1]!;
        b += rgba[o + 2]!;
        count++;
      }
      const x = horizontal ? i : line;
      const y = horizontal ? line : i;
      const o = (y * width + x) * 4;
      out[o] = Math.round(r / count);
      out[o + 1] = Math.round(g / count);
      out[o + 2] = Math.round(b / count);
      out[o + 3] = rgba[o + 3]!;
    }
  }
  return out;
}
