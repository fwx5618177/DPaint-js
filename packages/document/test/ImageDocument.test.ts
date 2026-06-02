import { describe, it, expect } from "vitest";
import { ImageDocument } from "../src/ImageDocument";

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

describe("ImageDocument spray", () => {
  it("scatters the requested number of pixels within the radius", () => {
    const doc = newDoc(20, 20);
    // deterministic rng cycling through fixed values
    const seq = [0, 0.25, 0.1, 0.5, 0.4, 0.9, 0.7, 0.2, 0.3, 0.8];
    let i = 0;
    const rng = () => seq[i++ % seq.length]!;
    doc.spray(10, 10, 5, 5, [255, 0, 0], doc.activeLayer, rng);
    let painted = 0;
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        const p = doc.getPixel(x, y)!;
        if (p[3] !== 0) {
          painted++;
          const d = Math.hypot(x - 10, y - 10);
          expect(d).toBeLessThanOrEqual(5.5); // within radius (rounding slack)
        }
      }
    }
    expect(painted).toBeGreaterThan(0);
  });

  it("is deterministic for a fixed rng", () => {
    const rng = () => 0.5;
    const a = newDoc(10, 10);
    const b = newDoc(10, 10);
    a.spray(5, 5, 3, 4, [1, 2, 3], a.activeLayer, rng);
    b.spray(5, 5, 3, 4, [1, 2, 3], b.activeLayer, () => 0.5);
    expect(Array.from(a.activeLayer.data)).toEqual(Array.from(b.activeLayer.data));
  });
});

describe("ImageDocument smudge", () => {
  it("drags colour from a source pixel into neighbouring pixels", () => {
    const doc = newDoc(5, 1);
    doc.setPixel(0, 0, [200, 0, 0]); // rest black-transparent
    doc.drawLine(1, 0, 4, 0, [0, 0, 0]); // make 1..4 opaque black
    doc.smudge(0, 0, 4, 0, 0.5);
    // colour should bleed rightward, decreasing
    const p1 = doc.getPixel(1, 0)!;
    expect(p1[0]).toBeGreaterThan(0); // some red dragged in
    const p4 = doc.getPixel(4, 0)!;
    expect(p1[0]).toBeGreaterThanOrEqual(p4[0]!); // fades along the drag
  });

  it("does nothing meaningful for zero strength", () => {
    const doc = newDoc(3, 1);
    doc.drawLine(0, 0, 2, 0, [50, 60, 70]);
    doc.smudge(0, 0, 2, 0, 0);
    expect(doc.getPixel(2, 0)).toEqual([50, 60, 70, 255]);
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

describe("ImageDocument frames", () => {
  it("starts with one frame", () => {
    const doc = newDoc();
    expect(doc.frameCount).toBe(1);
    expect(doc.activeFrameIndex).toBe(0);
  });

  it("adds a blank frame and activates it", () => {
    const doc = newDoc();
    doc.setPixel(0, 0, [9, 9, 9]);
    doc.addFrame();
    expect(doc.frameCount).toBe(2);
    expect(doc.activeFrameIndex).toBe(1);
    expect(doc.getPixel(0, 0)).toEqual([0, 0, 0, 0]); // new frame is blank
  });

  it("duplicates a frame (independent copy)", () => {
    const doc = newDoc();
    doc.setPixel(0, 0, [1, 2, 3]);
    doc.duplicateFrame();
    expect(doc.getPixel(0, 0)).toEqual([1, 2, 3, 255]);
    // editing the duplicate must not affect the original frame
    doc.setPixel(0, 0, [9, 9, 9]);
    doc.goToFrame(0);
    expect(doc.getPixel(0, 0)).toEqual([1, 2, 3, 255]);
  });

  it("never removes the last frame and clamps the active index", () => {
    const doc = newDoc();
    doc.removeFrame(0);
    expect(doc.frameCount).toBe(1);
    doc.addFrame();
    doc.addFrame();
    doc.goToFrame(2);
    doc.removeFrame(2);
    expect(doc.activeFrameIndex).toBe(1);
  });

  it("each frame keeps independent layers", () => {
    const doc = newDoc();
    doc.addLayer(); // frame 0 now has 2 layers
    doc.addFrame(); // frame 1 blank (1 layer)
    expect(doc.layers).toHaveLength(1);
    doc.goToFrame(0);
    expect(doc.layers).toHaveLength(2);
  });
});

describe("ImageDocument selection / clipboard", () => {
  it("copies a region into a detached buffer", () => {
    const doc = newDoc(4, 4);
    doc.setPixel(1, 1, [10, 20, 30]);
    doc.setPixel(2, 1, [40, 50, 60]);
    const region = doc.copyRegion({ x: 1, y: 1, width: 2, height: 1 });
    expect(region.width).toBe(2);
    expect(region.height).toBe(1);
    expect(Array.from(region.data)).toEqual([10, 20, 30, 255, 40, 50, 60, 255]);
  });

  it("clamps regions to the document bounds", () => {
    const doc = newDoc(2, 2);
    const region = doc.copyRegion({ x: 1, y: 1, width: 5, height: 5 });
    expect(region.width).toBe(1);
    expect(region.height).toBe(1);
  });

  it("clears a region to transparent", () => {
    const doc = newDoc(3, 3);
    doc.drawRect(0, 0, 3, 3, [9, 9, 9], true);
    doc.clearRegion({ x: 1, y: 1, width: 1, height: 1 });
    expect(doc.getPixel(1, 1)).toEqual([0, 0, 0, 0]);
    expect(doc.getPixel(0, 0)).toEqual([9, 9, 9, 255]); // outside untouched
  });

  it("stamps a region (alpha-over) at an offset", () => {
    const doc = newDoc(4, 4);
    const region = {
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([100, 110, 120, 255]),
    };
    doc.stampRegion(region, 2, 3);
    expect(doc.getPixel(2, 3)).toEqual([100, 110, 120, 255]);
  });

  it("cut = copy then clear round-trips via stamp", () => {
    const doc = newDoc(4, 4);
    doc.setPixel(0, 0, [7, 8, 9]);
    const sel = { x: 0, y: 0, width: 1, height: 1 };
    const clip = doc.copyRegion(sel);
    doc.clearRegion(sel);
    expect(doc.getPixel(0, 0)).toEqual([0, 0, 0, 0]);
    doc.stampRegion(clip, 3, 3);
    expect(doc.getPixel(3, 3)).toEqual([7, 8, 9, 255]);
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

describe("ImageDocument rotate90", () => {
  it("rotates clockwise, swapping dimensions", () => {
    const doc = newDoc(3, 2);
    doc.setPixel(0, 0, [1, 1, 1]);
    const r = doc.rotated90(false);
    expect(r.width).toBe(2);
    expect(r.height).toBe(3);
    expect(r.getPixel(1, 0)).toEqual([1, 1, 1, 255]);
  });

  it("rotates counter-clockwise", () => {
    const doc = newDoc(3, 2);
    doc.setPixel(0, 0, [2, 2, 2]);
    const r = doc.rotated90(true);
    expect(r.width).toBe(2);
    expect(r.height).toBe(3);
    expect(r.getPixel(0, 2)).toEqual([2, 2, 2, 255]);
  });

  it("four clockwise rotations return to the original", () => {
    const doc = newDoc(4, 3);
    doc.setPixel(2, 1, [9, 8, 7]);
    let r = doc.rotated90(false);
    r = r.rotated90(false);
    r = r.rotated90(false);
    r = r.rotated90(false);
    expect(r.width).toBe(4);
    expect(r.height).toBe(3);
    expect(r.getPixel(2, 1)).toEqual([9, 8, 7, 255]);
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

describe("ImageDocument layer operations", () => {
  it("duplicates a layer above and makes the copy active", () => {
    const doc = newDoc(4, 4);
    doc.setPixel(1, 1, [9, 8, 7]);
    const copy = doc.duplicateLayer(0);
    expect(doc.layers).toHaveLength(2);
    expect(doc.activeLayerIndex).toBe(1);
    expect(copy.name).toBe("Layer 1 copy");
    // independent buffer
    expect(copy.data).not.toBe(doc.layers[0]!.data);
    expect(doc.getPixel(1, 1, copy)).toEqual([9, 8, 7, 255]);
  });

  it("moves a layer up and down, tracking the active index", () => {
    const doc = newDoc(2, 2);
    doc.addLayer("B"); // index 1, active
    doc.addLayer("C"); // index 2, active
    expect(doc.layers.map((l) => l.name)).toEqual(["Layer 1", "B", "C"]);
    doc.activeLayerIndex = 2;
    doc.moveLayer(2, "down");
    expect(doc.layers.map((l) => l.name)).toEqual(["Layer 1", "C", "B"]);
    expect(doc.activeLayerIndex).toBe(1);
    doc.moveLayer(1, "up");
    expect(doc.layers.map((l) => l.name)).toEqual(["Layer 1", "B", "C"]);
  });

  it("merges a layer down, compositing opaque over lower", () => {
    const doc = newDoc(2, 2);
    doc.setPixel(0, 0, [10, 10, 10]); // lower layer
    doc.addLayer("top");
    doc.setPixel(0, 0, [200, 100, 50]); // upper, fully opaque
    doc.mergeDown(1);
    expect(doc.layers).toHaveLength(1);
    expect(doc.activeLayerIndex).toBe(0);
    // opaque upper wins
    expect(doc.getPixel(0, 0)).toEqual([200, 100, 50, 255]);
  });

  it("flattens all layers into one", () => {
    const doc = newDoc(2, 2);
    doc.setPixel(0, 0, [1, 2, 3]);
    doc.addLayer("b");
    doc.setPixel(1, 1, [4, 5, 6]);
    doc.flatten();
    expect(doc.layers).toHaveLength(1);
    expect(doc.getPixel(0, 0)).toEqual([1, 2, 3, 255]);
    expect(doc.getPixel(1, 1)).toEqual([4, 5, 6, 255]);
  });

  it("does not move beyond bounds or remove the last layer", () => {
    const doc = newDoc(2, 2);
    doc.moveLayer(0, "up"); // only one layer — no-op
    expect(doc.layers).toHaveLength(1);
    doc.removeLayer(0);
    expect(doc.layers).toHaveLength(1);
    doc.mergeDown(0); // index 0 has nothing below — no-op
    expect(doc.layers).toHaveLength(1);
  });
});

describe("ImageDocument crop / trim", () => {
  it("computes trimBounds of the non-transparent content", () => {
    const doc = newDoc(8, 8);
    doc.setPixel(2, 3, [255, 0, 0]);
    doc.setPixel(5, 6, [0, 255, 0]);
    expect(doc.trimBounds()).toEqual({ x: 2, y: 3, width: 4, height: 4 });
  });

  it("trimBounds is null for an empty image", () => {
    expect(newDoc(4, 4).trimBounds()).toBeNull();
  });

  it("cropped() returns a new document of the rectangle", () => {
    const doc = newDoc(8, 8);
    doc.setPixel(2, 2, [1, 2, 3]);
    const c = doc.cropped(2, 2, 3, 3);
    expect(c.width).toBe(3);
    expect(c.height).toBe(3);
    expect(c.getPixel(0, 0)).toEqual([1, 2, 3, 255]);
    // original is untouched
    expect(doc.width).toBe(8);
  });
});

describe("ImageDocument selection modes", () => {
  it("selects by colour into a mask + bounding rect", () => {
    const doc = newDoc(4, 4);
    doc.setPixel(1, 1, [200, 0, 0]);
    doc.setPixel(2, 2, [200, 0, 0]);
    doc.selectByColor([200, 0, 0]);
    expect(doc.selection).toEqual({ x: 1, y: 1, width: 2, height: 2 });
    expect(doc.selectionMask).not.toBeNull();
    expect(doc.selectionMask![1 * 4 + 1]).toBe(255);
    expect(doc.selectionMask![0]).toBe(0);
  });

  it("selects transparent pixels via alpha", () => {
    const doc = newDoc(2, 2);
    doc.setPixel(0, 0, [1, 2, 3]); // opaque
    doc.selectAlpha();
    // three transparent pixels selected
    const set = [...doc.selectionMask!].filter((v) => v === 255).length;
    expect(set).toBe(3);
  });

  it("layer → selection picks the opaque pixels", () => {
    const doc = newDoc(3, 3);
    doc.setPixel(2, 2, [9, 9, 9]);
    doc.layerToSelection();
    expect(doc.selection).toEqual({ x: 2, y: 2, width: 1, height: 1 });
  });

  it("magic-wand selects a contiguous region", () => {
    const doc = newDoc(4, 4);
    // fill a 2x2 block of one colour
    doc.setPixel(0, 0, [5, 5, 5]);
    doc.setPixel(1, 0, [5, 5, 5]);
    doc.setPixel(0, 1, [5, 5, 5]);
    doc.setPixel(1, 1, [5, 5, 5]);
    doc.magicWandSelect(0, 0);
    const set = [...doc.selectionMask!].filter((v) => v === 255).length;
    expect(set).toBe(4);
  });

  it("inverts the selection", () => {
    const doc = newDoc(2, 2);
    doc.selection = { x: 0, y: 0, width: 1, height: 1 };
    doc.invertSelection();
    // 4 px total, 1 was selected -> 3 now
    const set = [...doc.selectionMask!].filter((v) => v === 255).length;
    expect(set).toBe(3);
  });

  it("selectNotInPalette flags off-palette colours", () => {
    const doc = newDoc(2, 2);
    // palette default does not contain (123,45,67)
    doc.setPixel(0, 0, [123, 45, 67]);
    doc.selectNotInPalette();
    expect(doc.selectionMask![0]).toBe(255);
  });

  it("copyRegion honours a non-rectangular mask", () => {
    const doc = newDoc(3, 1);
    doc.setPixel(0, 0, [10, 10, 10]);
    doc.setPixel(2, 0, [20, 20, 20]);
    // mask selects only the two end pixels (bounding rect spans all 3)
    const mask = new Uint8Array(3);
    mask[0] = 255;
    mask[2] = 255;
    doc.setSelectionMask(mask);
    const region = doc.copyRegion(doc.selection!);
    expect(region.width).toBe(3);
    // middle pixel excluded -> transparent
    expect(region.data[1 * 4 + 3]).toBe(0);
    expect(region.data[0 * 4 + 3]).toBe(255);
    expect(region.data[2 * 4 + 3]).toBe(255);
  });
});

describe("ImageDocument frame operations", () => {
  it("clears a frame's pixels", () => {
    const doc = newDoc(2, 2);
    doc.setPixel(0, 0, [1, 2, 3]);
    doc.clearFrame();
    expect(doc.getPixel(0, 0)).toEqual([0, 0, 0, 0]);
  });

  it("moves a frame to the end", () => {
    const doc = newDoc(2, 2);
    doc.setPixel(0, 0, [9, 9, 9]); // frame 0 marker
    doc.addFrame(); // frame 1 (blank), active
    doc.goToFrame(0);
    doc.moveFrameToEnd();
    expect(doc.activeFrameIndex).toBe(1);
    // the marked frame is now last
    expect(doc.getPixel(0, 0)).toEqual([9, 9, 9, 255]);
  });

  it("converts frames to layers and back", () => {
    const doc = newDoc(2, 2);
    doc.setPixel(0, 0, [10, 0, 0]);
    doc.addFrame();
    doc.setPixel(1, 1, [0, 10, 0]);
    expect(doc.frameCount).toBe(2);
    doc.framesToLayers();
    expect(doc.frameCount).toBe(1);
    expect(doc.layers).toHaveLength(2);
    doc.layersToFrames();
    expect(doc.frameCount).toBe(2);
    expect(doc.layers).toHaveLength(1);
  });

  it("builds a horizontal sprite sheet from frames", () => {
    const doc = newDoc(4, 3);
    doc.addFrame();
    doc.addFrame(); // 3 frames
    const sheet = doc.toSpriteSheet();
    expect(sheet.width).toBe(12); // 4 * 3
    expect(sheet.height).toBe(3);
    expect(sheet.frameCount).toBe(1);
  });
});

describe("ImageDocument layer masks", () => {
  it("a hide-all mask makes the layer composite transparent", () => {
    const doc = newDoc(2, 2);
    doc.setPixel(0, 0, [255, 0, 0]);
    expect(doc.composite()[3]).toBe(255);
    doc.addLayerMask(false); // hide all
    expect(doc.composite()[3]).toBe(0);
  });

  it("disabling the mask restores the layer", () => {
    const doc = newDoc(2, 2);
    doc.setPixel(0, 0, [255, 0, 0]);
    doc.addLayerMask(false);
    expect(doc.composite()[3]).toBe(0);
    doc.setLayerMaskEnabled(false);
    expect(doc.composite()[3]).toBe(255);
  });

  it("applies the mask into the alpha then drops it", () => {
    const doc = newDoc(2, 2);
    doc.setPixel(0, 0, [255, 0, 0]);
    doc.addLayerMask(true);
    doc.setMaskPixel(0, 0, 0); // hide the pixel via the mask
    doc.applyLayerMask();
    expect(doc.layers[0]!.mask).toBeNull();
    expect(doc.getPixel(0, 0)![3]).toBe(0); // baked into alpha
  });

  it("delete removes the mask", () => {
    const doc = newDoc(2, 2);
    doc.addLayerMask(true);
    expect(doc.layers[0]!.mask).not.toBeNull();
    doc.deleteLayerMask();
    expect(doc.layers[0]!.mask).toBeNull();
  });

  it("mask survives an undo snapshot round-trip", () => {
    const doc = newDoc(2, 2);
    doc.setPixel(0, 0, [9, 9, 9]);
    doc.addLayerMask(false);
    const snap = doc.snapshot();
    doc.deleteLayerMask();
    doc.restore(snap);
    expect(doc.layers[0]!.mask).not.toBeNull();
    expect(doc.composite()[3]).toBe(0);
  });
});

describe("ImageDocument polygon selection", () => {
  it("selects pixels inside a triangle", () => {
    const doc = newDoc(8, 8);
    doc.selectPolygon([
      [1, 1],
      [6, 1],
      [1, 6],
    ]);
    expect(doc.selectionMask).not.toBeNull();
    // a point well inside the triangle is selected
    expect(doc.selectionMask![2 * 8 + 2]).toBe(255);
    // a point outside (bottom-right) is not
    expect(doc.selectionMask![7 * 8 + 7]).toBe(0);
  });

  it("ignores degenerate polygons (<3 points)", () => {
    const doc = newDoc(4, 4);
    doc.selectPolygon([[0, 0], [1, 1]]);
    expect(doc.selectionMask).toBeNull();
  });
});

describe("ImageDocument colour-mask stencil", () => {
  it("protects pixels of the stencil colour from drawing", () => {
    const doc = newDoc(2, 2);
    doc.setPixel(0, 0, [10, 20, 30]);
    doc.stencilColor = [10, 20, 30];
    // drawing over the protected pixel is ignored
    doc.setPixel(0, 0, [255, 255, 255]);
    expect(doc.getPixel(0, 0)).toEqual([10, 20, 30, 255]);
    // other pixels draw normally
    doc.setPixel(1, 1, [99, 99, 99]);
    expect(doc.getPixel(1, 1)).toEqual([99, 99, 99, 255]);
  });
});

describe("ImageDocument copyToLayer + topLayerAt", () => {
  it("copies the selection into a new floating layer", () => {
    const doc = newDoc(4, 4);
    doc.setPixel(1, 1, [7, 7, 7]);
    doc.selection = { x: 0, y: 0, width: 2, height: 2 };
    const before = doc.layers.length;
    doc.copyToLayer();
    expect(doc.layers.length).toBe(before + 1);
    // the new layer holds the copied pixel
    expect(doc.getPixel(1, 1, doc.activeLayer)).toEqual([7, 7, 7, 255]);
  });

  it("topLayerAt finds the upper opaque layer", () => {
    const doc = newDoc(2, 2);
    doc.setPixel(0, 0, [1, 1, 1]); // layer 0
    doc.addLayer("top");
    doc.setPixel(0, 0, [2, 2, 2]); // layer 1
    expect(doc.topLayerAt(0, 0)).toBe(1);
    expect(doc.topLayerAt(1, 1)).toBe(-1); // nothing there
  });
});

describe("ImageDocument parametric brush", () => {
  it("paintDab paints a soft filled circle", () => {
    const doc = newDoc(16, 16);
    doc.paintDab(8, 8, [255, 0, 0], 6, 0, 1);
    // centre painted opaque
    expect(doc.getPixel(8, 8)![3]).toBe(255);
    expect([doc.getPixel(8, 8)![0], doc.getPixel(8, 8)![1]]).toEqual([255, 0]);
    // far corner untouched
    expect(doc.getPixel(0, 0)![3]).toBe(0);
  });

  it("paintBrushStroke lays dabs along the segment", () => {
    const doc = newDoc(32, 8);
    doc.paintBrushStroke(2, 4, 28, 4, [0, 0, 255], {
      size: 4,
      softness: 0,
      opacity: 100,
      flow: 100,
      jitter: 0,
    });
    expect(doc.getPixel(2, 4)![3]).toBeGreaterThan(0);
    expect(doc.getPixel(28, 4)![3]).toBeGreaterThan(0);
    expect(doc.getPixel(15, 4)![3]).toBeGreaterThan(0); // middle covered
  });
})
