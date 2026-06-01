import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { COMMAND, createEventBus, type EventBus } from "@dpaint/core";
import type { ColorArray } from "@dpaint/util";
import {
  detectFormat,
  encodePNG,
  decodePNG,
  decodeGIF,
  encodeGIF,
  decodeILBM,
  encodeILBM,
} from "@dpaint/fileformats";
import {
  buildPaletteFromImage,
  quantizeToPalette,
  floydSteinberg,
  indicesToRGBA,
} from "@dpaint/imaging";
import { ImageDocument, type DocumentSnapshot } from "../model/ImageDocument";
import { History } from "../model/History";
import { serializeToString, deserializeFromString } from "../model/serialization";
import type { ToolId } from "../model/tools";

export interface EditorApi {
  doc: ImageDocument;
  /** monotonically increasing render token; bump after mutating the document */
  version: number;
  bus: EventBus;

  tool: ToolId;
  setTool: (tool: ToolId) => void;

  color: ColorArray;
  setColor: (color: ColorArray) => void;
  bgColor: ColorArray;
  setBgColor: (color: ColorArray) => void;

  zoom: number;
  setZoom: (zoom: number) => void;

  /** Re-render after an in-place mutation of the document. */
  commit: () => void;
  newImage: (width: number, height: number) => void;
  swapColors: () => void;

  /** Record the current document state as an undo checkpoint. */
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  /** Serialize the current document to a JSON project string. */
  serialize: () => string;
  /** Replace the document with one parsed from a JSON project string. */
  loadProject: (json: string) => void;
  /** Encode the flattened document as PNG bytes. */
  exportPNG: () => Promise<Uint8Array>;
  /** Encode the flattened document as a (quantized) GIF. */
  exportGIF: () => Uint8Array;
  /** Encode the flattened document as a (quantized) Amiga IFF/ILBM. */
  exportILBM: () => Uint8Array;
  /** Load an image file (PNG or GIF) into a new document. Returns true on success. */
  loadImageBytes: (bytes: Uint8Array, name?: string) => Promise<boolean>;

  /** Colour reduction: derive the palette from the image, or dither to it. */
  paletteFromImage: () => void;
  ditherImage: () => void;

  /** Image transforms (all layers) and layer effects, each an undo checkpoint. */
  flipHorizontal: () => void;
  flipVertical: () => void;
  invert: () => void;
  grayscale: () => void;
}

const EditorContext = createContext<EditorApi | null>(null);

export interface EditorProviderProps {
  width?: number;
  height?: number;
  children: ReactNode;
}

export function EditorProvider({ width = 64, height = 48, children }: EditorProviderProps) {
  const docRef = useRef<ImageDocument>(new ImageDocument({ width, height }));
  const [version, setVersion] = useState(0);
  const [tool, setTool] = useState<ToolId>("pencil");
  const [color, setColor] = useState<ColorArray>([255, 255, 255]);
  const [bgColor, setBgColor] = useState<ColorArray>([0, 0, 0]);
  const [zoom, setZoom] = useState(8);
  const busRef = useRef<EventBus>(createEventBus());
  const historyRef = useRef<History<DocumentSnapshot>>(new History<DocumentSnapshot>(50));
  if (historyRef.current.size === 0) historyRef.current.reset(docRef.current.snapshot());

  const commit = useCallback(() => setVersion((v) => v + 1), []);

  const checkpoint = useCallback(() => {
    historyRef.current.push(docRef.current.snapshot());
    setVersion((v) => v + 1);
  }, []);

  const undo = useCallback(() => {
    const snap = historyRef.current.undo();
    if (snap) {
      docRef.current.restore(snap);
      setVersion((v) => v + 1);
    }
  }, []);

  const redo = useCallback(() => {
    const snap = historyRef.current.redo();
    if (snap) {
      docRef.current.restore(snap);
      setVersion((v) => v + 1);
    }
  }, []);

  const newImage = useCallback(
    (w: number, h: number) => {
      docRef.current = new ImageDocument({ width: w, height: h });
      historyRef.current.reset(docRef.current.snapshot());
      commit();
    },
    [commit],
  );

  const flipHorizontal = useCallback(() => {
    docRef.current.flipHorizontal();
    checkpoint();
  }, [checkpoint]);

  const flipVertical = useCallback(() => {
    docRef.current.flipVertical();
    checkpoint();
  }, [checkpoint]);

  const invert = useCallback(() => {
    docRef.current.invertColors();
    checkpoint();
  }, [checkpoint]);

  const grayscale = useCallback(() => {
    docRef.current.grayscale();
    checkpoint();
  }, [checkpoint]);

  const serialize = useCallback(() => serializeToString(docRef.current), []);

  const loadProject = useCallback(
    (json: string) => {
      docRef.current = deserializeFromString(json);
      historyRef.current.reset(docRef.current.snapshot());
      commit();
    },
    [commit],
  );

  const exportPNG = useCallback(() => {
    const doc = docRef.current;
    return encodePNG({ width: doc.width, height: doc.height, data: doc.composite() });
  }, []);

  const exportGIF = useCallback(() => {
    const doc = docRef.current;
    const composite = doc.composite();
    const palette = doc.palette.length ? doc.palette : buildPaletteFromImage(composite, 256);
    const pixels = quantizeToPalette(composite, palette);
    return encodeGIF({ width: doc.width, height: doc.height, pixels, palette });
  }, []);

  const exportILBM = useCallback(() => {
    const doc = docRef.current;
    const composite = doc.composite();
    const palette = doc.palette.length ? doc.palette : buildPaletteFromImage(composite, 32);
    const pixels = quantizeToPalette(composite, palette);
    return encodeILBM({ width: doc.width, height: doc.height, pixels, palette });
  }, []);

  const paletteFromImage = useCallback(() => {
    const doc = docRef.current;
    doc.palette = buildPaletteFromImage(doc.composite(), 16);
    checkpoint();
  }, [checkpoint]);

  const ditherImage = useCallback(() => {
    const doc = docRef.current;
    const layer = doc.activeLayer;
    const { indices } = floydSteinberg(layer.data, doc.width, doc.height, doc.palette);
    const rgba = indicesToRGBA(indices, doc.palette);
    for (let i = 0; i < layer.data.length; i += 4) {
      if (layer.data[i + 3] === 0) rgba[i + 3] = 0; // preserve transparency
    }
    layer.data.set(rgba);
    checkpoint();
  }, [checkpoint]);

  const loadImageBytes = useCallback(
    async (bytes: Uint8Array, name = "") => {
      const format = detectFormat(bytes, name);
      let image: { width: number; height: number; data: Uint8Array | Uint8ClampedArray } | null = null;
      let palette: ColorArray[] | undefined;
      if (format === "PNG") {
        image = await decodePNG(bytes);
      } else if (format === "GIF") {
        const gif = decodeGIF(bytes);
        const frame = gif.frames[0];
        if (frame) image = { width: gif.width, height: gif.height, data: frame.data };
      } else if (format === "ILBM") {
        const ilbm = decodeILBM(bytes);
        image = { width: ilbm.width, height: ilbm.height, data: ilbm.data };
        if (ilbm.palette.length) palette = ilbm.palette;
      }
      if (!image) return false;
      docRef.current = ImageDocument.fromRGBA(image.width, image.height, image.data, palette);
      historyRef.current.reset(docRef.current.snapshot());
      commit();
      return true;
    },
    [commit],
  );

  const swapColors = useCallback(() => {
    setColor(bgColor);
    setBgColor(color);
  }, [color, bgColor]);

  const api = useMemo<EditorApi>(
    () => ({
      doc: docRef.current,
      version,
      bus: busRef.current,
      tool,
      setTool,
      color,
      setColor,
      bgColor,
      setBgColor,
      zoom,
      setZoom,
      commit,
      newImage,
      swapColors,
      checkpoint,
      undo,
      redo,
      canUndo: historyRef.current.canUndo,
      canRedo: historyRef.current.canRedo,
      serialize,
      loadProject,
      exportPNG,
      exportGIF,
      exportILBM,
      loadImageBytes,
      paletteFromImage,
      ditherImage,
      flipHorizontal,
      flipVertical,
      invert,
      grayscale,
    }),
    [
      version,
      tool,
      color,
      bgColor,
      zoom,
      commit,
      newImage,
      swapColors,
      checkpoint,
      undo,
      redo,
      serialize,
      loadProject,
      exportPNG,
      exportGIF,
      exportILBM,
      loadImageBytes,
      paletteFromImage,
      ditherImage,
      flipHorizontal,
      flipVertical,
      invert,
      grayscale,
    ],
  );

  // Bridge legacy COMMAND events to the React API so the menu/bus can drive the
  // editor the way the original app did. These handlers only use functional
  // updates and refs, so binding once is safe (no stale closures).
  const bound = useRef(false);
  if (!bound.current) {
    bound.current = true;
    const bus = busRef.current;
    bus.on(COMMAND.CLEAR, () => {
      docRef.current.clear();
      checkpoint();
    });
    bus.on(COMMAND.ZOOMIN, () => setZoom((z) => Math.min(z + 1, 32)));
    bus.on(COMMAND.ZOOMOUT, () => setZoom((z) => Math.max(z - 1, 1)));
    bus.on(COMMAND.NEWLAYER, () => {
      docRef.current.addLayer();
      checkpoint();
    });
    bus.on(COMMAND.UNDO, () => undo());
    bus.on(COMMAND.REDO, () => redo());
    bus.on(COMMAND.FLIPHORIZONTAL, () => flipHorizontal());
    bus.on(COMMAND.FLIPVERTICAL, () => flipVertical());
    bus.on(COMMAND.PALETTEFROMIMAGE, () => paletteFromImage());
  }

  return <EditorContext.Provider value={api}>{children}</EditorContext.Provider>;
}

export function useEditor(): EditorApi {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within an EditorProvider");
  return ctx;
}
