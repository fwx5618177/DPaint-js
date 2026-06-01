import type { ColorArray } from "@dpaint/util";

/** A contiguous palette range that animates (Amiga-style colour cycling). */
export interface ColorRange {
  /** first palette index in the range (inclusive) */
  low: number;
  /** last palette index in the range (inclusive) */
  high: number;
  /** cycle direction; default forward (indices move toward `high`) */
  reverse?: boolean;
  /** whether this range participates; default true */
  active?: boolean;
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Return a copy of `palette` with each active range rotated by `step` positions.
 * Pure and deterministic — the renderer maps an index image through the rotated
 * palette to produce one animation frame, without touching pixel data.
 *
 * Forward (default): the colour at `low + i` becomes the colour previously at
 * `low + ((i - step) mod len)`, i.e. colours shift toward `high` and wrap.
 */
export function cyclePalette(
  palette: ColorArray[],
  ranges: ColorRange[],
  step: number,
): ColorArray[] {
  const out = palette.map((c) => c.slice() as ColorArray);
  for (const range of ranges) {
    if (range.active === false) continue;
    const lo = Math.max(0, range.low);
    const hi = Math.min(palette.length - 1, range.high);
    const len = hi - lo + 1;
    if (len <= 1) continue;
    const dir = range.reverse ? -1 : 1;
    for (let i = 0; i < len; i++) {
      const src = lo + mod(i - dir * step, len);
      out[lo + i] = palette[src]!.slice() as ColorArray;
    }
  }
  return out;
}
