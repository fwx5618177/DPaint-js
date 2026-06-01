import { describe, it, expect } from "vitest";
import { AdfDisk, decodeADF } from "../src/adf.js";

const SECTOR = 512;

/** Build a minimal 8-sector OFS ADF: root at sector 4, one file "HELLO" = "Hi!". */
function buildOfsAdf(): Uint8Array {
  const buf = new Uint8Array(8 * SECTOR);
  const view = new DataView(buf.buffer);
  const setLong = (offset: number, value: number) => view.setUint32(offset, value >>> 0);
  const setName = (sector: number, name: string) => {
    const o = sector * SECTOR + SECTOR - 80;
    buf[o] = name.length;
    for (let i = 0; i < name.length; i++) buf[o + 1 + i] = name.charCodeAt(i);
  };

  // boot block: "DOS" + 0 (OFS)
  buf[0] = 0x44; // D
  buf[1] = 0x4f; // O
  buf[2] = 0x53; // S
  buf[3] = 0x00; // OFS

  // root block @ sector 4
  const root = 4;
  setLong(root * SECTOR, 2); // header type
  setLong(root * SECTOR + 24, 5); // hash slot 0 -> file header at sector 5
  setName(root, "DISK");

  // file header @ sector 5
  const fh = 5 * SECTOR;
  setLong(fh + 0, 2); // header type
  setLong(fh + 16, 6); // firstDataBlock -> sector 6
  setLong(fh + SECTOR - 188, 3); // size = 3
  setLong(fh + SECTOR - 16, 0); // linkedSector
  setLong(fh + SECTOR - 4, 0xfffffffd); // secondaryType FILE
  setName(5, "HELLO");

  // OFS data block @ sector 6
  const db = 6 * SECTOR;
  setLong(db + 0, 8); // data block type
  setLong(db + 4, 5); // header sector
  setLong(db + 8, 1); // block number
  setLong(db + 12, 3); // data size
  setLong(db + 16, 0); // next data block
  buf[db + 24] = "H".charCodeAt(0);
  buf[db + 25] = "i".charCodeAt(0);
  buf[db + 26] = "!".charCodeAt(0);

  return buf;
}

describe("ADF reader (OFS)", () => {
  it("reads the volume label and lists the root directory", () => {
    const adf = decodeADF(buildOfsAdf());
    expect(adf.ffs).toBe(false);
    expect(adf.label).toBe("DISK");
    expect(adf.entries).toHaveLength(1);
    expect(adf.entries[0]).toMatchObject({ name: "HELLO", type: "FILE", size: 3, sector: 5 });
  });

  it("extracts a file's contents (OFS data-block chain)", () => {
    const disk = new AdfDisk(buildOfsAdf());
    const entry = disk.list()[0]!;
    const bytes = disk.readFile(entry.sector);
    expect(String.fromCharCode(...bytes)).toBe("Hi!");
  });

  it("rejects non-ADF input", () => {
    expect(() => decodeADF(new Uint8Array(1024))).toThrow(/DOS/);
  });
});
