import { describe, it, expect } from "vitest";
import { BinaryStream } from "../src/binarystream.js";

function streamOf(bytes: number[], bigEndian?: boolean): BinaryStream {
  const buf = new Uint8Array(bytes).buffer;
  return new BinaryStream(buf, bigEndian);
}

describe("BinaryStream reading", () => {
  it("reads unsigned bytes and advances the cursor", () => {
    const s = streamOf([1, 2, 3]);
    expect(s.readUbyte()).toBe(1);
    expect(s.readUbyte()).toBe(2);
    expect(s.index).toBe(2);
  });

  it("reads signed bytes", () => {
    const s = streamOf([0xff]);
    expect(s.readByte()).toBe(-1);
  });

  it("reads little-endian uint32 by default", () => {
    const s = streamOf([0x78, 0x56, 0x34, 0x12]);
    expect(s.readUint()).toBe(0x12345678);
  });

  it("reads big-endian uint32 when constructed bigEndian", () => {
    const s = streamOf([0x12, 0x34, 0x56, 0x78], true);
    expect(s.readUint()).toBe(0x12345678);
  });

  it("readWord respects endianness", () => {
    expect(streamOf([0x34, 0x12]).readWord()).toBe(0x1234);
    expect(streamOf([0x12, 0x34], true).readWord()).toBe(0x1234);
  });

  it("readUWord is always big-endian (legacy quirk preserved)", () => {
    // even in little-endian mode, readUWord reads big-endian
    expect(streamOf([0x12, 0x34]).readUWord()).toBe(0x1234);
  });

  it("reads null-terminated strings", () => {
    const s = streamOf([0x48, 0x69, 0x00, 0x21]); // "Hi\0!"
    expect(s.readString(10)).toBe("Hi");
  });

  it("reads fixed length byte arrays", () => {
    const s = streamOf([5, 6, 7, 8]);
    expect(Array.from(s.readUBytes(3))).toEqual([5, 6, 7]);
    expect(s.index).toBe(3);
  });
});

describe("BinaryStream writing", () => {
  it("writes and reads back a uint32 round-trip", () => {
    const s = new BinaryStream(new ArrayBuffer(4));
    s.writeUint(0xdeadbeef);
    s.goto(0);
    expect(s.readUint()).toBe(0xdeadbeef);
  });

  it("writes a string then reads it back", () => {
    const s = new BinaryStream(new ArrayBuffer(8));
    s.writeString("FORM");
    s.goto(0);
    expect(s.readString(4)).toBe("FORM");
  });

  it("writeStringSection pads to a fixed width", () => {
    const s = new BinaryStream(new ArrayBuffer(8));
    s.writeStringSection("AB", 4, 0);
    expect(s.index).toBe(4);
    s.goto(0);
    expect(s.readUbyte()).toBe(65);
    expect(s.readUbyte()).toBe(66);
    expect(s.readUbyte()).toBe(0);
    expect(s.readUbyte()).toBe(0);
  });
});

describe("BinaryStream navigation", () => {
  it("goto and jump move the cursor and clamp to bounds", () => {
    const s = streamOf([1, 2, 3, 4]);
    s.goto(2);
    expect(s.index).toBe(2);
    s.jump(1);
    expect(s.index).toBe(3);
    s.goto(999);
    expect(s.index).toBe(3); // clamped to length-1
    s.goto(-5);
    expect(s.index).toBe(0); // clamped to 0
  });

  it("isEOF reports end of stream", () => {
    const s = streamOf([1, 2]);
    expect(s.isEOF()).toBe(false);
    s.readUbyte();
    s.readUbyte();
    expect(s.isEOF()).toBe(true);
  });
});

describe("BinaryStream bit access", () => {
  it("reads individual bits MSB-first", () => {
    const s = streamOf([0b10110000]);
    expect(s.readBits(1, 0, 0)).toBe(1);
    expect(s.readBits(1, 1, 0)).toBe(0);
    expect(s.readBits(2, 2, 0)).toBe(0b11);
  });

  it("reads bits spanning a byte boundary", () => {
    const s = streamOf([0b00000011, 0b11000000]);
    // 4 bits starting at bit position 6 -> 0b1111
    expect(s.readBits(4, 6, 0)).toBe(0b1111);
  });
});
