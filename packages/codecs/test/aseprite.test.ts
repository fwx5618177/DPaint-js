import { describe, it, expect } from "vitest";
import { BinaryStream } from "@dpaint/primitives";
import { decodeAseprite } from "../src/aseprite.js";
import { detectFormat } from "../src/detect.js";

/** Build a minimal 1×1, 1-layer, raw-cel Aseprite with pixel [200,100,50,255]. */
function buildAse(): Uint8Array {
  const nameLen = 1; // "L"
  const layerChunkSize = 6 + 18 + nameLen; // 25
  const celChunkSize = 6 + 16 + 4 + 4; // header + cel header + w/h + 1 RGBA px = 30
  const frameBytes = 16 + layerChunkSize + celChunkSize;
  const total = 128 + frameBytes;
  const f = new BinaryStream(new ArrayBuffer(total), false); // little-endian

  // --- header (128 bytes) ---
  f.writeUint(total); // file size
  f.writeWord(0xa5e0); // magic
  f.writeWord(1); // frames
  f.writeWord(1); // width
  f.writeWord(1); // height
  f.writeWord(32); // depth
  f.writeUint(0); // flags
  f.writeWord(0); // speed
  f.fill(0, 8); // reserved
  f.writeUbyte(0); // transparent index
  f.fill(0, 3);
  f.writeWord(0); // colour count
  f.writeUbyte(1); // pixel width
  f.writeUbyte(1); // pixel height
  f.writeWord(0); // gridX (writeWord works too; value 0)
  f.writeWord(0); // gridY placeholder (legacy reads readShort; 0 is fine)
  f.writeWord(0); // gridW
  f.writeWord(0); // gridH
  f.fill(0, 84); // reserved

  // --- frame header (16 bytes) ---
  f.writeUint(frameBytes);
  f.writeWord(0xf1fa); // magic
  f.writeWord(2); // old chunk count
  f.writeWord(0); // duration
  f.fill(0, 2);
  f.writeUint(2); // new chunk count

  // --- layer chunk (0x2004) ---
  f.writeUint(layerChunkSize);
  f.writeWord(0x2004);
  f.writeWord(1); // flags: visible
  f.writeWord(0); // layer type: normal
  f.writeWord(0); // child level
  f.writeWord(0); // default width
  f.writeWord(0); // default height
  f.writeWord(0); // blend mode normal
  f.writeUbyte(255); // opacity
  f.fill(0, 3);
  f.writeWord(nameLen);
  f.writeString("L");

  // --- cel chunk (0x2005) raw ---
  f.writeUint(celChunkSize);
  f.writeWord(0x2005);
  f.writeWord(0); // layer index
  f.writeWord(0); // x
  f.writeWord(0); // y
  f.writeUbyte(255); // opacity
  f.writeWord(0); // cel type: raw
  f.writeWord(0); // z-index
  f.fill(0, 5);
  f.writeWord(1); // cel width
  f.writeWord(1); // cel height
  f.writeUbyte(200);
  f.writeUbyte(100);
  f.writeUbyte(50);
  f.writeUbyte(255);

  return new Uint8Array(f.buffer);
}

describe("decodeAseprite", () => {
  it("is detected as Aseprite", () => {
    // detect needs length >= 128; our file is larger
    expect(detectFormat(buildAse())).toBe("ASEPRITE");
  });

  it("decodes a raw-cel sprite to RGBA", async () => {
    const d = await decodeAseprite(buildAse());
    expect(d.width).toBe(1);
    expect(d.height).toBe(1);
    expect(d.layers).toHaveLength(1);
    expect(d.layers[0]!.name).toBe("L");
    expect(Array.from(d.data)).toEqual([200, 100, 50, 255]);
  });

  it("rejects non-Aseprite input", async () => {
    await expect(decodeAseprite(new Uint8Array(200))).rejects.toThrow();
  });
});
