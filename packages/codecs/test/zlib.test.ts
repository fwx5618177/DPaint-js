import { describe, it, expect } from "vitest";
import { deflate, inflate } from "../src/zlib.js";

describe("zlib deflate/inflate", () => {
  it("round-trips arbitrary bytes", async () => {
    const data = new Uint8Array(Array.from({ length: 1000 }, (_, i) => (i * 7) % 256));
    const compressed = await deflate(data);
    const restored = await inflate(compressed);
    expect(Array.from(restored)).toEqual(Array.from(data));
  });

  it("round-trips highly compressible data and shrinks it", async () => {
    const data = new Uint8Array(2048).fill(42);
    const compressed = await deflate(data);
    expect(compressed.length).toBeLessThan(data.length);
    const restored = await inflate(compressed);
    expect(restored.length).toBe(data.length);
    expect(restored.every((b) => b === 42)).toBe(true);
  });

  it("round-trips empty input", async () => {
    const restored = await inflate(await deflate(new Uint8Array(0)));
    expect(restored.length).toBe(0);
  });
});
