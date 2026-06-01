/**
 * Colour maths ported from the original DPaint.js `Color` singleton.
 *
 * Colours are represented either as a CSS-ish string (`"rgb(..)"`, `"#rrggbb"`)
 * or as a numeric channel array (`[r, g, b]` or `[r, g, b, a]`, 0-255). The
 * functions are deliberately permissive about their input to stay
 * behaviour-compatible with the legacy implementation.
 */

export type ColorArray = number[];
export type ColorInput = string | ColorArray;

function hexByte(nr: number | string): string {
  const n = typeof nr === "string" ? parseInt(nr) : nr;
  let result = n.toString(16);
  if (result.length === 1) result = "0" + result;
  return result;
}

/** Render a colour array as a `rgb(r,g,b)` string. Strings pass through. */
export function toString(color: ColorInput): string {
  if (typeof color === "object" && color.length) {
    return "rgb(" + color[0] + "," + color[1] + "," + color[2] + ")";
  }
  return color as string;
}

/** Parse a colour string (`rgb(..)` or `#hex`) into a channel array. */
export function fromString(color: ColorInput): ColorArray {
  if (typeof color === "object") {
    color.forEach((c, i) => {
      color[i] = parseInt(c as unknown as string);
    });
    return color;
  }
  if (color.indexOf("rgb") === 0) {
    const parts = color.split("(")[1]!.split(")")[0]!.split(",");
    if (parts.length === 4)
      return [parseInt(parts[0]!), parseInt(parts[1]!), parseInt(parts[2]!), parseInt(parts[3]!)];
    return [parseInt(parts[0]!), parseInt(parts[1]!), parseInt(parts[2]!)];
  }
  if (color.indexOf("#") === 0) {
    const r = parseInt(color.substr(1, 2), 16);
    const g = parseInt(color.substr(3, 2), 16);
    const b = parseInt(color.substr(5, 2), 16);
    if (color.length === 9) return [r, g, b, parseInt(color.substr(7, 2), 16)];
    return [r, g, b];
  }
  return color as unknown as ColorArray;
}

/** Convert a colour to a `#rrggbb`(`aa`) hex string. */
export function toHex(color: ColorInput): string | undefined {
  if (typeof color === "string") color = fromString(color);
  if (typeof color === "object" && color.length) {
    let result = "#" + hexByte(color[0]!) + hexByte(color[1]!) + hexByte(color[2]!);
    if (color.length === 4) result += hexByte(color[3]!);
    return result;
  }
  return undefined;
}

/** Convert RGB to HSV. With `maxRange`, returns H in 0-360 and S/V in 0-100. */
export function toHSV(color: ColorInput, maxRange?: boolean): ColorArray | undefined {
  if (typeof color === "string") color = fromString(color);
  if (typeof color === "object" && color.length) {
    const r = color[0]! / 255;
    const g = color[1]! / 255;
    const b = color[2]! / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s: number;
    const v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max === min) {
      h = 0; // shade of gray
    } else {
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }
    if (maxRange) {
      h = Math.round(h * 360);
      s = Math.round(s * 100);
      return [h, s, Math.round(v * 100)];
    }
    return [h, s, v];
  }
  return undefined;
}

/** Convert HSV (0-1 ranges) to an RGB array. */
export function fromHSV(h: number, s: number, v: number): ColorArray {
  let r = 0;
  let g = 0;
  let b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/** Convert RGB to CIE-LAB (D65). */
export function toLAB(color: ColorInput): ColorArray | undefined {
  if (typeof color === "string") color = fromString(color);
  if (typeof color === "object" && color.length) {
    let r = color[0]! / 255;
    let g = color[1]! / 255;
    let b = color[2]! / 255;
    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    let y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
    y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
    z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  return undefined;
}

/** Simple euclidean RGB(A) distance. Fast but not perceptually uniform. */
export function distance(color1: ColorInput, color2: ColorInput): number {
  const c1 = fromString(color1);
  const c2 = fromString(color2);
  const r = c1[0]! - c2[0]!;
  const g = c1[1]! - c2[1]!;
  const b = c1[2]! - c2[2]!;
  if (c1.length === 4 && c2.length === 4) {
    const a = c1[3]! - c2[3]!;
    return Math.sqrt(r * r + g * g + b * b + a * a);
  }
  return Math.sqrt(r * r + g * g + b * b);
}

/** Euclidean distance in HSV space. */
export function distanceHSV(color1: ColorInput, color2: ColorInput): number {
  const c1 = toHSV(color1)!;
  const c2 = toHSV(color2)!;
  const h = c1[0]! - c2[0]!;
  const s = c1[1]! - c2[1]!;
  const v = c1[2]! - c2[2]!;
  return Math.sqrt(h * h + s * s + v * v);
}

/** Euclidean distance in LAB space (Delta-E 76). */
export function distanceLAB(color1: ColorInput, color2: ColorInput): number {
  const c1 = toLAB(color1)!;
  const c2 = toLAB(color2)!;
  const l = c1[0]! - c2[0]!;
  const a = c1[1]! - c2[1]!;
  const b = c1[2]! - c2[2]!;
  return Math.sqrt(l * l + a * a + b * b);
}

export function hue(color: ColorInput): number {
  return toHSV(color)![0]!;
}

export function lightness(color: ColorInput): number {
  return toHSV(color)![2]!;
}

export function saturation(color: ColorInput): number {
  return toHSV(color)![1]!;
}

/** Linearly blend two colours; `amount` 0 → color1, 1 → color2. */
export function blend(color1: ColorInput, color2: ColorInput, amount: number): ColorArray {
  const remaining = 1 - amount;
  const c1 = fromString(color1);
  const c2 = fromString(color2);
  return [
    Math.round(c1[0]! * remaining + c2[0]! * amount),
    Math.round(c1[1]! * remaining + c2[1]! * amount),
    Math.round(c1[2]! * remaining + c2[2]! * amount),
  ];
}

/** Compare two colours by RGB channels (ignores alpha). */
export function equals(color1: ColorInput, color2: ColorInput): boolean {
  const c1 = fromString(color1);
  const c2 = fromString(color2);
  return c1[0] === c2[0] && c1[1] === c2[1] && c1[2] === c2[2];
}

/** Quantize a colour to a hardware bit depth (8 / 4 / 3 bits per channel). */
export function setBitDepth(color: ColorInput, depth: number): ColorArray | undefined {
  const c = fromString(color);
  if (depth === 8) return c;
  if (depth === 4) return to24bit(to12bit(c), depth);
  if (depth === 3) return to24bit(to9bit(c), depth);
  return undefined;
}

/** Expand a reduced-depth colour back to full 24-bit range. */
export function to24bit(color: ColorInput, depth = 8): ColorArray {
  const c = fromString(color);
  let r = c[0]!;
  let g = c[1]!;
  let b = c[2]!;
  if (depth === 4) {
    r = Math.min((r << 4) + r, 255);
    g = Math.min((g << 4) + g, 255);
    b = Math.min((b << 4) + b, 255);
  }
  if (depth === 3) {
    r = Math.min((r << 5) + (r << 1), 255);
    g = Math.min((g << 5) + (g << 1), 255);
    b = Math.min((b << 5) + (b << 1), 255);
  }
  return [r, g, b];
}

/** Reduce to 12-bit (Amiga OCS/ECS, 4 bits per channel). */
export function to12bit(color: ColorArray): ColorArray {
  return [color[0]! >> 4, color[1]! >> 4, color[2]! >> 4];
}

/** Reduce to 9-bit (Atari ST, 3 bits per channel). */
export function to9bit(color: ColorArray): ColorArray {
  return [color[0]! >> 5, color[1]! >> 5, color[2]! >> 5];
}

/** Render a colour as an Amiga OCS hex string, e.g. `0xfff`. */
export function toOCSString(color: ColorArray): string {
  const c = to12bit(color);
  return "0x" + c[0]!.toString(16) + c[1]!.toString(16) + c[2]!.toString(16);
}

const Color = {
  toString,
  fromString,
  toHex,
  toHSV,
  fromHSV,
  toLAB,
  distance,
  distanceHSV,
  distanceLAB,
  hue,
  lightness,
  saturation,
  blend,
  equals,
  setBitDepth,
  to24bit,
  to12bit,
  to9bit,
  toOCSString,
};

export default Color;
