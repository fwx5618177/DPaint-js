import { describe, it, expect } from "vitest";
import { decodePBM, decodeANIM } from "../src/iff.js";

/** Minimal big-endian IFF chunk/FORM assembly helpers. */
function u32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}
function u16(n: number): number[] {
  return [(n >>> 8) & 0xff, n & 0xff];
}
function fourcc(s: string): number[] {
  return [...s].map((c) => c.charCodeAt(0));
}
function chunk(name: string, data: number[]): number[] {
  const body = [...fourcc(name), ...u32(data.length), ...data];
  if (data.length & 1) body.push(0); // word align
  return body;
}
function form(type: string, chunks: number[]): number[] {
  const inner = [...fourcc(type), ...chunks];
  return [...fourcc("FORM"), ...u32(inner.length), ...inner];
}

describe("IFF PBM (PC Deluxe Paint chunky)", () => {
  it("decodes an uncompressed 2x2 chunky PBM", () => {
    const bmhd = chunk("BMHD", [
      ...u16(2), ...u16(2), // width, height
      ...u16(0), ...u16(0), // x, y
      8, 0, 0, 0, // planes, mask, compression(none), pad
      ...u16(0), // transparent
      ...u16(0), 11, 11, ...u16(2), ...u16(2), // aspect + page (unused)
    ]);
    const cmap = chunk("CMAP", [0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]); // 4 colours
    // chunky indices, rows padded to even width (already even): [0,1] [2,3]
    const body = chunk("BODY", [0, 1, 2, 3]);
    const bytes = new Uint8Array(form("PBM ", [...bmhd, ...cmap, ...body]));

    const img = decodePBM(bytes);
    expect(img.width).toBe(2);
    expect(img.height).toBe(2);
    // index 1 = red at (1,0); index 2 = green at (0,1)
    const px = (x: number, y: number) => {
      const o = (y * 2 + x) * 4;
      return [img.data[o], img.data[o + 1], img.data[o + 2]];
    };
    expect(px(0, 0)).toEqual([0, 0, 0]);
    expect(px(1, 0)).toEqual([255, 0, 0]);
    expect(px(0, 1)).toEqual([0, 255, 0]);
    expect(px(1, 1)).toEqual([0, 0, 255]);
  });
});

describe("IFF ANIM (byte-vertical-delta)", () => {
  it("decodes a 2-frame animation with a mode-5 DLTA", () => {
    // 8x2, 1 plane, uncompressed. rowBytes=2, planesPerRow=1.
    const bmhd = chunk("BMHD", [
      ...u16(8), ...u16(2),
      ...u16(0), ...u16(0),
      1, 0, 0, 0,
      ...u16(0),
      ...u16(0), 11, 11, ...u16(8), ...u16(2),
    ]);
    const cmap = chunk("CMAP", [0, 0, 0, 255, 255, 255]); // 0=black, 1=white
    // frame 0 planar BODY: row0 = 0xFF 0x00 (left 8 white), row1 = 0x00 0x00
    const body = chunk("BODY", [0xff, 0x00, 0x00, 0x00]);
    const frame0 = form("ILBM", [...bmhd, ...cmap, ...body]);

    // frame 1: ANHD compression=5, DLTA setting plane0/col0/row1 = 0xFF
    const anhd = chunk("ANHD", [
      5, 0, // compression, mask
      ...u16(8), ...u16(2), // w,h
      ...u16(0), ...u16(0), // x,y
      ...u32(0), ...u32(0), // absTime, relTime
      0, 0, 0, 0, // interleave, pad, bits, future
    ]);
    // DLTA: 8 pointers, pointer[0]=32 (data follows the pointer table)
    const dltaData = [
      ...u32(32), ...u32(0), ...u32(0), ...u32(0),
      ...u32(0), ...u32(0), ...u32(0), ...u32(0),
      // column 0: opCount=2 -> skip 1 row, uniq 1 byte 0xFF
      0x02, 0x01, 0x81, 0xff,
      // column 1: opCount=0 (no change)
      0x00,
    ];
    const dlta = chunk("DLTA", dltaData);
    const frame1 = form("ILBM", [...anhd, ...dlta]);

    const bytes = new Uint8Array(form("ANIM", [...frame0, ...frame1]));
    const anim = decodeANIM(bytes);

    expect(anim.width).toBe(8);
    expect(anim.height).toBe(2);
    expect(anim.frames).toHaveLength(2);

    const alphaAt = (frame: Uint8ClampedArray, x: number, y: number) => {
      const o = (y * 8 + x) * 4;
      return [frame[o], frame[o + 1], frame[o + 2]];
    };
    // frame 0: row1 is black
    expect(alphaAt(anim.frames[0]!, 0, 1)).toEqual([0, 0, 0]);
    // frame 1: the delta turned row1 col0 white
    expect(alphaAt(anim.frames[1]!, 0, 1)).toEqual([255, 255, 255]);
    // row0 unchanged (still white) in both frames
    expect(alphaAt(anim.frames[1]!, 0, 0)).toEqual([255, 255, 255]);
  });
});
