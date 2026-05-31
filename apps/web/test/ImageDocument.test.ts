import { describe, it, expect } from "vitest";
import { ImageDocument } from "../src/model/ImageDocument";

function newDoc(w = 8, h = 8) {
  return new ImageDocument({ width: w, height: h });
}

describe("ImageDocument basics", () => {
  it("creates one layer by default", () => {
    const doc = newDoc();
    expect(doc.layers).toHaveLength(1);
    expect(doc.activeLayer.name).toBe("Layer 1");
    expect(doc.activeLayer.data).toHaveLength(8 * 8 * 4);
  });

  it("ships a 16-colour default palette", () => {
    expect(newDoc().palette).toHaveLength(16);
  });

  it("getPixel returns null out of bounds", () => {
    const doc = newDoc();
    expect(doc.getPixel(-1, 0)).toBeNull();
    expect(doc.getPixel(0, 99)).toBeNull();
  });
});

describe("ImageDocument pixel ops", () => {
  it("sets and reads a pixel with default opaque alpha", () => {
    const doc = newDoc();
    doc.setPixel(2, 3, [10, 20, 30]);
    expect(doc.getPixel(2, 3)).toEqual([10, 20, 30, 255]);
  });

  it("ignores out-of-bounds setPixel", () => {
    const doc = newDoc();
    expect(() => doc.setPixel(100, 100, [1, 2, 3])).not.toThrow();
  });

  it("respects an explicit alpha channel", () => {
    const doc = newDoc();
    doc.setPixel(0, 0, [1, 2, 3, 128]);
    expect(doc.getPixel(0, 0)).toEqual([1, 2, 3, 128]);
  });
});

describe("ImageDocument drawLine", () => {
  it("draws a horizontal line inclusive of endpoints", () => {
    const doc = newDoc();
    doc.drawLine(1, 4, 5, 4, [255, 0, 0]);
    for (let x = 1; x <= 5; x++) expect(doc.getPixel(x, 4)).toEqual([255, 0, 0, 255]);
    expect(doc.getPixel(0, 4)).toEqual([0, 0, 0, 0]);
    expect(doc.getPixel(6, 4)).toEqual([0, 0, 0, 0]);
  });

  it("draws a diagonal line", () => {
    const doc = newDoc();
    doc.drawLine(0, 0, 3, 3, [0, 255, 0]);
    for (let i = 0; i <= 3; i++) expect(doc.getPixel(i, i)).toEqual([0, 255, 0, 255]);
  });

  it("draws a single point when endpoints coincide", () => {
    const doc = newDoc();
    doc.drawLine(2, 2, 2, 2, [9, 9, 9]);
    expect(doc.getPixel(2, 2)).toEqual([9, 9, 9, 255]);
  });
});

describe("ImageDocument drawRect", () => {
  it("draws an outline only", () => {
    const doc = newDoc();
    doc.drawRect(1, 1, 4, 4, [1, 1, 1]);
    expect(doc.getPixel(1, 1)).toEqual([1, 1, 1, 255]); // corner
    expect(doc.getPixel(4, 4)).toEqual([1, 1, 1, 255]); // opposite corner
    expect(doc.getPixel(2, 2)).toEqual([0, 0, 0, 0]); // interior empty
  });

  it("fills when asked", () => {
    const doc = newDoc();
    doc.drawRect(1, 1, 3, 3, [2, 2, 2], true);
    for (let y = 1; y <= 3; y++)
      for (let x = 1; x <= 3; x++) expect(doc.getPixel(x, y)).toEqual([2, 2, 2, 255]);
  });
});

describe("ImageDocument floodFill", () => {
  it("fills a contiguous region", () => {
    const doc = newDoc(4, 4);
    doc.floodFill(0, 0, [5, 6, 7]);
    expect(doc.getPixel(0, 0)).toEqual([5, 6, 7, 255]);
    expect(doc.getPixel(3, 3)).toEqual([5, 6, 7, 255]);
  });

  it("does not cross a barrier", () => {
    const doc = newDoc(5, 1);
    // barrier in the middle column
    doc.setPixel(2, 0, [255, 255, 255]);
    doc.floodFill(0, 0, [1, 1, 1]);
    expect(doc.getPixel(0, 0)).toEqual([1, 1, 1, 255]);
    expect(doc.getPixel(1, 0)).toEqual([1, 1, 1, 255]);
    expect(doc.getPixel(2, 0)).toEqual([255, 255, 255, 255]); // barrier intact
    expect(doc.getPixel(3, 0)).toEqual([0, 0, 0, 0]); // unreached
  });

  it("is a no-op when filling with the existing colour", () => {
    const doc = newDoc(2, 2);
    doc.setPixel(0, 0, [9, 9, 9]);
    expect(() => doc.floodFill(0, 0, [9, 9, 9, 255])).not.toThrow();
  });
});

describe("ImageDocument layers", () => {
  it("adds and activates a new layer", () => {
    const doc = newDoc();
    const layer = doc.addLayer();
    expect(doc.layers).toHaveLength(2);
    expect(doc.activeLayer).toBe(layer);
    expect(doc.activeLayerIndex).toBe(1);
  });

  it("never removes the last layer", () => {
    const doc = newDoc();
    doc.removeLayer(0);
    expect(doc.layers).toHaveLength(1);
  });

  it("clamps the active index after removal", () => {
    const doc = newDoc();
    doc.addLayer();
    doc.addLayer();
    doc.activeLayerIndex = 2;
    doc.removeLayer(2);
    expect(doc.activeLayerIndex).toBe(1);
  });

  it("clear empties the active layer", () => {
    const doc = newDoc();
    doc.setPixel(0, 0, [1, 2, 3]);
    doc.clear();
    expect(doc.getPixel(0, 0)).toEqual([0, 0, 0, 0]);
  });
});

describe("ImageDocument snapshot / restore", () => {
  it("restores pixel data after further edits", () => {
    const doc = newDoc(4, 4);
    doc.setPixel(1, 1, [7, 8, 9]);
    const snap = doc.snapshot();
    doc.setPixel(1, 1, [100, 100, 100]);
    doc.restore(snap);
    expect(doc.getPixel(1, 1)).toEqual([7, 8, 9, 255]);
  });

  it("snapshot is a deep copy (independent of later mutations)", () => {
    const doc = newDoc(2, 2);
    const snap = doc.snapshot();
    doc.setPixel(0, 0, [1, 2, 3]);
    // mutating the doc must not change the captured snapshot
    expect(snap.layers[0]!.data[0]).toBe(0);
  });

  it("restores layer structure", () => {
    const doc = newDoc(2, 2);
    const snap = doc.snapshot();
    doc.addLayer();
    doc.addLayer();
    expect(doc.layers).toHaveLength(3);
    doc.restore(snap);
    expect(doc.layers).toHaveLength(1);
    expect(doc.activeLayerIndex).toBe(0);
  });

  it("throws when restoring a mismatched size", () => {
    const doc = newDoc(2, 2);
    const snap = doc.snapshot();
    const other = newDoc(4, 4);
    expect(() => other.restore(snap)).toThrow();
  });
});

describe("ImageDocument composite & colorCount", () => {
  it("composites an opaque upper layer over a lower one", () => {
    const doc = newDoc(2, 2);
    doc.setPixel(0, 0, [10, 0, 0]); // layer 1
    doc.addLayer();
    doc.setPixel(0, 0, [0, 20, 0]); // layer 2 covers it
    const out = doc.composite();
    expect([out[0], out[1], out[2], out[3]]).toEqual([0, 20, 0, 255]);
  });

  it("skips hidden layers in the composite", () => {
    const doc = newDoc(1, 1);
    doc.setPixel(0, 0, [10, 0, 0]);
    doc.addLayer();
    doc.setPixel(0, 0, [0, 20, 0]);
    doc.layers[1]!.visible = false;
    const out = doc.composite();
    expect([out[0], out[1], out[2], out[3]]).toEqual([10, 0, 0, 255]);
  });

  it("counts distinct opaque colours", () => {
    const doc = newDoc(4, 1);
    doc.setPixel(0, 0, [1, 1, 1]);
    doc.setPixel(1, 0, [2, 2, 2]);
    doc.setPixel(2, 0, [1, 1, 1]); // duplicate
    expect(doc.colorCount()).toBe(2);
  });

  it("counts zero colours on an empty document", () => {
    expect(newDoc().colorCount()).toBe(0);
  });
});
