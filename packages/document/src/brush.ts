import type { PixelRegion } from "./ImageDocument.js";

/** Rotate a detached pixel region by 90° (left = counter-clockwise). */
export function rotateRegion(region: PixelRegion, left: boolean): PixelRegion {
  const { width: w, height: h, data } = region;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const so = (y * w + x) * 4;
      // new dimensions are h×w
      const nx = left ? y : h - 1 - y;
      const ny = left ? w - 1 - x : x;
      const to = (ny * h + nx) * 4;
      out[to] = data[so]!;
      out[to + 1] = data[so + 1]!;
      out[to + 2] = data[so + 2]!;
      out[to + 3] = data[so + 3]!;
    }
  }
  return { width: h, height: w, data: out };
}

/** Mirror a detached pixel region horizontally or vertically. */
export function flipRegion(region: PixelRegion, horizontal: boolean): PixelRegion {
  const { width: w, height: h, data } = region;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const so = (y * w + x) * 4;
      const tx = horizontal ? w - 1 - x : x;
      const ty = horizontal ? y : h - 1 - y;
      const to = (ty * w + tx) * 4;
      out[to] = data[so]!;
      out[to + 1] = data[so + 1]!;
      out[to + 2] = data[so + 2]!;
      out[to + 3] = data[so + 3]!;
    }
  }
  return { width: w, height: h, data: out };
}
