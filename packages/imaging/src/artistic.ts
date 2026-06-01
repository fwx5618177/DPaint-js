/**
 * Artistic "alchemy" filters ported from the legacy canvas/Math.random effects
 * to pure RGBA operations with an injectable, seeded RNG (deterministic by
 * default, so every filter is reproducible and unit-testable).
 */
import type { ColorArray } from "@dpaint/primitives";

type Rgba = Uint8Array | Uint8ClampedArray;
export type Rng = () => number;

/** Deterministic mulberry32 PRNG (default so filters are reproducible). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blendPixel(buf: Uint8ClampedArray, w: number, h: number, x: number, y: number, c: ColorArray, alpha: number): void {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= w || y >= h || alpha <= 0) return;
  const o = (y * w + x) * 4;
  const sa = Math.min(1, alpha);
  const da = buf[o + 3]! / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) return;
  for (let k = 0; k < 3; k++) {
    buf[o + k] = (c[k]! * sa + buf[o + k]! * da * (1 - sa)) / outA;
  }
  buf[o + 3] = outA * 255;
}

function fillCircle(buf: Uint8ClampedArray, w: number, h: number, cx: number, cy: number, r: number, c: ColorArray, alpha: number): void {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) blendPixel(buf, w, h, x, y, c, alpha);
    }
  }
}

function drawLine(buf: Uint8ClampedArray, w: number, h: number, x0: number, y0: number, x1: number, y1: number, c: ColorArray, alpha: number): void {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    blendPixel(buf, w, h, x0, y0, c, alpha);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function fillPolygon(buf: Uint8ClampedArray, w: number, h: number, pts: Array<[number, number]>, c: ColorArray, alpha: number): void {
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(h - 1, Math.ceil(maxY));
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const yi = pts[i]![1], yj = pts[j]![1];
      if ((yi > y) !== (yj > y)) {
        xs.push(pts[i]![0] + ((y - yi) / (yj - yi)) * (pts[j]![0] - pts[i]![0]));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.ceil(xs[i]!); x <= Math.floor(xs[i + 1]!); x++) blendPixel(buf, w, h, x, y, c, alpha);
    }
  }
}

function getColor(rgba: Rgba, w: number, x: number, y: number): ColorArray {
  const o = (y * w + x) * 4;
  return [rgba[o]!, rgba[o + 1]!, rgba[o + 2]!];
}

export interface DisplaceOptions {
  colWidth?: number;
  rowWidth?: number;
  hShift?: number;
  vShift?: number;
  rippleSpeed?: number;
  rippleSize?: number;
}

/** Slice the image into columns/rows and shift each by an increasing offset. Deterministic. */
export function displace(rgba: Rgba, w: number, h: number, opts: DisplaceOptions = {}): Uint8ClampedArray {
  const colWidth = opts.colWidth ?? 0;
  const rowWidth = opts.rowWidth ?? 2;
  const hShift = opts.hShift ?? -1;
  const vShift = opts.vShift ?? 0;
  const out = new Uint8ClampedArray(w * h * 4);

  const copyStrip = (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number) => {
    for (let y = 0; y < sh; y++) {
      const ty = dy + y;
      if (ty < 0 || ty >= h) continue;
      for (let x = 0; x < sw; x++) {
        const tx = dx + x;
        const px = sx + x;
        const py = sy + y;
        if (tx < 0 || tx >= w || px < 0 || px >= w || py < 0 || py >= h) continue;
        const so = (py * w + px) * 4;
        const to = (ty * w + tx) * 4;
        out[to] = rgba[so]!; out[to + 1] = rgba[so + 1]!; out[to + 2] = rgba[so + 2]!; out[to + 3] = rgba[so + 3]!;
      }
    }
  };

  if (colWidth) {
    const cols = Math.ceil(w / colWidth);
    for (let i = 0; i < cols; i++) {
      let y2 = vShift * i;
      if (opts.rippleSpeed && opts.rippleSize) y2 += Math.round(Math.sin(i / (100 - opts.rippleSpeed)) * opts.rippleSize);
      copyStrip(i * colWidth, 0, colWidth, h, i * colWidth + hShift * i, y2);
    }
  }
  if (rowWidth) {
    const rows = Math.ceil(h / rowWidth);
    for (let i = 0; i < rows; i++) {
      let x2 = hShift * i;
      if (opts.rippleSpeed && opts.rippleSize) x2 += Math.round(Math.sin(i / (100 - opts.rippleSpeed)) * opts.rippleSize);
      copyStrip(0, i * rowWidth, w, rowWidth, x2, i * rowWidth + vShift * i);
    }
  }
  return out;
}

/** Outline glow: paint rings of colour around opaque edges. Deterministic. */
export function glow(rgba: Rgba, w: number, h: number, colors: ColorArray[] = [[255, 255, 255], [255, 169, 151], [170, 144, 124]]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba);
  for (const color of colors) {
    const targets: number[] = [];
    const isClear = (i: number) => out[i + 3]! === 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        if (out[i + 3]!) {
          if (isClear(i - 4)) targets.push(i - 4);
          if (isClear(i + 4)) targets.push(i + 4);
          if (isClear(i - w * 4)) targets.push(i - w * 4);
          if (isClear(i + w * 4)) targets.push(i + w * 4);
        }
      }
    }
    for (const i of targets) {
      out[i] = color[0]!; out[i + 1] = color[1]!; out[i + 2] = color[2]!; out[i + 3] = 255;
    }
  }
  return out;
}

export interface SpeckleOptions { count?: number; darkAlpha?: number; lightAlpha?: number; jitter?: number; }

/** Scatter translucent dark + light speckles over the image. */
export function speckles(rgba: Rgba, w: number, h: number, opts: SpeckleOptions = {}, rng: Rng = mulberry32(1)): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba);
  const count = opts.count ?? 500;
  const dark = (opts.darkAlpha ?? 3) / 100;
  const light = (opts.lightAlpha ?? 6) / 100;
  const dot = (c: ColorArray, a: number) => {
    const x = Math.floor(rng() * w);
    const y = Math.floor(rng() * h);
    fillCircle(out, w, h, x, y, 1, c, a);
  };
  for (let i = 0; i < count; i++) {
    if (dark) dot([0, 0, 0], dark);
    if (light) dot([255, 255, 255], light);
  }
  return out;
}

export interface LinesOptions { lineCount?: number; hShift?: number; vShift?: number; }

/** Draw many faint streak-lines following the image. */
export function lines(rgba: Rgba, w: number, h: number, opts: LinesOptions = {}, rng: Rng = mulberry32(1)): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba);
  const lineCount = opts.lineCount ?? 500;
  const hShiftBase = opts.hShift ?? 35;
  const vShift = opts.vShift ?? 2;
  const lineSet = (color: ColorArray, alpha: number) => {
    const x = Math.floor(rng() * w) - hShiftBase / 2 + 5;
    const y = Math.floor(rng() * h);
    const xOff = hShiftBase + rng() * 10;
    const yOff = -vShift + rng() * 2;
    for (let i = 0; i < 4; i++) {
      const d = 4 * i;
      drawLine(out, w, h, x, y + d, x + xOff, y + yOff + d, color, alpha / (1 << i));
    }
  };
  for (let i = 0; i < lineCount; i++) {
    lineSet([0, 0, 0], 0.1);
    lineSet([0, 0, 0], 0.2);
    lineSet([255, 255, 255], 0.08);
  }
  return out;
}

export interface WebOptions { starPointCount?: number; starSize?: number; sizeVariation?: number; dabbleCount?: number; transparency?: number; }

/** "Spider web" — translucent polygons sampling the underlying colours. */
export function web(rgba: Rgba, w: number, h: number, opts: WebOptions = {}, rng: Rng = mulberry32(1)): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba);
  const starPointCount = opts.starPointCount ?? 10;
  const starSize = opts.starSize ?? 25;
  const sizeVariation = opts.sizeVariation ?? 100;
  const dabbleCount = opts.dabbleCount ?? 200;
  const transparency = (opts.transparency ?? 5) / 100;
  const r = (size: number) => rng() * size - size / 2;
  for (let d = 0; d < dabbleCount; d++) {
    const x = Math.floor(rng() * w);
    const y = Math.floor(rng() * h);
    const color = getColor(rgba, w, x, y);
    for (let p = 0; p < 10; p++) {
      const pts: Array<[number, number]> = [[x, y]];
      for (let i = 0; i < starPointCount; i++) {
        pts.push([x + r(starSize + r(sizeVariation)), y + r(starSize + r(sizeVariation))]);
      }
      fillPolygon(out, w, h, pts, color, transparency);
    }
  }
  return out;
}

export interface DotsOptions { count?: number; dotRadius?: number; radiusJitter?: number; positionJitter?: number; alpha?: number; }

/** Pointillism: scatter translucent dots that sample the underlying image colour. */
export function dots(rgba: Rgba, w: number, h: number, opts: DotsOptions = {}, rng: Rng = mulberry32(1)): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba);
  const count = opts.count ?? 500;
  const radius = opts.dotRadius ?? 5;
  const radiusJitter = opts.radiusJitter ?? 5;
  const posJitter = opts.positionJitter ?? 50;
  const alpha = (opts.alpha ?? 10) / 100;
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rng() * w);
    const y = Math.floor(rng() * h);
    const color = getColor(rgba, w, x, y);
    for (let s = 0; s < 20; s++) {
      const sx = x + rng() * posJitter - posJitter / 2;
      const sy = y + rng() * posJitter - posJitter / 2;
      let r = radius + rng() * radiusJitter - radiusJitter / 2;
      if (r < 1) r = 1;
      fillCircle(out, w, h, sx, sy, r, color, alpha);
    }
  }
  return out;
}

export interface RippleOptions { frame?: number; refraction?: number; reflection?: number; dropX?: number; dropY?: number; }

/** Water-ripple refraction (deterministic simulation). */
export function ripples(rgba: Rgba, w: number, h: number, opts: RippleOptions = {}): Uint8ClampedArray {
  const frame = opts.frame ?? 1;
  const lightRefraction = (opts.refraction ?? 55) / 10;
  const lightReflection = (opts.reflection ?? 10) / 100;
  const resolution = 2;
  const damping = 0.999;
  const clipping = 5;
  const gw = Math.ceil(w / resolution);
  const gh = Math.ceil(h / resolution);

  let map1: number[][] = Array.from({ length: gw }, () => new Array<number>(gh).fill(0));
  let map2: number[][] = Array.from({ length: gw }, () => new Array<number>(gh).fill(0));

  // radial-ish drop brush
  const dropX = Math.floor((opts.dropX ?? Math.floor(w / 2)) / resolution);
  const dropY = Math.floor((opts.dropY ?? Math.floor(h / 2)) / resolution);
  const brush = 15;
  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      const x = dropX + i;
      const y = dropY + j;
      if (x >= 0 && y >= 0 && x < gw && y < gh) {
        map1[x]![y] = (map1[x]![y] ?? 0) - (1 - Math.min(1, Math.hypot(i, j) / 4)) * brush;
      }
    }
  }

  const targetFrame = Math.min(frame * 4, 200);
  for (let f = 0; f < targetFrame; f++) {
    for (let x = 0; x < gw; x++) {
      for (let y = 0; y < gh; y++) {
        let val =
          (x === 0 ? 0 : map1[x - 1]![y]!) +
          (x === gw - 1 ? 0 : map1[x + 1]![y]!) +
          (y === 0 ? 0 : map1[x]![y - 1]!) +
          (y === gh - 1 ? 0 : map1[x]![y + 1]!);
        val = (val / 2 - map2[x]![y]!) * damping;
        if (val > clipping) val = clipping;
        if (val < -clipping) val = -clipping;
        map2[x]![y] = val;
      }
    }
    const swap = map1;
    map1 = map2;
    map2 = swap;
  }

  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const x = i % w;
    const y = (i - x) / w;
    const strength = map1[Math.floor(x / resolution)]?.[Math.floor(y / resolution)] ?? 0;
    const refraction = Math.round(strength * lightRefraction);
    const xPix = Math.min(w - 1, Math.max(0, x + refraction));
    const yPix = Math.min(h - 1, Math.max(0, y + refraction));
    const src = (yPix * w + xPix) * 4;
    const mul = strength * lightReflection + 1;
    const o = i * 4;
    out[o] = rgba[src]! * mul;
    out[o + 1] = rgba[src + 1]! * mul;
    out[o + 2] = rgba[src + 2]! * mul;
    out[o + 3] = rgba[(y * w + x) * 4 + 3]!;
  }
  return out;
}
