import { describe, it, expect } from "vitest";
import { decodeLine, validateLine, encodeLine, type ByteSource } from "../src/byteRun1.js";

/** Wrap a byte array in the minimal ByteSource the codec expects. */
function source(bytes: number[]): ByteSource {
  const arr = new Uint8Array(bytes);
  return {
    dataView: new DataView(arr.buffer),
    index: 0,
    goto(v: number) {
      this.index = v;
    },
  };
}

describe("ByteRun1.decodeLine", () => {
  it("decodes a literal run (control 0..127)", () => {
    // control=2 -> 3 literal bytes
    const file = source([2, 10, 20, 30]);
    const result = decodeLine(file, 0, 3, file.dataView.byteLength);
    expect(Array.from(result.line)).toEqual([10, 20, 30]);
    expect(result.valid).toBe(true);
    expect(result.index).toBe(4);
  });

  it("decodes a repeat run (control 129..255)", () => {
    // control=257-4=253 -> 4 copies of 0xAB
    const file = source([253, 0xab]);
    const result = decodeLine(file, 0, 4, file.dataView.byteLength);
    expect(Array.from(result.line)).toEqual([0xab, 0xab, 0xab, 0xab]);
    expect(result.valid).toBe(true);
  });

  it("treats 0x80 as a no-op by default", () => {
    const file = source([128, 0, 10]); // 0x80 skipped, then control=0 -> 1 literal
    const result = decodeLine(file, 0, 1, file.dataView.byteLength);
    expect(Array.from(result.line)).toEqual([10]);
    expect(result.valid).toBe(true);
  });

  it("treats 0x80 as a 129-byte run when repeat128 is set", () => {
    const file = source([128, 7]);
    const result = decodeLine(file, 0, 129, file.dataView.byteLength, true);
    expect(result.line.every((b) => b === 7)).toBe(true);
    expect(result.extendedRuns).toBe(1);
    expect(result.valid).toBe(true);
  });

  it("flags an invalid line that overflows the width", () => {
    const file = source([253, 0xab]); // 4 copies but width is 2
    const result = decodeLine(file, 0, 2, file.dataView.byteLength);
    expect(result.valid).toBe(false);
  });
});

describe("ByteRun1.validateLine", () => {
  it("validates a well-formed mixed line", () => {
    // 3 literals then 4 repeats = 7 bytes
    const file = source([2, 1, 2, 3, 253, 9]);
    const result = validateLine(file, 0, 7, file.dataView.byteLength);
    expect(result.valid).toBe(true);
  });

  it("rejects truncated data", () => {
    const file = source([2, 1, 2]); // claims 3 literals but only 2 present
    const result = validateLine(file, 0, 3, file.dataView.byteLength);
    expect(result.valid).toBe(false);
  });
});

describe("ByteRun1 encode/decode round-trip", () => {
  const cases: number[][] = [
    [10, 20, 30, 40],
    [5, 5, 5, 5, 5, 5],
    [1, 1, 1, 2, 3, 4, 4, 4, 4, 9],
    Array.from({ length: 200 }, (_, i) => i % 7),
    Array.from({ length: 130 }, () => 0xff), // > 128 run
    [],
  ];

  for (const original of cases) {
    it(`round-trips a ${original.length}-byte line`, () => {
      const encoded = encodeLine(original);
      const file = source(Array.from(encoded));
      const result = decodeLine(file, 0, original.length, encoded.length);
      expect(result.valid).toBe(true);
      expect(Array.from(result.line)).toEqual(original);
    });
  }

  it("produces a compact encoding for long runs", () => {
    const encoded = encodeLine(Array.from({ length: 128 }, () => 0));
    // a single 128-byte run should encode to 2 bytes
    expect(encoded.length).toBe(2);
  });
});
