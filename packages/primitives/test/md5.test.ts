import { describe, it, expect } from "vitest";
import { md5 } from "../src/md5.js";

describe("md5", () => {
  it("matches the RFC 1321 test vectors", () => {
    expect(md5("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(md5("a")).toBe("0cc175b9c0f1b6a831c399e269772661");
    expect(md5("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(md5("message digest")).toBe("f96b697d7cb7938d525a2f31aaf161d0");
    expect(md5("abcdefghijklmnopqrstuvwxyz")).toBe("c3fcd3d76192e4007dfb496cca67e13b");
  });
  it("handles a long message spanning multiple blocks", () => {
    expect(
      md5("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"),
    ).toBe("d174ab98d277d9f5a5611c2c9f419d9f");
  });
  it("accepts byte arrays", () => {
    expect(md5(new Uint8Array([97, 98, 99]))).toBe("900150983cd24fb0d6963f7d28e17f72");
  });
});
