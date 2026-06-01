/**
 * Artistic "alchemy" filters, ported as pure, deterministic RGBA operations
 * (the legacy versions were canvas + Math.random based).
 */

type Rgba = Uint8Array | Uint8ClampedArray;

/** Wrap-around offset: shift the image by (dx, dy), wrapping at the edges. */
export function offset(rgba: Rgba, width: number, height: number, dx: number, dy: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length);
  const sx = ((dx % width) + width) % width;
  const sy = ((dy % height) + height) % height;
  for (let y = 0; y < height; y++) {
    const srcY = (y - sy + height) % height;
    for (let x = 0; x < width; x++) {
      const srcX = (x - sx + width) % width;
      const so = (srcY * width + srcX) * 4;
      const dofs = (y * width + x) * 4;
      out[dofs] = rgba[so]!;
      out[dofs + 1] = rgba[so + 1]!;
      out[dofs + 2] = rgba[so + 2]!;
      out[dofs + 3] = rgba[so + 3]!;
    }
  }
  return out;
}

function median(values: number[]): number {
  values.sort((a, b) => a - b);
  const mid = values.length >> 1;
  return values.length % 2 ? values[mid]! : Math.round((values[mid - 1]! + values[mid]!) / 2);
}

/** Median smooth ("mediansmoove"): replace each pixel with the per-channel median of its neighbourhood. */
export function medianFilter(rgba: Rgba, width: number, height: number, radius = 1): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const r: number[] = [];
      const g: number[] = [];
      const b: number[] = [];
      const a: number[] = [];
      for (let ky = -radius; ky <= radius; ky++) {
        const yy = y + ky;
        if (yy < 0 || yy >= height) continue;
        for (let kx = -radius; kx <= radius; kx++) {
          const xx = x + kx;
          if (xx < 0 || xx >= width) continue;
          const o = (yy * width + xx) * 4;
          r.push(rgba[o]!);
          g.push(rgba[o + 1]!);
          b.push(rgba[o + 2]!);
          a.push(rgba[o + 3]!);
        }
      }
      const dofs = (y * width + x) * 4;
      out[dofs] = median(r);
      out[dofs + 1] = median(g);
      out[dofs + 2] = median(b);
      out[dofs + 3] = median(a);
    }
  }
  return out;
}

/** Simple 3×3 sharpen convolution (alpha preserved). */
export function sharpen(rgba: Rgba, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length);
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let k = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const xx = Math.min(width - 1, Math.max(0, x + kx));
            const yy = Math.min(height - 1, Math.max(0, y + ky));
            sum += rgba[(yy * width + xx) * 4 + c]! * kernel[k]!;
            k++;
          }
        }
        out[(y * width + x) * 4 + c] = Math.min(255, Math.max(0, sum));
      }
      out[(y * width + x) * 4 + 3] = rgba[(y * width + x) * 4 + 3]!;
    }
  }
  return out;
}
