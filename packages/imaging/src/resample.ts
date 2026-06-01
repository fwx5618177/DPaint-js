/**
 * Quality resampling (bicubic + area-average) and alpha matting, ported from
 * the legacy imageProcessing helpers. Pure RGBA in / RGBA out.
 */

type Rgba = Uint8Array | Uint8ClampedArray;

function clamp(v: number, max: number): number {
  return v < 0 ? 0 : v > max ? max : v;
}

function cubic(t: number, a: number, b: number, c: number, d: number): number {
  return (
    0.5 *
    (c -
      a +
      (2 * a - 5 * b + 4 * c - d) * t +
      (3 * (b - c) + d - a) * t * t) *
      t +
    b
  );
}

/** Bicubic resize (good for upscaling; smooth). */
export function bicubicResize(rgba: Rgba, w: number, h: number, dw: number, dh: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(dw * dh * 4);
  const sample = (x: number, y: number, c: number): number => {
    const o = (clamp(y, h - 1) * w + clamp(x, w - 1)) * 4;
    return rgba[o + c]!;
  };
  for (let dy = 0; dy < dh; dy++) {
    const sy = ((dy + 0.5) * h) / dh - 0.5;
    const iy = Math.floor(sy);
    const ty = sy - iy;
    for (let dx = 0; dx < dw; dx++) {
      const sx = ((dx + 0.5) * w) / dw - 0.5;
      const ix = Math.floor(sx);
      const tx = sx - ix;
      const o = (dy * dw + dx) * 4;
      for (let c = 0; c < 4; c++) {
        const col = (yy: number) =>
          cubic(tx, sample(ix - 1, yy, c), sample(ix, yy, c), sample(ix + 1, yy, c), sample(ix + 2, yy, c));
        const value = cubic(ty, col(iy - 1), col(iy), col(iy + 1), col(iy + 2));
        out[o + c] = clamp(Math.round(value), 255);
      }
    }
  }
  return out;
}

/** Area-average downscale (box filter) — best quality when shrinking. */
export function areaDownscale(rgba: Rgba, w: number, h: number, dw: number, dh: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(dw * dh * 4);
  for (let dy = 0; dy < dh; dy++) {
    const y0 = Math.floor((dy * h) / dh);
    const y1 = Math.max(y0 + 1, Math.floor(((dy + 1) * h) / dh));
    for (let dx = 0; dx < dw; dx++) {
      const x0 = Math.floor((dx * w) / dw);
      const x1 = Math.max(x0 + 1, Math.floor(((dx + 1) * w) / dw));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = y0; y < y1 && y < h; y++) {
        for (let x = x0; x < x1 && x < w; x++) {
          const o = (y * w + x) * 4;
          r += rgba[o]!; g += rgba[o + 1]!; b += rgba[o + 2]!; a += rgba[o + 3]!; n++;
        }
      }
      const o = (dy * dw + dx) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

/** Pick area-average when shrinking, bicubic otherwise. */
export function resample(rgba: Rgba, w: number, h: number, dw: number, dh: number): Uint8ClampedArray {
  return dw < w || dh < h ? areaDownscale(rgba, w, h, dw, dh) : bicubicResize(rgba, w, h, dw, dh);
}

/**
 * Alpha matting / defringe: replace the colour of fully-transparent pixels with
 * the average colour of their opaque neighbours, so scaling/compositing does not
 * bleed a black or white halo at the edges.
 */
export function matte(rgba: Rgba, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (out[o + 3]! !== 0) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const no = (ny * w + nx) * 4;
          if (rgba[no + 3]! > 0) {
            r += rgba[no]!; g += rgba[no + 1]!; b += rgba[no + 2]!; n++;
          }
        }
      }
      if (n) {
        out[o] = Math.round(r / n);
        out[o + 1] = Math.round(g / n);
        out[o + 2] = Math.round(b / n);
      }
    }
  }
  return out;
}
