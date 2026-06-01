import { describe, it, expect } from "vitest";
import { BinaryStream } from "@dpaint/primitives";
import { decodeAmigaIcon } from "../src/amigaIcon.js";
import { detectFormat } from "../src/detect.js";

/** Build a minimal classic icon: 2×1, 1 plane, pixel(0,0)=1, pixel(1,0)=0. */
function buildIcon(): Uint8Array {
  const total = 78 + 20 + 2;
  const f = new BinaryStream(new ArrayBuffer(total), true);
  // DiskObject (78 bytes)
  f.writeWord(0xe310); // magic
  f.writeWord(1); // version
  f.writeUint(0); // nextGadget
  f.writeWord(0); // leftEdge
  f.writeWord(0); // topEdge
  f.writeWord(0); // width
  f.writeWord(0); // height
  f.writeWord(0); // flags
  f.writeWord(0); // activation
  f.writeWord(0); // gadgetType
  f.writeUint(1); // gadgetRender (non-zero -> image present)
  f.writeUint(0); // selectRender
  f.writeUint(0); // gadgetText
  f.writeUint(0); // mutualExclude
  f.writeUint(0); // specialInfo
  f.writeWord(0); // gadgetID
  f.writeUint(0); // userData
  f.writeUbyte(1); // type
  f.writeUbyte(0); // padding
  f.writeUint(0); // hasDefaultTool
  f.writeUint(0); // hasToolTypes
  f.writeUint(0); // currentX
  f.writeUint(0); // currentY
  f.writeUint(0); // hasDrawerData
  f.writeUint(0); // hasToolWindow
  f.writeUint(0); // stackSize
  // Image (20 bytes)
  f.writeWord(0); // leftEdge
  f.writeWord(0); // topEdge
  f.writeWord(2); // width
  f.writeWord(1); // height
  f.writeWord(1); // depth
  f.writeUint(1); // hasImageData
  f.writeUbyte(0); // planePick
  f.writeUbyte(0); // planeOnOff
  f.writeUint(0); // nextImage
  // plane 0 row: bit7 set (x=0) -> index 1 at (0,0); x=1 -> 0
  f.writeUbyte(0x80);
  f.writeUbyte(0x00);
  return new Uint8Array(f.buffer);
}

describe("decodeAmigaIcon", () => {
  it("is detected as ICON by magic + extension", () => {
    expect(detectFormat(buildIcon(), "disk.info")).toBe("ICON");
  });

  it("decodes a planar classic icon through the Workbench palette", () => {
    const icon = decodeAmigaIcon(buildIcon());
    expect(icon.width).toBe(2);
    expect(icon.height).toBe(1);
    expect(icon.images).toHaveLength(1);
    // index 1 -> white, index 0 -> Workbench blue
    expect([icon.data[0], icon.data[1], icon.data[2], icon.data[3]]).toEqual([255, 255, 255, 255]);
    expect([icon.data[4], icon.data[5], icon.data[6], icon.data[7]]).toEqual([85, 170, 255, 255]);
  });

  it("rejects non-icon input", () => {
    expect(() => decodeAmigaIcon(new Uint8Array([1, 2, 3, 4]))).toThrow();
  });
});
