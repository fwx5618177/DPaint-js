import type { ColorArray } from "@dpaint/util";
import { ImageDocument } from "./ImageDocument";

/** On-disk JSON shape for a saved DPaint.js project. */
export interface SerializedLayer {
  name: string;
  visible: boolean;
  opacity: number;
  /** base64-encoded RGBA pixel buffer */
  data: string;
}

export interface SerializedDocument {
  format: "dpaintjs";
  version: 1;
  width: number;
  height: number;
  activeLayerIndex: number;
  palette: ColorArray[];
  layers: SerializedLayer[];
}

export const PROJECT_FORMAT = "dpaintjs" as const;
export const PROJECT_VERSION = 1 as const;

function bytesToBase64(bytes: Uint8ClampedArray): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8ClampedArray {
  const binary = atob(b64);
  const out = new Uint8ClampedArray(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Serialize a document to the JSON project structure. */
export function serializeDocument(doc: ImageDocument): SerializedDocument {
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    width: doc.width,
    height: doc.height,
    activeLayerIndex: doc.activeLayerIndex,
    palette: doc.palette.map((c) => c.slice()),
    layers: doc.layers.map((l) => ({
      name: l.name,
      visible: l.visible,
      opacity: l.opacity,
      data: bytesToBase64(l.data),
    })),
  };
}

/** Serialize to a JSON string. */
export function serializeToString(doc: ImageDocument): string {
  return JSON.stringify(serializeDocument(doc));
}

/** Rebuild an ImageDocument from the JSON project structure. */
export function deserializeDocument(data: SerializedDocument): ImageDocument {
  if (data.format !== PROJECT_FORMAT) {
    throw new Error(`Unrecognised project format: ${String(data.format)}`);
  }
  if (data.version !== PROJECT_VERSION) {
    throw new Error(`Unsupported project version: ${String(data.version)}`);
  }
  const doc = new ImageDocument({
    width: data.width,
    height: data.height,
    palette: data.palette.map((c) => c.slice()),
  });
  doc.layers = data.layers.map((l) => {
    const bytes = base64ToBytes(l.data);
    const expected = data.width * data.height * 4;
    if (bytes.length !== expected) {
      throw new Error(`Layer "${l.name}" has ${bytes.length} bytes, expected ${expected}`);
    }
    return { name: l.name, visible: l.visible, opacity: l.opacity, data: bytes };
  });
  if (doc.layers.length === 0) doc.layers = [doc.createLayer("Layer 1")];
  doc.activeLayerIndex = Math.min(Math.max(0, data.activeLayerIndex), doc.layers.length - 1);
  return doc;
}

/** Parse a JSON string into an ImageDocument. */
export function deserializeFromString(json: string): ImageDocument {
  return deserializeDocument(JSON.parse(json) as SerializedDocument);
}
