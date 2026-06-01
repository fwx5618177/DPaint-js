import { describe, it, expect } from "vitest";
import { ImageDocument } from "../src/model/ImageDocument";
import {
  serializeDocument,
  serializeToString,
  deserializeDocument,
  deserializeFromString,
} from "../src/model/serialization";

function sampleDoc() {
  const doc = new ImageDocument({ width: 4, height: 3 });
  doc.setPixel(0, 0, [255, 0, 0]);
  doc.setPixel(3, 2, [0, 128, 255, 200]);
  doc.addLayer("Top");
  doc.layers[1]!.opacity = 0.5;
  doc.layers[1]!.visible = false;
  doc.setPixel(1, 1, [9, 9, 9]);
  return doc;
}

describe("serialization round-trip", () => {
  it("preserves dimensions, palette and layer metadata", () => {
    const doc = sampleDoc();
    const restored = deserializeDocument(serializeDocument(doc));
    expect(restored.width).toBe(4);
    expect(restored.height).toBe(3);
    expect(restored.palette).toEqual(doc.palette);
    expect(restored.layers).toHaveLength(2);
    expect(restored.layers[1]!.name).toBe("Top");
    expect(restored.layers[1]!.opacity).toBe(0.5);
    expect(restored.layers[1]!.visible).toBe(false);
    expect(restored.activeLayerIndex).toBe(1);
  });

  it("preserves exact pixel data", () => {
    const doc = sampleDoc();
    const restored = deserializeDocument(serializeDocument(doc));
    expect(restored.getPixel(0, 0, restored.layers[0]!)).toEqual([255, 0, 0, 255]);
    expect(restored.getPixel(3, 2, restored.layers[0]!)).toEqual([0, 128, 255, 200]);
    expect(restored.getPixel(1, 1, restored.layers[1]!)).toEqual([9, 9, 9, 255]);
  });

  it("round-trips through a JSON string", () => {
    const doc = sampleDoc();
    const json = serializeToString(doc);
    expect(typeof json).toBe("string");
    const restored = deserializeFromString(json);
    expect(restored.colorCount()).toBe(doc.colorCount());
  });

  it("tags the serialized structure with format + version", () => {
    const data = serializeDocument(new ImageDocument({ width: 2, height: 2 }));
    expect(data.format).toBe("dpaintjs");
    expect(data.version).toBe(1);
  });
});

describe("serialization validation", () => {
  it("rejects an unknown format", () => {
    const data = serializeDocument(new ImageDocument({ width: 2, height: 2 }));
    expect(() => deserializeDocument({ ...data, format: "png" as never })).toThrow(/format/);
  });

  it("rejects an unsupported version", () => {
    const data = serializeDocument(new ImageDocument({ width: 2, height: 2 }));
    expect(() => deserializeDocument({ ...data, version: 99 as never })).toThrow(/version/);
  });

  it("rejects layer data of the wrong size", () => {
    const data = serializeDocument(new ImageDocument({ width: 2, height: 2 }));
    data.frames![0]![0]!.data = btoa("too short");
    expect(() => deserializeDocument(data)).toThrow(/bytes/);
  });
});
