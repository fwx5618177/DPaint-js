/**
 * Arbitrary-angle rotation (the RotSprite feature, nearest-neighbour core) and
 * the StackBlur algorithm — pure RGBA operations.
 */

type Rgba = Uint8Array | Uint8ClampedArray;

export interface RotatedImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/**
 * Rotate an image by `angleDeg` degrees (clockwise) about its centre,
 * nearest-neighbour, expanding the canvas to fit. Pixels outside the source are
 * transparent.
 */
export function rotateArbitrary(rgba: Rgba, w: number, h: number, angleDeg: number): RotatedImage {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners: Array<[number, number]> = [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ];
  const xs = corners.map(([x, y]) => x * cos - y * sin);
  const ys = corners.map(([x, y]) => x * sin + y * cos);
  const nw = Math.max(1, Math.ceil(Math.max(...xs) - Math.min(...xs)));
  const nh = Math.max(1, Math.ceil(Math.max(...ys) - Math.min(...ys)));
  const out = new Uint8ClampedArray(nw * nh * 4);
  const cx = w / 2;
  const cy = h / 2;
  const ncx = nw / 2;
  const ncy = nh / 2;
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const dx = x - ncx;
      const dy = y - ncy;
      const sx = Math.round(dx * cos + dy * sin + cx);
      const sy = Math.round(-dx * sin + dy * cos + cy);
      if (sx >= 0 && sy >= 0 && sx < w && sy < h) {
        const so = (sy * w + sx) * 4;
        const o = (y * nw + x) * 4;
        out[o] = rgba[so]!;
        out[o + 1] = rgba[so + 1]!;
        out[o + 2] = rgba[so + 2]!;
        out[o + 3] = rgba[so + 3]!;
      }
    }
  }
  return { width: nw, height: nh, data: out };
}

/**
 * StackBlur (Mario Klingemann) — a fast, high-quality box-ish blur. Separable
 * horizontal+vertical passes with a triangular stack kernel. Alpha preserved.
 */
export function stackBlur(rgba: Rgba, w: number, h: number, radius: number): Uint8ClampedArray {
  if (radius < 1) return new Uint8ClampedArray(rgba);
  const out = new Uint8ClampedArray(rgba);
  const weightSum = (radius + 1) * (radius + 1);

  // horizontal pass (triangular kernel, edge-clamped)
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 4; c++) {
      const rowOffset = y * w * 4 + c;
      const line = new Float32Array(w);
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let i = -radius; i <= radius; i++) {
          const xx = Math.min(w - 1, Math.max(0, x + i));
          sum += out[rowOffset + xx * 4]! * (radius + 1 - Math.abs(i));
        }
        line[x] = sum / weightSum;
      }
      for (let x = 0; x < w; x++) out[rowOffset + x * 4] = Math.round(line[x]!);
    }
  }
  // vertical pass
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 4; c++) {
      const colOffset = x * 4 + c;
      const line = new Float32Array(h);
      for (let y = 0; y < h; y++) {
        let sum = 0;
        for (let i = -radius; i <= radius; i++) {
          const yy = Math.min(h - 1, Math.max(0, y + i));
          sum += out[yy * w * 4 + colOffset]! * (radius + 1 - Math.abs(i));
        }
        line[y] = sum / weightSum;
      }
      for (let y = 0; y < h; y++) out[y * w * 4 + colOffset] = Math.round(line[y]!);
    }
  }
  return out;
}
