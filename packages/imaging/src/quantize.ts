import type { ColorArray } from "@dpaint/util";

/** Index of the palette entry closest to `rgb` (squared euclidean distance). */
export function nearestColorIndex(rgb: ArrayLike<number>, palette: ColorArray[]): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const p = palette[i]!;
    const dr = rgb[0]! - p[0]!;
    const dg = rgb[1]! - p[1]!;
    const db = rgb[2]! - p[2]!;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
      if (dist === 0) break;
    }
  }
  return best;
}

/** Map every RGBA pixel to its nearest palette index. */
export function quantizeToPalette(
  rgba: Uint8Array | Uint8ClampedArray,
  palette: ColorArray[],
): Uint8Array {
  const count = rgba.length / 4;
  const out = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    out[i] = nearestColorIndex([rgba[o]!, rgba[o + 1]!, rgba[o + 2]!], palette);
  }
  return out;
}

interface Box {
  pixels: number[][]; // [r,g,b]
}

function longestChannel(pixels: number[][]): 0 | 1 | 2 {
  const min = [255, 255, 255];
  const max = [0, 0, 0];
  for (const p of pixels) {
    for (let c = 0; c < 3; c++) {
      if (p[c]! < min[c]!) min[c] = p[c]!;
      if (p[c]! > max[c]!) max[c] = p[c]!;
    }
  }
  const ranges = [max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!];
  if (ranges[0] >= ranges[1] && ranges[0] >= ranges[2]) return 0;
  if (ranges[1] >= ranges[2]) return 1;
  return 2;
}

function averageColor(pixels: number[][]): ColorArray {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const p of pixels) {
    r += p[0]!;
    g += p[1]!;
    b += p[2]!;
  }
  const n = pixels.length || 1;
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

/**
 * Median-cut palette generation. Returns up to `maxColors` representative
 * colours for the opaque pixels of an RGBA buffer. Deterministic.
 */
export function medianCut(
  rgba: Uint8Array | Uint8ClampedArray,
  maxColors: number,
): ColorArray[] {
  const pixels: number[][] = [];
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3]! === 0) continue; // skip transparent
    pixels.push([rgba[i]!, rgba[i + 1]!, rgba[i + 2]!]);
  }
  if (pixels.length === 0) return [[0, 0, 0]];

  let boxes: Box[] = [{ pixels }];
  while (boxes.length < maxColors) {
    // pick the box with the most pixels that can still be split
    let target = -1;
    let targetSize = 1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i]!.pixels.length > targetSize) {
        targetSize = boxes[i]!.pixels.length;
        target = i;
      }
    }
    if (target === -1) break;

    const box = boxes[target]!;
    const channel = longestChannel(box.pixels);
    const sorted = box.pixels.slice().sort((a, b) => a[channel]! - b[channel]!);
    const mid = Math.floor(sorted.length / 2);
    const a = sorted.slice(0, mid);
    const b = sorted.slice(mid);
    if (a.length === 0 || b.length === 0) break;
    boxes = boxes.filter((_, i) => i !== target);
    boxes.push({ pixels: a }, { pixels: b });
  }

  return boxes.map((box) => averageColor(box.pixels));
}

/**
 * Build a palette from an image: if it has `<= maxColors` distinct colours,
 * return them exactly; otherwise reduce via {@link medianCut}.
 */
export function buildPaletteFromImage(
  rgba: Uint8Array | Uint8ClampedArray,
  maxColors: number,
): ColorArray[] {
  const seen = new Map<number, ColorArray>();
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3]! === 0) continue;
    const key = (rgba[i]! << 16) | (rgba[i + 1]! << 8) | rgba[i + 2]!;
    if (!seen.has(key)) seen.set(key, [rgba[i]!, rgba[i + 1]!, rgba[i + 2]!]);
    if (seen.size > maxColors) break;
  }
  if (seen.size <= maxColors && seen.size > 0) {
    return Array.from(seen.values());
  }
  return medianCut(rgba, maxColors);
}
