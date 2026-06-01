import { Color, type ColorArray } from "@dpaint/primitives";

/** Hardware colour depth presets. */
export type ColorDepth = 8 | 4 | 3;
// 8 = full 24-bit, 4 = Amiga OCS/ECS 12-bit, 3 = Atari ST 9-bit

/** Reduce a single colour to the given per-channel bit depth (then expand back). */
export function reduceColor(color: ColorArray, depth: ColorDepth): ColorArray {
  return (Color.setBitDepth(color, depth) ?? color) as ColorArray;
}

/** Reduce every pixel of an RGBA buffer to a hardware colour depth (alpha kept). */
export function reduceColorDepth(
  rgba: Uint8Array | Uint8ClampedArray,
  depth: ColorDepth,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const [r, g, b] = reduceColor([rgba[i]!, rgba[i + 1]!, rgba[i + 2]!], depth);
    out[i] = r!;
    out[i + 1] = g!;
    out[i + 2] = b!;
    out[i + 3] = rgba[i + 3]!;
  }
  return out;
}

/** Reduce a whole palette to a hardware colour depth. */
export function reducePalette(palette: ColorArray[], depth: ColorDepth): ColorArray[] {
  return palette.map((c) => reduceColor(c, depth));
}

/**
 * Amiga Extra-Half-Brite: extend a 32-colour palette to 64, where colours 32–63
 * are colours 0–31 at half brightness.
 */
export function extraHalfBrite(palette: ColorArray[]): ColorArray[] {
  const base = palette.slice(0, 32);
  const out: ColorArray[] = base.map((c) => c.slice() as ColorArray);
  for (let i = 0; i < 32; i++) {
    const c = base[i] ?? [0, 0, 0];
    out[32 + i] = [c[0]! >> 1, c[1]! >> 1, c[2]! >> 1];
  }
  return out;
}
