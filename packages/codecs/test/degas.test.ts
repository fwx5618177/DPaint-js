import { describe, it, expect } from "vitest";
import { BinaryStream } from "@dpaint/primitives";
import { decodeDEGAS } from "../src/degas.js";
import { detectFormat } from "../src/detect.js";

/** Build a low-res (320×200, 4 planes) DEGAS PI1 with pixel (0,0)=index 1. */
function buildPi1(): Uint8Array {
  const total = 2 + 32 + 32000;
  const f = new BinaryStream(new ArrayBuffer(total), true);
  f.writeWord(0); // resolution: low
  // palette: index 0 = red (r=7), index 1 = green (g=7), rest 0
  f.writeWord(0x700);
  f.writeWord(0x070);
  for (let i = 2; i < 16; i++) f.writeWord(0);
  // body starts at offset 34; first word = line0/group0/plane0; set bit15 => x=0 plane0
  f.writeWord(0x8000); // remaining 31998 bytes stay zero
  return new Uint8Array(f.buffer);
}

describe("decodeDEGAS (PI1)", () => {
  it("is detected as DEGAS by extension", () => {
    expect(detectFormat(buildPi1(), "art.pi1")).toBe("DEGAS");
  });

  it("decodes resolution, dimensions and palette-mapped pixels", () => {
    const d = decodeDEGAS(buildPi1());
    expect(d.width).toBe(320);
    expect(d.height).toBe(200);
    expect(d.palette).toHaveLength(16);
    // index 1 (green) at (0,0); index 0 (red) at (1,0)
    expect([d.data[0], d.data[1], d.data[2], d.data[3]]).toEqual([0, 255, 0, 255]);
    expect([d.data[4], d.data[5], d.data[6], d.data[7]]).toEqual([255, 0, 0, 255]);
  });

  it("rejects an unsupported resolution", () => {
    const f = new BinaryStream(new ArrayBuffer(34), true);
    f.writeWord(9);
    expect(() => decodeDEGAS(new Uint8Array(f.buffer))).toThrow();
  });
});
