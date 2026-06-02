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

/** Adjust saturation around per-pixel luma. 0 = greyscale, 1 = unchanged, >1 = boosted. */
export function adjustSaturation(rgba: Rgba, amount: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i]!;
    const g = rgba[i + 1]!;
    const b = rgba[i + 2]!;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    out[i] = clamp(luma + (r - luma) * amount);
    out[i + 1] = clamp(luma + (g - luma) * amount);
    out[i + 2] = clamp(luma + (b - luma) * amount);
    out[i + 3] = rgba[i + 3]!;
  }
  return out;
}

/** Rotate hue by `degrees` (0-360) using the standard luma-preserving matrix. */
export function hueRotate(rgba: Rgba, degrees: number): Uint8ClampedArray {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // matrix coefficients (per W3C filter hue-rotate)
  const m = [
    0.213 + cos * 0.787 - sin * 0.213,
    0.715 - cos * 0.715 - sin * 0.715,
    0.072 - cos * 0.072 + sin * 0.928,
    0.213 - cos * 0.213 + sin * 0.143,
    0.715 + cos * 0.285 + sin * 0.14,
    0.072 - cos * 0.072 - sin * 0.283,
    0.213 - cos * 0.213 - sin * 0.787,
    0.715 - cos * 0.715 + sin * 0.715,
    0.072 + cos * 0.928 + sin * 0.072,
  ];
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i]!;
    const g = rgba[i + 1]!;
    const b = rgba[i + 2]!;
    out[i] = clamp(r * m[0]! + g * m[1]! + b * m[2]!);
    out[i + 1] = clamp(r * m[3]! + g * m[4]! + b * m[5]!);
    out[i + 2] = clamp(r * m[6]! + g * m[7]! + b * m[8]!);
    out[i + 3] = rgba[i + 3]!;
  }
  return out;
}

/** Apply a sepia tone, blended by `amount` (0 = none, 1 = full sepia). */
export function sepia(rgba: Rgba, amount = 1): Uint8ClampedArray {
  const a = Math.max(0, Math.min(1, amount));
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i]!;
    const g = rgba[i + 1]!;
    const b = rgba[i + 2]!;
    const sr = 0.393 * r + 0.769 * g + 0.189 * b;
    const sg = 0.349 * r + 0.686 * g + 0.168 * b;
    const sb = 0.272 * r + 0.534 * g + 0.131 * b;
    out[i] = clamp(r + (sr - r) * a);
    out[i + 1] = clamp(g + (sg - g) * a);
    out[i + 2] = clamp(b + (sb - b) * a);
    out[i + 3] = rgba[i + 3]!;
  }
  return out;
}

/** Invert each colour channel, blended by `amount` (0 = none, 1 = full). */
export function invert(rgba: Rgba, amount = 1): Uint8ClampedArray {
  const a = Math.max(0, Math.min(1, amount));
  return mapChannels(rgba, (c) => c + (255 - c - c) * a);
}

/** Shift red/green/blue channels by signed deltas (colour balance). */
export function colorBalance(
  rgba: Rgba,
  rDelta: number,
  gDelta: number,
  bDelta: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    out[i] = clamp(rgba[i]! + rDelta);
    out[i + 1] = clamp(rgba[i + 1]! + gDelta);
    out[i + 2] = clamp(rgba[i + 2]! + bDelta);
    out[i + 3] = rgba[i + 3]!;
  }
  return out;
}

/**
 * Unsharp mask: sharpen by adding back the difference from a blurred copy.
 * Used by the legacy "texture" (small radius) and "dehaze" (large radius) effects.
 */
export function unsharpMask(
  rgba: Rgba,
  width: number,
  height: number,
  amount: number,
  radius = 2,
): Uint8ClampedArray {
  const blurred = boxBlur(rgba, width, height, Math.max(1, Math.round(radius)));
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const orig = rgba[i + c]!;
      out[i + c] = clamp(orig + (orig - blurred[i + c]!) * amount);
    }
    out[i + 3] = rgba[i + 3]!;
  }
  return out;
}

/**
 * Soften (`amount > 0`) or grow (`amount < 0`) the alpha edges of an image.
 * Ported from the legacy Effects.feather.
 */
export function feather(rgba: Rgba, width: number, height: number, amount: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba);
  const onEdge = (i: number) => i >= 0 && i < out.length && out[i + 3] === 0;
  if (amount > 0) {
    const edges: number[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (!out[i + 3]) continue;
        if (onEdge(i - 4) || onEdge(i + 4) || onEdge(i - width * 4) || onEdge(i + width * 4)) {
          edges.push(i);
        }
      }
    }
    for (const i of edges) out[i + 3] = out[i + 3]! >> 1;
  } else {
    const inc = -amount * 100;
    for (let i = 0; i < out.length; i += 4) {
      const a = out[i + 3]!;
      if (a < 255 && a > 0) out[i + 3] = Math.min(255, a + inc);
    }
  }
  return out;
}

/** Outline the opaque shape with a colour (1px halo on transparent neighbours). */
export function outline(
  rgba: Rgba,
  width: number,
  height: number,
  color: [number, number, number],
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba);
  const targets: number[] = [];
  const check = (i: number) => {
    if (out[i + 3] === 0) targets.push(i);
  };
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      if (!rgba[i + 3]) continue;
      check(i - 4);
      check(i + 4);
      check(i - width * 4);
      check(i + width * 4);
    }
  }
  for (const i of targets) {
    out[i] = color[0];
    out[i + 1] = color[1];
    out[i + 2] = color[2];
    out[i + 3] = 255;
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
