import { describe, it, expect } from "vitest";
import { encodePNG, decodePNG } from "../src/png.js";
import { detectFormat } from "../src/detect.js";

function makeImage(width: number, height: number, fn: (x: number, y: number) => number[]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fn(x, y);
      const i = (y * width + x) * 4;
      data[i] = r!;
      data[i + 1] = g!;
      data[i + 2] = b!;
      data[i + 3] = a ?? 255;
    }
  }
  return { width, height, data };
}

describe("PNG encode", () => {
  it("produces a valid PNG signature recognised by detectFormat", async () => {
    const png = await encodePNG(makeImage(2, 2, () => [255, 0, 0, 255]));
    expect(detectFormat(png)).toBe("PNG");
  });

  it("contains IHDR, IDAT and IEND chunks", async () => {
    const png = await encodePNG(makeImage(1, 1, () => [1, 2, 3, 4]));
    const text = String.fromCharCode(...png);
    expect(text).toContain("IHDR");
    expect(text).toContain("IDAT");
    expect(text).toContain("IEND");
  });
});

describe("PNG round-trip", () => {
  it("round-trips a solid colour", async () => {
    const img = makeImage(4, 4, () => [12, 34, 56, 255]);
    const decoded = await decodePNG(await encodePNG(img));
    expect(decoded.width).toBe(4);
    expect(decoded.height).toBe(4);
    expect(Array.from(decoded.data)).toEqual(Array.from(img.data));
  });

  it("round-trips a gradient with varying alpha", async () => {
    const img = makeImage(8, 6, (x, y) => [x * 30, y * 40, (x + y) * 10, x * 32]);
    const decoded = await decodePNG(await encodePNG(img));
    expect(Array.from(decoded.data)).toEqual(Array.from(img.data));
  });

  it("round-trips a checkerboard", async () => {
    const img = makeImage(5, 5, (x, y) => ((x + y) % 2 ? [255, 255, 255, 255] : [0, 0, 0, 255]));
    const decoded = await decodePNG(await encodePNG(img));
    expect(Array.from(decoded.data)).toEqual(Array.from(img.data));
  });

  it("preserves dimensions for a non-square image", async () => {
    const img = makeImage(7, 3, (x) => [x * 10, 0, 0, 255]);
    const decoded = await decodePNG(await encodePNG(img));
    expect(decoded.width).toBe(7);
    expect(decoded.height).toBe(3);
  });
});

describe("PNG decode errors", () => {
  it("rejects non-PNG input", async () => {
    await expect(decodePNG(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).rejects.toThrow(/PNG/);
  });
});
