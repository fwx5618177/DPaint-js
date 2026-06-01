import type { ColorArray } from "@dpaint/primitives";
import { quantizeToPalette } from "./quantize.js";

/**
 * Decompose an RGBA image into Amiga-style bit planes: quantize to the palette,
 * then for each bit a black/white RGBA image where white marks a set bit.
 */
export function bitplaneImages(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  palette: ColorArray[],
): Uint8ClampedArray[] {
  const indices = quantizeToPalette(rgba, palette);
  let planes = 1;
  while (1 << planes < palette.length) planes++;

  const out: Uint8ClampedArray[] = [];
  for (let p = 0; p < planes; p++) {
    const img = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < indices.length; i++) {
      const v = (indices[i]! >> p) & 1 ? 255 : 0;
      img[i * 4] = v;
      img[i * 4 + 1] = v;
      img[i * 4 + 2] = v;
      img[i * 4 + 3] = 255;
    }
    out.push(img);
  }
  return out;
}
