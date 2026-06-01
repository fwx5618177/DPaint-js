import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { COMMAND, createEventBus, type EventBus } from "@dpaint/runtime";
import type { ColorArray } from "@dpaint/primitives";
import {
  detectFormat,
  encodePNG,
  decodePNG,
  decodeGIF,
  encodeGIF,
  encodeAnimatedGIF,
  decodeILBM,
  encodeILBM,
  encodeHAM6,
  encodeSHAM,
  encodePSD,
  decodePSD,
  decodeDEGAS,
  decodeNeo,
  decodeAseprite,
  decodeAmigaIcon,
  AdfDisk,
} from "@dpaint/codecs";
import {
  buildPaletteFromImage,
  quantizeToPalette,
  floydSteinberg,
  indicesToRGBA,
  posterize,
  threshold,
  cyclePalette,
  reduceColorDepth,
  reducePalette,
  offset,
  medianFilter,
  sharpen,
  displace,
  glow,
  dots,
  speckles,
  lines,
  web,
  ripples,
  matte,
  stackBlur,
  type ColorRange,
  type ColorDepth,
} from "@dpaint/imaging";
import {
  ImageDocument,
  type DocumentSnapshot,
  type Layer,
  type PixelRegion,
} from "@dpaint/document";
import { History } from "@dpaint/document";
import { serializeToString, deserializeFromString } from "@dpaint/document";
import type { ToolId } from "@dpaint/document";
import { saveAutosave, loadAutosave } from "./autosave";

export type ArtisticFilter = "displace" | "glow" | "dots" | "speckles" | "lines" | "web" | "ripples";

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
  /** Resize the whole document (nearest-neighbour). */
  resize: (width: number, height: number) => void;
  /** Scale the document by a factor (clamped to >= 1px). */
  scale: (factor: number) => void;
  /** Quality resample by a factor (area-average / bicubic). */
  resampleScale: (factor: number) => void;
  /** Rotate the whole document 90° (left = counter-clockwise). */
  rotate: (left: boolean) => void;
  /** Rotate the whole document by an arbitrary angle (degrees). */
  rotateFree: (angleDeg: number) => void;
  /** Alpha-matte (defringe) the active layer. */
  matteImage: () => void;
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
  /** Encode the flattened document as a HAM6 Amiga IFF. */
  exportHAM: () => Uint8Array;
  /** Encode the flattened document as a sliced-HAM (SHAM) Amiga IFF. */
  exportSHAM: () => Uint8Array;
  /** Encode the flattened document as a PSD. */
  exportPSD: () => Uint8Array;
  /** Load an image file (PNG or GIF) into a new document. Returns true on success. */
  loadImageBytes: (bytes: Uint8Array, name?: string) => Promise<boolean>;
  /** Mount an Amiga ADF disk image and open the first image file it contains. */
  loadADF: (bytes: Uint8Array) => Promise<boolean>;

  /** Colour reduction: derive the palette from the image, or dither to it. */
  paletteFromImage: () => void;
  ditherImage: () => void;
  /** Pixel effects applied to the active layer. */
  posterizeImage: () => void;
  thresholdImage: () => void;
  blurImage: () => void;
  /** Limit colours to an Amiga/Atari hardware depth (4 = 12-bit, 3 = 9-bit). */
  reduceToDepth: (depth: ColorDepth) => void;
  /** Artistic filters on the active layer. */
  offsetImage: () => void;
  medianSmooth: () => void;
  sharpenImage: () => void;
  applyArtistic: (name: ArtisticFilter) => void;

  /** Amiga-style colour cycling (non-destructive animated preview). */
  colorCycleActive: boolean;
  toggleColorCycle: () => void;

  /** Animation frames. */
  frameCount: number;
  activeFrameIndex: number;
  addFrame: () => void;
  duplicateFrame: () => void;
  deleteFrame: () => void;
  goToFrame: (index: number) => void;
  nextFrame: () => void;
  prevFrame: () => void;

  /** Selection + clipboard. */
  hasClipboard: boolean;
  selectAll: () => void;
  deselect: () => void;
  copySelection: () => void;
  cutSelection: () => void;
  paste: () => void;

  /** Overlays + palette editing. */
  showGrid: boolean;
  toggleGrid: () => void;
  showRulers: boolean;
  toggleRulers: () => void;
  setPaletteColor: (index: number, color: ColorArray) => void;
  addPaletteColor: (color: ColorArray) => void;
  removePaletteColor: (index: number) => void;

  /** Image transforms (all layers) and layer effects, each an undo checkpoint. */
  flipHorizontal: () => void;
  flipVertical: () => void;
  invert: () => void;
  grayscale: () => void;

  /** Restore the last autosaved project from local storage (if any). */
  restoreAutosave: () => boolean;

  /** Session recorder: capture each edit as a frame and export an animated GIF. */
  recording: boolean;
  recordedFrameCount: number;
  toggleRecording: () => void;
  exportRecording: () => Uint8Array | null;
}

const EditorContext = createContext<EditorApi | null>(null);

export interface EditorProviderProps {
  width?: number;
  height?: number;
  /** Restore the autosaved project on mount (the real app; off in tests). */
  autoRestore?: boolean;
  children: ReactNode;
}

export function EditorProvider({ width = 64, height = 48, autoRestore = false, children }: EditorProviderProps) {
  const docRef = useRef<ImageDocument>(new ImageDocument({ width, height }));
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(false);
  const recordedFramesRef = useRef<Uint8ClampedArray[]>([]);
  const [recordedFrameCount, setRecordedFrameCount] = useState(0);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [version, setVersion] = useState(0);
  const [tool, setTool] = useState<ToolId>("pencil");
  const [color, setColor] = useState<ColorArray>([255, 255, 255]);
  const [bgColor, setBgColor] = useState<ColorArray>([0, 0, 0]);
  const [zoom, setZoom] = useState(8);
  const [colorCycleActive, setColorCycleActive] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showRulers, setShowRulers] = useState(false);
  const [hasClipboard, setHasClipboard] = useState(false);
  const clipboardRef = useRef<PixelRegion | null>(null);
  const cycleRef = useRef<{
    id: ReturnType<typeof setInterval>;
    layer: Layer;
    original: Uint8ClampedArray;
  } | null>(null);
  const busRef = useRef<EventBus>(createEventBus());
  const historyRef = useRef<History<DocumentSnapshot>>(new History<DocumentSnapshot>(50));
  if (historyRef.current.size === 0) historyRef.current.reset(docRef.current.snapshot());

  const commit = useCallback(() => setVersion((v) => v + 1), []);

  const checkpoint = useCallback(() => {
    historyRef.current.push(docRef.current.snapshot());
    // debounced autosave to local storage
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      saveAutosave(serializeToString(docRef.current));
    }, 800);
    // session recorder
    if (recordingRef.current) {
      recordedFramesRef.current.push(docRef.current.composite());
      setRecordedFrameCount(recordedFramesRef.current.length);
    }
    setVersion((v) => v + 1);
  }, []);

  const restoreAutosave = useCallback(() => {
    const json = loadAutosave();
    if (!json) return false;
    try {
      docRef.current = deserializeFromString(json);
      historyRef.current.reset(docRef.current.snapshot());
      setVersion((v) => v + 1);
      return true;
    } catch {
      return false;
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (recordingRef.current) {
      recordingRef.current = false;
      setRecording(false);
    } else {
      recordingRef.current = true;
      recordedFramesRef.current = [docRef.current.composite()];
      setRecordedFrameCount(1);
      setRecording(true);
    }
  }, []);

  const exportRecording = useCallback((): Uint8Array | null => {
    const frames = recordedFramesRef.current;
    if (frames.length === 0) return null;
    const doc = docRef.current;
    const palette = buildPaletteFromImage(frames[frames.length - 1]!, 256);
    return encodeAnimatedGIF({
      width: doc.width,
      height: doc.height,
      palette,
      frames: frames.map((f) => ({ pixels: quantizeToPalette(f, palette), delayMs: 150 })),
    });
  }, []);

  useEffect(() => {
    if (autoRestore) restoreAutosave();
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [autoRestore, restoreAutosave]);

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

  const toggleGrid = useCallback(() => setShowGrid((v) => !v), []);
  const toggleRulers = useCallback(() => setShowRulers((v) => !v), []);

  const setPaletteColor = useCallback(
    (index: number, color: ColorArray) => {
      const doc = docRef.current;
      if (index >= 0 && index < doc.palette.length) {
        doc.palette[index] = [color[0]!, color[1]!, color[2]!];
        commit();
      }
    },
    [commit],
  );

  const addPaletteColor = useCallback(
    (color: ColorArray) => {
      docRef.current.palette.push([color[0]!, color[1]!, color[2]!]);
      commit();
    },
    [commit],
  );

  const removePaletteColor = useCallback(
    (index: number) => {
      const doc = docRef.current;
      if (doc.palette.length > 1 && index >= 0 && index < doc.palette.length) {
        doc.palette.splice(index, 1);
        commit();
      }
    },
    [commit],
  );

  const resize = useCallback(
    (w: number, h: number) => {
      const width = Math.max(1, Math.round(w));
      const height = Math.max(1, Math.round(h));
      docRef.current = docRef.current.resized(width, height);
      historyRef.current.reset(docRef.current.snapshot());
      commit();
    },
    [commit],
  );

  const scale = useCallback(
    (factor: number) => {
      const doc = docRef.current;
      resize(doc.width * factor, doc.height * factor);
    },
    [resize],
  );

  const resampleScale = useCallback(
    (factor: number) => {
      const doc = docRef.current;
      docRef.current = doc.resampled(
        Math.max(1, Math.round(doc.width * factor)),
        Math.max(1, Math.round(doc.height * factor)),
      );
      historyRef.current.reset(docRef.current.snapshot());
      commit();
    },
    [commit],
  );

  const rotate = useCallback(
    (left: boolean) => {
      docRef.current = docRef.current.rotated90(left);
      historyRef.current.reset(docRef.current.snapshot());
      commit();
    },
    [commit],
  );

  const rotateFree = useCallback(
    (angleDeg: number) => {
      docRef.current = docRef.current.rotatedFree(angleDeg);
      historyRef.current.reset(docRef.current.snapshot());
      commit();
    },
    [commit],
  );

  const matteImage = useCallback(() => {
    const doc = docRef.current;
    doc.activeLayer.data.set(matte(doc.activeLayer.data, doc.width, doc.height));
    checkpoint();
  }, [checkpoint]);

  const addFrame = useCallback(() => {
    docRef.current.addFrame();
    commit();
  }, [commit]);

  const duplicateFrame = useCallback(() => {
    docRef.current.duplicateFrame();
    commit();
  }, [commit]);

  const deleteFrame = useCallback(() => {
    docRef.current.removeFrame(docRef.current.activeFrameIndex);
    commit();
  }, [commit]);

  const goToFrame = useCallback(
    (index: number) => {
      docRef.current.goToFrame(index);
      commit();
    },
    [commit],
  );

  const nextFrame = useCallback(() => {
    const doc = docRef.current;
    doc.goToFrame((doc.activeFrameIndex + 1) % doc.frameCount);
    commit();
  }, [commit]);

  const prevFrame = useCallback(() => {
    const doc = docRef.current;
    doc.goToFrame((doc.activeFrameIndex - 1 + doc.frameCount) % doc.frameCount);
    commit();
  }, [commit]);

  const selectAll = useCallback(() => {
    const doc = docRef.current;
    doc.selection = { x: 0, y: 0, width: doc.width, height: doc.height };
    commit();
  }, [commit]);

  const deselect = useCallback(() => {
    docRef.current.selection = null;
    commit();
  }, [commit]);

  const copySelection = useCallback(() => {
    const doc = docRef.current;
    const sel = doc.selection ?? { x: 0, y: 0, width: doc.width, height: doc.height };
    clipboardRef.current = doc.copyRegion(sel);
    setHasClipboard(true);
  }, []);

  const cutSelection = useCallback(() => {
    const doc = docRef.current;
    const sel = doc.selection ?? { x: 0, y: 0, width: doc.width, height: doc.height };
    clipboardRef.current = doc.copyRegion(sel);
    setHasClipboard(true);
    doc.clearRegion(sel);
    checkpoint();
  }, [checkpoint]);

  const paste = useCallback(() => {
    const region = clipboardRef.current;
    if (!region) return;
    const doc = docRef.current;
    const at = doc.selection ?? { x: 0, y: 0, width: region.width, height: region.height };
    doc.stampRegion(region, at.x, at.y);
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
    const palette = doc.palette.length ? doc.palette : buildPaletteFromImage(doc.composite(), 256);
    if (doc.frameCount > 1) {
      const frames = doc.frames.map((_, i) => ({
        pixels: quantizeToPalette(doc.composite(i), palette),
        delayMs: 120,
      }));
      return encodeAnimatedGIF({ width: doc.width, height: doc.height, palette, frames });
    }
    const pixels = quantizeToPalette(doc.composite(), palette);
    return encodeGIF({ width: doc.width, height: doc.height, pixels, palette });
  }, []);

  const exportILBM = useCallback(() => {
    const doc = docRef.current;
    const composite = doc.composite();
    const palette = doc.palette.length ? doc.palette : buildPaletteFromImage(composite, 32);
    const pixels = quantizeToPalette(composite, palette);
    return encodeILBM({ width: doc.width, height: doc.height, pixels, palette });
  }, []);

  const exportHAM = useCallback(() => {
    const doc = docRef.current;
    const composite = doc.composite();
    const palette = buildPaletteFromImage(composite, 16);
    return encodeHAM6({ width: doc.width, height: doc.height, data: composite, palette });
  }, []);

  const exportSHAM = useCallback(() => {
    const doc = docRef.current;
    return encodeSHAM({ width: doc.width, height: doc.height, data: doc.composite() });
  }, []);

  const exportPSD = useCallback(() => {
    const doc = docRef.current;
    return encodePSD({ width: doc.width, height: doc.height, data: doc.composite() });
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

  const posterizeImage = useCallback(() => {
    const layer = docRef.current.activeLayer;
    layer.data.set(posterize(layer.data, 4));
    checkpoint();
  }, [checkpoint]);

  const thresholdImage = useCallback(() => {
    const layer = docRef.current.activeLayer;
    layer.data.set(threshold(layer.data, 128));
    checkpoint();
  }, [checkpoint]);

  const blurImage = useCallback(() => {
    const doc = docRef.current;
    const layer = doc.activeLayer;
    layer.data.set(stackBlur(layer.data, doc.width, doc.height, 2));
    checkpoint();
  }, [checkpoint]);

  const reduceToDepth = useCallback(
    (depth: ColorDepth) => {
      const doc = docRef.current;
      doc.activeLayer.data.set(reduceColorDepth(doc.activeLayer.data, depth));
      doc.palette = reducePalette(doc.palette, depth);
      checkpoint();
    },
    [checkpoint],
  );

  const offsetImage = useCallback(() => {
    const doc = docRef.current;
    const layer = doc.activeLayer;
    layer.data.set(offset(layer.data, doc.width, doc.height, doc.width >> 1, doc.height >> 1));
    checkpoint();
  }, [checkpoint]);

  const medianSmooth = useCallback(() => {
    const doc = docRef.current;
    const layer = doc.activeLayer;
    layer.data.set(medianFilter(layer.data, doc.width, doc.height, 1));
    checkpoint();
  }, [checkpoint]);

  const sharpenImage = useCallback(() => {
    const doc = docRef.current;
    const layer = doc.activeLayer;
    layer.data.set(sharpen(layer.data, doc.width, doc.height));
    checkpoint();
  }, [checkpoint]);

  const applyArtistic = useCallback(
    (name: ArtisticFilter) => {
      const doc = docRef.current;
      const layer = doc.activeLayer;
      const { width: w, height: h } = doc;
      let result: Uint8ClampedArray;
      switch (name) {
        case "displace":
          result = displace(layer.data, w, h, { colWidth: 4, rowWidth: 4, hShift: -1, vShift: 1 });
          break;
        case "glow":
          result = glow(layer.data, w, h);
          break;
        case "dots":
          result = dots(layer.data, w, h);
          break;
        case "speckles":
          result = speckles(layer.data, w, h);
          break;
        case "lines":
          result = lines(layer.data, w, h);
          break;
        case "web":
          result = web(layer.data, w, h);
          break;
        case "ripples":
          result = ripples(layer.data, w, h, { dropX: Math.floor(w / 2), dropY: Math.floor(h / 2) });
          break;
      }
      layer.data.set(result);
      checkpoint();
    },
    [checkpoint],
  );

  const stopColorCycle = useCallback(() => {
    const session = cycleRef.current;
    if (!session) return;
    clearInterval(session.id);
    session.layer.data.set(session.original); // restore — cycling is a preview
    cycleRef.current = null;
    setColorCycleActive(false);
    commit();
  }, [commit]);

  const startColorCycle = useCallback(() => {
    if (cycleRef.current) return;
    const doc = docRef.current;
    const layer = doc.activeLayer;
    const original = new Uint8ClampedArray(layer.data);
    const indices = quantizeToPalette(layer.data, doc.palette);
    const basePalette = doc.palette.map((c) => c.slice());
    const ranges: ColorRange[] = [{ low: 0, high: doc.palette.length - 1 }];
    let tick = 0;
    const id = setInterval(() => {
      tick++;
      const cycled = cyclePalette(basePalette, ranges, tick);
      const rgba = indicesToRGBA(indices, cycled);
      for (let i = 0; i < original.length; i += 4) {
        if (original[i + 3] === 0) rgba[i + 3] = 0; // keep transparency
      }
      layer.data.set(rgba);
      commit();
    }, 120);
    cycleRef.current = { id, layer, original };
    setColorCycleActive(true);
  }, [commit]);

  const toggleColorCycle = useCallback(() => {
    if (cycleRef.current) stopColorCycle();
    else startColorCycle();
  }, [startColorCycle, stopColorCycle]);

  useEffect(() => {
    return () => {
      if (cycleRef.current) clearInterval(cycleRef.current.id);
    };
  }, []);

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
      } else if (format === "PSD") {
        image = decodePSD(bytes);
      } else if (format === "DEGAS") {
        const d = decodeDEGAS(bytes);
        image = { width: d.width, height: d.height, data: d.data };
        if (d.palette.length) palette = d.palette;
      } else if (format === "NEO") {
        const d = decodeNeo(bytes);
        image = { width: d.width, height: d.height, data: d.data };
        if (d.palette.length) palette = d.palette;
      } else if (format === "ASEPRITE") {
        const a = await decodeAseprite(bytes);
        image = { width: a.width, height: a.height, data: a.data };
      } else if (format === "ICON") {
        const i = decodeAmigaIcon(bytes);
        image = { width: i.width, height: i.height, data: i.data };
      }
      if (!image) return false;
      docRef.current = ImageDocument.fromRGBA(image.width, image.height, image.data, palette);
      historyRef.current.reset(docRef.current.snapshot());
      commit();
      return true;
    },
    [commit],
  );

  const loadADF = useCallback(
    async (bytes: Uint8Array) => {
      const disk = new AdfDisk(bytes);
      const imageExt = /\.(iff|ilbm|lbm|png|info)$/i;
      const target = disk.list().find((e) => e.type === "FILE" && imageExt.test(e.name));
      if (!target) return false;
      return loadImageBytes(disk.readFile(target.sector), target.name);
    },
    [loadImageBytes],
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
      resize,
      scale,
      resampleScale,
      rotate,
      rotateFree,
      matteImage,
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
      exportHAM,
      exportSHAM,
      exportPSD,
      loadImageBytes,
      loadADF,
      paletteFromImage,
      ditherImage,
      posterizeImage,
      thresholdImage,
      blurImage,
      reduceToDepth,
      offsetImage,
      medianSmooth,
      sharpenImage,
      applyArtistic,
      colorCycleActive,
      toggleColorCycle,
      frameCount: docRef.current.frameCount,
      activeFrameIndex: docRef.current.activeFrameIndex,
      addFrame,
      duplicateFrame,
      deleteFrame,
      goToFrame,
      nextFrame,
      prevFrame,
      hasClipboard,
      selectAll,
      deselect,
      copySelection,
      cutSelection,
      paste,
      flipHorizontal,
      flipVertical,
      invert,
      grayscale,
      showGrid,
      toggleGrid,
      showRulers,
      toggleRulers,
      setPaletteColor,
      addPaletteColor,
      removePaletteColor,
      restoreAutosave,
      recording,
      recordedFrameCount,
      toggleRecording,
      exportRecording,
    }),
    [
      version,
      tool,
      color,
      bgColor,
      zoom,
      commit,
      newImage,
      resize,
      scale,
      resampleScale,
      rotate,
      rotateFree,
      matteImage,
      swapColors,
      checkpoint,
      undo,
      redo,
      serialize,
      loadProject,
      exportPNG,
      exportGIF,
      exportILBM,
      exportHAM,
      exportSHAM,
      exportPSD,
      loadImageBytes,
      loadADF,
      paletteFromImage,
      ditherImage,
      posterizeImage,
      thresholdImage,
      blurImage,
      reduceToDepth,
      offsetImage,
      medianSmooth,
      sharpenImage,
      applyArtistic,
      colorCycleActive,
      toggleColorCycle,
      addFrame,
      duplicateFrame,
      deleteFrame,
      goToFrame,
      nextFrame,
      prevFrame,
      hasClipboard,
      selectAll,
      deselect,
      copySelection,
      cutSelection,
      paste,
      flipHorizontal,
      flipVertical,
      invert,
      grayscale,
      showGrid,
      toggleGrid,
      showRulers,
      toggleRulers,
      setPaletteColor,
      addPaletteColor,
      removePaletteColor,
      restoreAutosave,
      recording,
      recordedFrameCount,
      toggleRecording,
      exportRecording,
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
    bus.on(COMMAND.TOGGLEGRID, () => toggleGrid());
    bus.on(COMMAND.TOGGLEPIXELGRID, () => toggleGrid());
    bus.on(COMMAND.TOGGLERULERS, () => toggleRulers());
    bus.on(COMMAND.CYCLEPALETTE, () => toggleColorCycle());
    bus.on(COMMAND.SELECTALL, () => selectAll());
    bus.on(COMMAND.CLEARSELECTION, () => deselect());
    bus.on(COMMAND.COPY, () => copySelection());
    bus.on(COMMAND.CUTTOLAYER, () => cutSelection());
    bus.on(COMMAND.PASTE, () => paste());
    bus.on(COMMAND.ADDFRAME, () => addFrame());
    bus.on(COMMAND.DELETEFRAME, () => deleteFrame());
    bus.on(COMMAND.DUPLICATEFRAME, () => duplicateFrame());
    bus.on(COMMAND.ROTATE, () => rotate(false));
    bus.on(COMMAND.RESAMPLE, () => resampleScale(0.5));
    bus.on(COMMAND.COLORDEPTH12, () => reduceToDepth(4));
    bus.on(COMMAND.COLORDEPTH9, () => reduceToDepth(3));
  }

  return <EditorContext.Provider value={api}>{children}</EditorContext.Provider>;
}

export function useEditor(): EditorApi {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within an EditorProvider");
  return ctx;
}
