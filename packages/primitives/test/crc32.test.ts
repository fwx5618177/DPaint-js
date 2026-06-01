import { describe, it, expect } from "vitest";
import { get } from "../src/crc32.js";

const bytes = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

describe("CRC32.get", () => {
  it("matches the well-known checksum of 'The quick brown fox jumps over the lazy dog'", () => {
    expect(get(bytes("The quick brown fox jumps over the lazy dog"))).toBe(0x414fa339);
  });
  it("computes the standard '123456789' check value", () => {
    expect(get(bytes("123456789"))).toBe(0xcbf43926);
  });
  it("returns 0 for empty input", () => {
    expect(get([])).toBe(0);
  });
  it("returns an unsigned 32-bit integer", () => {
    const v = get(bytes("a"));
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(0xffffffff);
  });
  it("accepts typed arrays", () => {
    expect(get(new Uint8Array([49, 50, 51, 52, 53, 54, 55, 56, 57]))).toBe(0xcbf43926);
  });
});
