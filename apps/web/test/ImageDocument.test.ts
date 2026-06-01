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

describe("ImageDocument drawEllipse", () => {
  it("draws a single pixel for a zero-size box", () => {
    const doc = newDoc(8, 8);
    doc.drawEllipse(4, 4, 4, 4, [3, 3, 3]);
    expect(doc.getPixel(4, 4)).toEqual([3, 3, 3, 255]);
  });

  it("draws an outline that touches the bounding-box extremes", () => {
    const doc = newDoc(9, 9);
    doc.drawEllipse(1, 1, 7, 7, [5, 5, 5]); // circle centred at (4,4)
    // top, bottom, left, right midpoints lie on the ellipse
    expect(doc.getPixel(4, 1)).toEqual([5, 5, 5, 255]);
    expect(doc.getPixel(4, 7)).toEqual([5, 5, 5, 255]);
    expect(doc.getPixel(1, 4)).toEqual([5, 5, 5, 255]);
    expect(doc.getPixel(7, 4)).toEqual([5, 5, 5, 255]);
  });

  it("leaves the centre empty for an outline", () => {
    const doc = newDoc(9, 9);
    doc.drawEllipse(1, 1, 7, 7, [5, 5, 5]);
    expect(doc.getPixel(4, 4)).toEqual([0, 0, 0, 0]);
  });

  it("fills the interior when fill is set", () => {
    const doc = newDoc(9, 9);
    doc.drawEllipse(1, 1, 7, 7, [6, 6, 6], true);
    expect(doc.getPixel(4, 4)).toEqual([6, 6, 6, 255]); // centre filled
    expect(doc.getPixel(4, 1)).toEqual([6, 6, 6, 255]); // edge filled
    expect(doc.getPixel(0, 0)).toEqual([0, 0, 0, 0]); // corner outside ellipse
  });

  it("accepts corners in any order", () => {
    const doc = newDoc(9, 9);
    doc.drawEllipse(7, 7, 1, 1, [8, 8, 8]);
    expect(doc.getPixel(4, 1)).toEqual([8, 8, 8, 255]);
  });
});

describe("ImageDocument gradientLinear", () => {
  it("fills a horizontal black→white gradient", () => {
    const doc = newDoc(5, 1);
    doc.gradientLinear(0, 0, 4, 0, [0, 0, 0], [255, 255, 255]);
    expect(doc.getPixel(0, 0)).toEqual([0, 0, 0, 255]);
    expect(doc.getPixel(4, 0)).toEqual([255, 255, 255, 255]);
    const mid = doc.getPixel(2, 0)!;
    expect(mid[0]).toBeGreaterThan(100);
    expect(mid[0]).toBeLessThan(160); // ~128
  });

  it("clamps beyond the endpoints", () => {
    const doc = newDoc(4, 1);
    // gradient vector only spans x=1..2; x=0 clamps to A, x=3 clamps to B
    doc.gradientLinear(1, 0, 2, 0, [10, 10, 10], [200, 200, 200]);
    expect(doc.getPixel(0, 0)).toEqual([10, 10, 10, 255]);
    expect(doc.getPixel(3, 0)).toEqual([200, 200, 200, 255]);
  });

  it("fills with the start colour for a zero-length vector", () => {
    const doc = newDoc(2, 2);
    doc.gradientLinear(0, 0, 0, 0, [7, 8, 9], [200, 100, 50]);
    expect(doc.getPixel(0, 0)).toEqual([7, 8, 9, 255]);
    expect(doc.getPixel(1, 1)).toEqual([7, 8, 9, 255]);
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

describe("ImageDocument resize / crop", () => {
  it("doubles the size with nearest-neighbour (each pixel becomes a 2×2 block)", () => {
    const doc = newDoc(2, 2);
    doc.setPixel(0, 0, [10, 0, 0]);
    doc.setPixel(1, 0, [0, 20, 0]);
    const big = doc.resized(4, 4);
    expect(big.width).toBe(4);
    expect(big.height).toBe(4);
    // top-left 2×2 block all from source (0,0)
    expect(big.getPixel(0, 0)).toEqual([10, 0, 0, 255]);
    expect(big.getPixel(1, 1)).toEqual([10, 0, 0, 255]);
    expect(big.getPixel(2, 0)).toEqual([0, 20, 0, 255]);
  });

  it("returns a new document and leaves the original untouched", () => {
    const doc = newDoc(4, 4);
    doc.setPixel(0, 0, [9, 9, 9]);
    const small = doc.resized(2, 2);
    expect(small).not.toBe(doc);
    expect(doc.width).toBe(4); // original unchanged
    expect(small.width).toBe(2);
  });

  it("preserves layers and palette on resize", () => {
    const doc = newDoc(2, 2);
    doc.addLayer("Top");
    const big = doc.resized(4, 4);
    expect(big.layers).toHaveLength(2);
    expect(big.layers[1]!.name).toBe("Top");
    expect(big.palette).toEqual(doc.palette);
  });

  it("crops to a sub-rectangle", () => {
    const doc = newDoc(4, 4);
    doc.setPixel(2, 1, [1, 2, 3]);
    const c = doc.cropped(2, 1, 2, 2);
    expect(c.width).toBe(2);
    expect(c.height).toBe(2);
    expect(c.getPixel(0, 0)).toEqual([1, 2, 3, 255]);
  });

  it("leaves out-of-bounds crop regions transparent", () => {
    const doc = newDoc(2, 2);
    doc.setPixel(0, 0, [5, 5, 5]);
    const c = doc.cropped(1, 1, 3, 3); // extends past the edge
    expect(c.width).toBe(3);
    expect(c.getPixel(2, 2)).toEqual([0, 0, 0, 0]);
  });
});

describe("ImageDocument transforms", () => {
  it("flipHorizontal mirrors pixels left-to-right across all layers", () => {
    const doc = newDoc(4, 1);
    doc.setPixel(0, 0, [1, 1, 1]);
    doc.setPixel(3, 0, [2, 2, 2]);
    doc.flipHorizontal();
    expect(doc.getPixel(3, 0)).toEqual([1, 1, 1, 255]);
    expect(doc.getPixel(0, 0)).toEqual([2, 2, 2, 255]);
  });

  it("flipHorizontal is its own inverse", () => {
    const doc = newDoc(4, 4);
    doc.setPixel(1, 2, [7, 8, 9]);
    doc.flipHorizontal();
    doc.flipHorizontal();
    expect(doc.getPixel(1, 2)).toEqual([7, 8, 9, 255]);
  });

  it("flipVertical mirrors pixels top-to-bottom", () => {
    const doc = newDoc(1, 4);
    doc.setPixel(0, 0, [1, 1, 1]);
    doc.setPixel(0, 3, [2, 2, 2]);
    doc.flipVertical();
    expect(doc.getPixel(0, 3)).toEqual([1, 1, 1, 255]);
    expect(doc.getPixel(0, 0)).toEqual([2, 2, 2, 255]);
  });

  it("flips affect every layer", () => {
    const doc = newDoc(2, 1);
    doc.setPixel(0, 0, [5, 5, 5]);
    doc.addLayer();
    doc.setPixel(0, 0, [6, 6, 6]);
    doc.flipHorizontal();
    expect(doc.getPixel(1, 0, doc.layers[0]!)).toEqual([5, 5, 5, 255]);
    expect(doc.getPixel(1, 0, doc.layers[1]!)).toEqual([6, 6, 6, 255]);
  });
});

describe("ImageDocument colour effects", () => {
  it("invertColors inverts RGB and preserves alpha", () => {
    const doc = newDoc(1, 1);
    doc.setPixel(0, 0, [10, 20, 30, 200]);
    doc.invertColors();
    expect(doc.getPixel(0, 0)).toEqual([245, 235, 225, 200]);
  });

  it("invert is its own inverse", () => {
    const doc = newDoc(2, 2);
    doc.setPixel(0, 0, [12, 34, 56]);
    doc.invertColors();
    doc.invertColors();
    expect(doc.getPixel(0, 0)).toEqual([12, 34, 56, 255]);
  });

  it("grayscale produces equal channels via luma", () => {
    const doc = newDoc(1, 1);
    doc.setPixel(0, 0, [255, 0, 0]); // luma = round(0.299*255) = 76
    doc.grayscale();
    expect(doc.getPixel(0, 0)).toEqual([76, 76, 76, 255]);
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
