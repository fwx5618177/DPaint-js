import { describe, it, expect } from "vitest";
import {
  adjustBrightness,
  adjustContrast,
  posterize,
  threshold,
  boxBlur,
  adjustSaturation,
  hueRotate,
  sepia,
  invert,
  colorBalance,
  unsharpMask,
  outline,
} from "../src/effects.js";

function px(...colors: number[][]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(colors.length * 4);
  colors.forEach((c, i) => {
    out[i * 4] = c[0]!;
    out[i * 4 + 1] = c[1]!;
    out[i * 4 + 2] = c[2]!;
    out[i * 4 + 3] = c[3] ?? 255;
  });
  return out;
}

describe("adjustBrightness", () => {
  it("adds a delta and clamps", () => {
    expect(Array.from(adjustBrightness(px([100, 100, 100, 200]), 50))).toEqual([150, 150, 150, 200]);
    expect(Array.from(adjustBrightness(px([240, 0, 0]), 50))).toEqual([255, 50, 50, 255]);
  });
  it("preserves alpha", () => {
    expect(adjustBrightness(px([0, 0, 0, 123]), 10)[3]).toBe(123);
  });
});

describe("adjustContrast", () => {
  it("leaves mid-grey unchanged", () => {
    expect(Array.from(adjustContrast(px([128, 128, 128]), 2)).slice(0, 3)).toEqual([128, 128, 128]);
  });
  it("pushes values away from mid-grey", () => {
    const out = adjustContrast(px([160, 96, 128]), 2);
    expect(out[0]).toBe(192); // (160-128)*2+128
    expect(out[1]).toBe(64); // (96-128)*2+128
  });
});

describe("posterize", () => {
  it("snaps to the nearest level", () => {
    const out = posterize(px([10, 130, 250]), 2); // levels 0 and 255
    expect(Array.from(out).slice(0, 3)).toEqual([0, 255, 255]);
  });
  it("supports more levels", () => {
    const out = posterize(px([130, 130, 130]), 3); // levels 0,128,255
    expect(out[0]).toBe(128);
  });
});

describe("threshold", () => {
  it("splits on luma", () => {
    expect(Array.from(threshold(px([255, 255, 255]), 128)).slice(0, 3)).toEqual([255, 255, 255]);
    expect(Array.from(threshold(px([0, 0, 0]), 128)).slice(0, 3)).toEqual([0, 0, 0]);
  });
  it("uses Rec. 601 weighting", () => {
    // pure green luma = 0.587*255 ~= 150 -> above 128
    expect(threshold(px([0, 255, 0]), 128)[0]).toBe(255);
    // pure blue luma = 0.114*255 ~= 29 -> below 128
    expect(threshold(px([0, 0, 255]), 128)[0]).toBe(0);
  });
});

describe("boxBlur", () => {
  it("returns a copy for radius < 1", () => {
    const src = px([10, 20, 30], [40, 50, 60]);
    const out = boxBlur(src, 2, 1, 0);
    expect(Array.from(out)).toEqual(Array.from(src));
    expect(out).not.toBe(src);
  });
  it("averages neighbours deterministically", () => {
    // two-pixel row: [0,0,0] and [255,255,255]; radius 1 averages both -> ~128
    const out = boxBlur(px([0, 0, 0], [255, 255, 255]), 2, 1, 1);
    expect(out[0]).toBe(128);
    expect(out[4]).toBe(128);
  });
  it("leaves a uniform image unchanged", () => {
    const src = px([90, 90, 90], [90, 90, 90], [90, 90, 90], [90, 90, 90]);
    const out = boxBlur(src, 2, 2, 1);
    expect(out.every((v, i) => (i % 4 === 3 ? true : v === 90))).toBe(true);
  });
});

describe("adjustment effects", () => {
  it("desaturates to grey at amount 0", () => {
    const px = new Uint8ClampedArray([200, 100, 50, 255]);
    const out = adjustSaturation(px, 0);
    // all channels equal the luma
    expect(out[0]).toBe(out[1]);
    expect(out[1]).toBe(out[2]);
    expect(out[3]).toBe(255);
  });

  it("hueRotate 0° is (near) identity", () => {
    const px = new Uint8ClampedArray([120, 60, 200, 255]);
    const out = hueRotate(px, 0);
    expect(Math.abs(out[0]! - 120)).toBeLessThanOrEqual(2);
    expect(Math.abs(out[2]! - 200)).toBeLessThanOrEqual(2);
  });

  it("sepia warms a grey pixel", () => {
    const px = new Uint8ClampedArray([128, 128, 128, 255]);
    const out = sepia(px, 1);
    expect(out[0]!).toBeGreaterThan(out[2]!); // red channel > blue
  });

  it("invert flips channels fully at amount 1", () => {
    const px = new Uint8ClampedArray([0, 255, 10, 255]);
    const out = invert(px, 1);
    expect([out[0], out[1], out[2]]).toEqual([255, 0, 245]);
  });

  it("colorBalance shifts a single channel", () => {
    const px = new Uint8ClampedArray([100, 100, 100, 255]);
    const out = colorBalance(px, 50, 0, -20);
    expect(out[0]).toBe(150);
    expect(out[2]).toBe(80);
  });

  it("unsharpMask preserves dimensions and alpha", () => {
    const w = 3, h = 3;
    const px = new Uint8ClampedArray(w * h * 4).fill(128);
    for (let i = 3; i < px.length; i += 4) px[i] = 255;
    const out = unsharpMask(px, w, h, 1, 1);
    expect(out.length).toBe(px.length);
    expect(out[3]).toBe(255);
  });

  it("outline paints a halo around opaque content", () => {
    const w = 3, h = 3;
    const px = new Uint8ClampedArray(w * h * 4);
    // single opaque centre pixel
    const c = (1 * w + 1) * 4;
    px[c] = 200; px[c + 3] = 255;
    const out = outline(px, w, h, [255, 0, 0]);
    // a neighbouring transparent pixel is now red+opaque
    const up = (0 * w + 1) * 4;
    expect([out[up], out[up + 1], out[up + 2], out[up + 3]]).toEqual([255, 0, 0, 255]);
  });
});
