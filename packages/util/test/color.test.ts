import { describe, it, expect } from "vitest";
import * as Color from "../src/color.js";

describe("Color.fromString / toString", () => {
  it("parses rgb() strings", () => {
    expect(Color.fromString("rgb(10,20,30)")).toEqual([10, 20, 30]);
    expect(Color.fromString("rgb(10,20,30,40)")).toEqual([10, 20, 30, 40]);
  });
  it("parses #hex strings", () => {
    expect(Color.fromString("#0a141e")).toEqual([10, 20, 30]);
    expect(Color.fromString("#0a141e28")).toEqual([10, 20, 30, 40]);
  });
  it("round-trips an array through toString/fromString", () => {
    expect(Color.toString([1, 2, 3])).toBe("rgb(1,2,3)");
    expect(Color.fromString(Color.toString([1, 2, 3]))).toEqual([1, 2, 3]);
  });
});

describe("Color.toHex", () => {
  it("pads single digits and lowercases", () => {
    expect(Color.toHex([10, 20, 30])).toBe("#0a141e");
    expect(Color.toHex([0, 0, 0])).toBe("#000000");
    expect(Color.toHex([255, 255, 255])).toBe("#ffffff");
  });
  it("includes alpha when present", () => {
    expect(Color.toHex([10, 20, 30, 40])).toBe("#0a141e28");
  });
  it("accepts string input", () => {
    expect(Color.toHex("rgb(255,0,0)")).toBe("#ff0000");
  });
});

describe("Color HSV round-trip", () => {
  it("fromHSV produces known primaries", () => {
    expect(Color.fromHSV(0, 1, 1)).toEqual([255, 0, 0]);
    expect(Color.fromHSV(1 / 3, 1, 1)).toEqual([0, 255, 0]);
    expect(Color.fromHSV(2 / 3, 1, 1)).toEqual([0, 0, 255]);
  });
  it("toHSV of grayscale has zero saturation", () => {
    const hsv = Color.toHSV([128, 128, 128])!;
    expect(hsv[1]).toBe(0);
  });
  it("toHSV with maxRange returns degrees/percent", () => {
    expect(Color.toHSV([255, 0, 0], true)).toEqual([0, 100, 100]);
  });
  it("survives a round trip for a saturated colour", () => {
    const rgb: [number, number, number] = [200, 100, 50];
    const hsv = Color.toHSV(rgb)!;
    const back = Color.fromHSV(hsv[0]!, hsv[1]!, hsv[2]!);
    expect(back).toEqual(rgb);
  });
});

describe("Color.distance family", () => {
  it("is zero for equal colours", () => {
    expect(Color.distance([1, 2, 3], [1, 2, 3])).toBe(0);
    expect(Color.distanceLAB([10, 20, 30], [10, 20, 30])).toBeCloseTo(0);
    expect(Color.distanceHSV([10, 20, 30], [10, 20, 30])).toBeCloseTo(0);
  });
  it("computes euclidean RGB distance", () => {
    expect(Color.distance([0, 0, 0], [0, 0, 3])).toBe(3);
    expect(Color.distance([0, 0, 0], [3, 4, 0])).toBe(5);
  });
  it("includes alpha when both have 4 channels", () => {
    expect(Color.distance([0, 0, 0, 0], [0, 0, 0, 5])).toBe(5);
  });
});

describe("Color blend / equals", () => {
  it("blends by amount", () => {
    expect(Color.blend([0, 0, 0], [100, 200, 50], 0)).toEqual([0, 0, 0]);
    expect(Color.blend([0, 0, 0], [100, 200, 50], 1)).toEqual([100, 200, 50]);
    expect(Color.blend([0, 0, 0], [100, 200, 50], 0.5)).toEqual([50, 100, 25]);
  });
  it("equals ignores alpha", () => {
    expect(Color.equals([1, 2, 3], [1, 2, 3, 99])).toBe(true);
    expect(Color.equals([1, 2, 3], [1, 2, 4])).toBe(false);
  });
});

describe("Color bit-depth reduction", () => {
  it("to12bit / to9bit shift channels", () => {
    expect(Color.to12bit([255, 255, 255])).toEqual([15, 15, 15]);
    expect(Color.to9bit([255, 255, 255])).toEqual([7, 7, 7]);
  });
  it("to24bit expands 12-bit back toward full range", () => {
    expect(Color.to24bit([15, 15, 15], 4)).toEqual([255, 255, 255]);
    expect(Color.to24bit([0, 0, 0], 4)).toEqual([0, 0, 0]);
  });
  it("setBitDepth(8) is identity", () => {
    expect(Color.setBitDepth([12, 34, 56], 8)).toEqual([12, 34, 56]);
  });
  it("toOCSString formats 12-bit hex", () => {
    expect(Color.toOCSString([255, 255, 255])).toBe("0xfff");
    expect(Color.toOCSString([0, 0, 0])).toBe("0x000");
  });
});
