import {
  createContext,
  type Dispatch,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SetStateAction,
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
  decodeANIM,
  decodePBM,
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
  encodeADF,
  decodePaletteFile,
  encodeACT,
  encodeJASC,
  type AdfEntry,
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
  extraHalfBrite,
  medianCut,
  adjustBrightness,
  adjustContrast,
  boxBlur,
  adjustSaturation,
  hueRotate,
  sepia as sepiaEffect,
  invert as invertEffect,
  colorBalance,
  unsharpMask,
  feather,
  outline,
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
  rotateArbitrary,
  resample,
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
import { rotateRegion, flipRegion } from "@dpaint/document";
import type { ToolId } from "@dpaint/document";
import { saveAutosave, loadAutosave } from "./autosave";
import { loadSettings, saveSettings, type UserSettings } from "./userSettings";

export type ArtisticFilter = "displace" | "glow" | "dots" | "speckles" | "lines" | "web" | "ripples";

export type EffectKind =
  | "brightness"
  | "contrast"
  | "saturation"
  | "hue"
  | "sepia"
  | "invert"
  | "blur"
  | "sharpen"
  | "texture"
  | "dehaze"
  | "balanceR"
  | "balanceG"
  | "balanceB"
  | "feather"
  | "outline";

export type PalettePresetId = "grayscale" | "cga" | "ega" | "gameboy";

export interface BrushSettings {
  size: number;
  softness: number;
  opacity: number;
  flow: number;
  jitter: number;
  rotation: number;
  /** 100 = round; lower = flatter ellipse (so rotation becomes visible). */
  roundness: number;
}

/**
 * 4×4 dither bitmasks (legacy brush dither patterns). Index 0 = solid. When a
 * pattern is active the brush paints the foreground colour where the pattern
 * bit is set, the background colour elsewhere.
 */
export const DITHER_PATTERNS: number[][] = [
  // 0: solid (all foreground)
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  // 1: 50% checkerboard
  [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1],
  // 2: 25% dots
  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0],
  // 3: horizontal lines
  [1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
];

/** Built-in palette presets selectable from the palette panel. */
export const PALETTE_PRESETS: Record<PalettePresetId, ColorArray[]> = {
  grayscale: Array.from({ length: 16 }, (_, i) => {
    const v = Math.round((i / 15) * 255);
    return [v, v, v] as ColorArray;
  }),
  cga: [
    [0, 0, 0],
    [85, 255, 255],
    [255, 85, 255],
    [255, 255, 255],
  ],
  ega: [
    [0, 0, 0],
    [0, 0, 170],
    [0, 170, 0],
    [0, 170, 170],
    [170, 0, 0],
    [170, 0, 170],
    [170, 85, 0],
    [170, 170, 170],
    [85, 85, 85],
    [85, 85, 255],
    [85, 255, 85],
    [85, 255, 255],
    [255, 85, 85],
    [255, 85, 255],
    [255, 255, 85],
    [255, 255, 255],
  ],
  gameboy: [
    [15, 56, 15],
    [48, 98, 48],
    [139, 172, 15],
    [155, 188, 15],
  ],
};

const LEGACY_STARTUP_PALETTE: ColorArray[] = [
  [149, 149, 149],
  [0, 0, 0],
  [255, 255, 255],
  [59, 103, 162],
  [123, 123, 123],
  [175, 175, 175],
  [170, 144, 124],
  [255, 169, 151],
];

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 32;
const DEFAULT_ZOOM = 8;

function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(zoom.toFixed(4))));
}

function zoomInStep(zoom: number): number {
  return zoom < 1 ? Math.min(1, zoom * 2) : zoom + 1;
}

function zoomOutStep(zoom: number): number {
  return zoom <= 1 ? zoom / 2 : zoom - 1;
}

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
  setZoom: Dispatch<SetStateAction<number>>;
  /** Pick the largest integer zoom that fits the image in the stage viewport. */
  zoomFit: () => void;

  /** Re-render after an in-place mutation of the document. */
  commit: () => void;
  newImage: (width: number, height: number) => void;
  /** Resize the whole document (nearest-neighbour). */
  resize: (width: number, height: number) => void;
  /** Scale the document by a factor (clamped to >= 1px). */
  scale: (factor: number) => void;
  /** Quality resample by a factor (area-average / bicubic). */
  resampleScale: (factor: number) => void;
  /** Crop the document to the current selection (no-op without one). */
  crop: () => void;
  /** Auto-crop transparent margins (trim to content). */
  trim: () => void;
  /** A short human-readable description of the image (size, frames, layers, colours). */
  imageInfo: () => string;
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
  /** Import an image file as a new layer in the current document. */
  importLayer: (bytes: Uint8Array, name?: string) => Promise<boolean>;
  /** Wrap the flattened image (ILBM) into an OFS ADF disk image. */
  saveToADF: () => Uint8Array;
  /** Mount an Amiga ADF disk image; opens the image, or lists files to pick. */
  loadADF: (bytes: Uint8Array) => Promise<boolean>;
  /** ADF file browser: image entries awaiting selection (null = closed). */
  adfEntries: AdfEntry[] | null;
  openAdfEntry: (sector: number, name: string) => Promise<boolean>;
  closeAdf: () => void;
  /** Fetch and open an image by URL (falls back to a CORS proxy). */
  openImageUrl: (url: string) => Promise<boolean>;
  /** Curated artwork gallery overlay. */
  galleryOpen: boolean;
  toggleGallery: () => void;

  /** Workspace UI modes. */
  presentationMode: boolean;
  togglePresentation: () => void;
  sidePanelVisible: boolean;
  toggleSidePanel: () => void;
  splitScreen: boolean;
  toggleSplitScreen: () => void;
  toggleFullscreen: () => void;
  aboutOpen: boolean;
  showAbout: () => void;
  closeAbout: () => void;
  preferencesOpen: boolean;
  showPreferences: () => void;
  closePreferences: () => void;
  settings: UserSettings;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
  /** Right-click context menu position (null = hidden). */
  contextMenu: { x: number; y: number } | null;
  showContextMenu: (x: number, y: number) => void;
  hideContextMenu: () => void;
  /** Amiga UAE "Deluxe" preview overlay. */
  uaeOpen: boolean;
  toggleUae: () => void;

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
  /** Image-adjustment effects (brightness/contrast/saturation/hue/sepia/…). */
  applyEffect: (kind: EffectKind, value: number) => void;

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
  /** Clear the active frame's pixels. */
  clearFrame: () => void;
  /** Move the active frame to the end of the timeline. */
  moveFrameToEnd: () => void;
  /** Collapse every frame into one frame (a layer per frame). */
  framesToLayers: () => void;
  /** Explode the active frame's layers into one frame each. */
  layersToFrames: () => void;
  /** Tile every frame into a single-frame sprite sheet. */
  layersToSheet: () => void;

  /** Selection + clipboard. */
  hasClipboard: boolean;
  selectAll: () => void;
  deselect: () => void;
  invertSelection: () => void;
  /** Select pixels of the active layer matching the foreground colour. */
  selectByColor: (tolerance?: number) => void;
  /** Select the transparent pixels of the composite. */
  selectAlpha: () => void;
  /** Select composite pixels whose colour is not in the palette. */
  selectNotInPalette: () => void;
  /** Select the opaque pixels of the active layer (layer → selection). */
  layerToSelection: () => void;
  /** Contiguous magic-wand selection from a pixel of the active layer. */
  magicWandSelect: (x: number, y: number, tolerance?: number) => void;
  /** Build a selection from a polygon outline (lasso). */
  selectPolygon: (points: Array<[number, number]>) => void;
  copySelection: () => void;
  cutSelection: () => void;
  paste: () => void;
  /** Free transform (scale + rotate) the selection content in place. */
  transformSelection: (scaleFactor: number, angleDeg: number) => void;

  /** Custom brush captured from the canvas. */
  hasBrush: boolean;
  captureBrush: () => void;
  clearBrush: () => void;
  rotateBrush: (left: boolean) => void;
  flipBrush: (horizontal: boolean) => void;
  stampBrush: (x: number, y: number) => void;
  setBrushRegion: (region: PixelRegion) => void;
  getBrush: () => PixelRegion | null;

  /** Overlays + palette editing. */
  showGrid: boolean;
  toggleGrid: () => void;
  showRulers: boolean;
  toggleRulers: () => void;
  showBitplanes: boolean;
  toggleBitplanes: () => void;
  setPaletteColor: (index: number, color: ColorArray) => void;
  addPaletteColor: (color: ColorArray) => void;
  removePaletteColor: (index: number) => void;
  /** Palette files + presets. */
  loadPalette: (bytes: Uint8Array, name?: string) => void;
  savePaletteACT: () => Uint8Array;
  savePaletteJASC: () => Uint8Array;
  exportPaletteImage: () => Promise<Uint8Array>;
  reducePaletteTo: (count: number) => void;
  applyPalettePreset: (name: PalettePresetId) => void;
  ehbActive: boolean;
  toggleEHB: () => void;
  paletteLocked: boolean;
  toggleLockPalette: () => void;
  /** Colour-mask stencil that protects the background colour from drawing. */
  colorMaskActive: boolean;
  toggleColorMask: () => void;
  /** Merge new colours from the image into the current palette. */
  expandPaletteFromImage: () => void;
  /** Advance colour cycling by one step (manual). */
  cycleStep: () => void;
  /** Restore full 24-bit truecolour (clears hardware reduction). */
  setColorDepth24: () => void;
  /** Multiple stored palettes. */
  paletteCount: number;
  activePaletteIndex: number;
  addPalette: () => void;
  removePalette: () => void;
  nextPalette: () => void;
  prevPalette: () => void;
  /** Brush draw options. */
  brushDither: boolean;
  toggleBrushDither: () => void;
  brushInvert: boolean;
  toggleBrushInvert: () => void;
  /** Parametric brush settings (size/softness/opacity/flow/jitter/rotation). */
  brushSettings: BrushSettings;
  setBrushSetting: <K extends keyof BrushSettings>(key: K, value: number) => void;
  /** Selected dither pattern index (0 = solid, 4 = custom). */
  ditherPattern: number;
  setDitherPattern: (index: number) => void;
  /** Custom 4×4 dither pattern + its editor. */
  customDither: number[];
  toggleDitherCell: (i: number) => void;
  ditherEditorOpen: boolean;
  openDitherEditor: () => void;
  closeDitherEditor: () => void;
  /** Paint a parametric brush stroke (used by the pencil when size/softness set). */
  brushStroke: (x0: number, y0: number, x1: number, y1: number, colorOverride?: ColorArray) => void;
  /** Erase along a segment with a brush of the current size (restores transparency). */
  eraseStroke: (x0: number, y0: number, x1: number, y1: number) => void;
  /** Copy the current selection into a new floating layer. */
  copyToLayer: () => void;
  /** Colour-cycling range editor. */
  cycleRanges: ColorRange[];
  setCycleRanges: (ranges: ColorRange[]) => void;
  cycleSpeed: number;
  setCycleSpeed: (ms: number) => void;

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

/** File extensions inside an ADF disk image that we can open as pictures. */
const ADF_IMAGE_EXT = /\.(iff|ilbm|lbm|png|info)$/i;

interface DecodedImage {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
  palette?: ColorArray[];
}

/** Decode any supported image file to RGBA (+ optional palette), or null. */
async function decodeAnyImage(bytes: Uint8Array, name = ""): Promise<DecodedImage | null> {
  const format = detectFormat(bytes, name);
  if (format === "PNG") return decodePNG(bytes);
  if (format === "GIF") {
    const gif = decodeGIF(bytes);
    const frame = gif.frames[0];
    return frame ? { width: gif.width, height: gif.height, data: frame.data } : null;
  }
  if (format === "ILBM") {
    const ilbm = decodeILBM(bytes);
    return {
      width: ilbm.width,
      height: ilbm.height,
      data: ilbm.data,
      palette: ilbm.palette.length ? ilbm.palette : undefined,
    };
  }
  if (format === "PBM") {
    const pbm = decodePBM(bytes);
    return {
      width: pbm.width,
      height: pbm.height,
      data: pbm.data,
      palette: pbm.palette.length ? pbm.palette : undefined,
    };
  }
  if (format === "ANIM") {
    // load just the first frame for the generic single-image path
    const anim = decodeANIM(bytes);
    return {
      width: anim.width,
      height: anim.height,
      data: anim.frames[0]!,
      palette: anim.palette.length ? anim.palette : undefined,
    };
  }
  if (format === "PSD") return decodePSD(bytes);
  if (format === "DEGAS") {
    const d = decodeDEGAS(bytes);
    return { width: d.width, height: d.height, data: d.data, palette: d.palette.length ? d.palette : undefined };
  }
  if (format === "NEO") {
    const d = decodeNeo(bytes);
    return { width: d.width, height: d.height, data: d.data, palette: d.palette.length ? d.palette : undefined };
  }
  if (format === "ASEPRITE") {
    const a = await decodeAseprite(bytes);
    return { width: a.width, height: a.height, data: a.data };
  }
  if (format === "ICON") {
    const i = decodeAmigaIcon(bytes);
    return { width: i.width, height: i.height, data: i.data };
  }
  return null;
}

export interface EditorProviderProps {
  width?: number;
  height?: number;
  /** Restore the autosaved project and legacy startup UI on mount (the real app; off in tests). */
  autoRestore?: boolean;
  children: ReactNode;
}

export function EditorProvider({ width = 64, height = 48, autoRestore = false, children }: EditorProviderProps) {
  const docRef = useRef<ImageDocument>(
    new ImageDocument({ width, height, palette: autoRestore ? LEGACY_STARTUP_PALETTE : undefined }),
  );
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings());
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(false);
  const recordedFramesRef = useRef<Uint8ClampedArray[]>([]);
  const [recordedFrameCount, setRecordedFrameCount] = useState(0);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [version, setVersion] = useState(0);
  const [tool, setTool] = useState<ToolId>("pencil");
  const [color, setColor] = useState<ColorArray>([255, 255, 255]);
  const [bgColor, setBgColor] = useState<ColorArray>([0, 0, 0]);
  const colorRef = useRef<ColorArray>(color);
  const bgColorRef = useRef<ColorArray>(bgColor);
  colorRef.current = color;
  bgColorRef.current = bgColor;
  const [zoom, setRawZoom] = useState(DEFAULT_ZOOM);
  const setZoom = useCallback<Dispatch<SetStateAction<number>>>((next) => {
    setRawZoom((current) =>
      clampZoom(typeof next === "function" ? (next as (value: number) => number)(current) : next),
    );
  }, []);
  const [colorCycleActive, setColorCycleActive] = useState(false);
  const [cycleRanges, setCycleRanges] = useState<ColorRange[]>([]);
  const cycleRangesRef = useRef<ColorRange[]>([]);
  cycleRangesRef.current = cycleRanges;
  const [cycleSpeed, setCycleSpeed] = useState(120);
  const cycleSpeedRef = useRef(120);
  cycleSpeedRef.current = cycleSpeed;
  const [ehbActive, setEhbActive] = useState(false);
  const ehbActiveRef = useRef(false);
  ehbActiveRef.current = ehbActive;
  const preEhbPaletteRef = useRef<ColorArray[] | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [showRulers, setShowRulers] = useState(false);
  const [showBitplanes, setShowBitplanes] = useState(false);
  const [adfEntries, setAdfEntries] = useState<AdfEntry[] | null>(null);
  const adfDiskRef = useRef<AdfDisk | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [paletteLocked, setPaletteLocked] = useState(false);
  const paletteLockedRef = useRef(false);
  paletteLockedRef.current = paletteLocked;
  const [colorMaskActive, setColorMaskActive] = useState(false);
  const [brushDither, setBrushDither] = useState(false);
  const [brushInvert, setBrushInvert] = useState(false);
  const brushDitherRef = useRef(false);
  brushDitherRef.current = brushDither;
  const brushInvertRef = useRef(false);
  brushInvertRef.current = brushInvert;
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    size: 1,
    softness: 0,
    opacity: 100,
    flow: 100,
    jitter: 0,
    rotation: 0,
    roundness: 100,
  });
  const brushSettingsRef = useRef(brushSettings);
  brushSettingsRef.current = brushSettings;
  const [ditherPattern, setDitherPattern] = useState(0);
  const ditherPatternRef = useRef(0);
  ditherPatternRef.current = ditherPattern;
  const [customDither, setCustomDither] = useState<number[]>(() =>
    [1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1].slice(),
  );
  const customDitherRef = useRef(customDither);
  customDitherRef.current = customDither;
  const [ditherEditorOpen, setDitherEditorOpen] = useState(false);
  const [palettes, setPalettes] = useState<ColorArray[][]>([]);
  const [activePaletteIndex, setActivePaletteIndex] = useState(0);
  const [presentationMode, setPresentationMode] = useState(false);
  const [sidePanelVisible, setSidePanelVisible] = useState(autoRestore ? settings.sidepanel : true);
  const [splitScreen, setSplitScreen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [uaeOpen, setUaeOpen] = useState(false);
  const [hasClipboard, setHasClipboard] = useState(false);
  const clipboardRef = useRef<PixelRegion | null>(null);
  const [hasBrush, setHasBrush] = useState(false);
  const brushRef = useRef<PixelRegion | null>(null);
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

  const getViewportSize = useCallback(() => {
    const stage = typeof document !== "undefined" ? document.querySelector(".editor .panel.left .viewport") : null;
    const winW = typeof window !== "undefined" ? window.innerWidth : 0;
    const winH = typeof window !== "undefined" ? window.innerHeight : 0;
    const availW = (stage instanceof HTMLElement ? stage.clientWidth : 0) || winW || docRef.current.width;
    const availH = (stage instanceof HTMLElement ? stage.clientHeight : 0) || winH || docRef.current.height;
    return {
      width: Math.max(1, availW - 24),
      height: Math.max(1, availH - 24),
    };
  }, []);

  const calculateFitZoom = useCallback(() => {
    const doc = docRef.current;
    const viewport = getViewportSize();
    return clampZoom(Math.min(viewport.width / doc.width, viewport.height / doc.height));
  }, [getViewportSize]);

  const fitIfImageOverflows = useCallback(() => {
    const doc = docRef.current;
    const viewport = getViewportSize();
    setZoom((current) => {
      if (doc.width * current <= viewport.width && doc.height * current <= viewport.height) return current;
      return calculateFitZoom();
    });
  }, [calculateFitZoom, getViewportSize, setZoom]);

  const zoomOut = useCallback(() => {
    const doc = docRef.current;
    const viewport = getViewportSize();
    setZoom((current) => {
      const viewW = doc.width * current;
      const viewH = doc.height * current;
      const farBeyondViewport = viewW > viewport.width * 1.5 || viewH > viewport.height * 1.5;
      return farBeyondViewport || current <= 1 ? current / 2 : current - 1;
    });
  }, [getViewportSize, setZoom]);

  const restoreAutosave = useCallback(() => {
    const json = loadAutosave();
    if (!json) return false;
    try {
      docRef.current = deserializeFromString(json);
      historyRef.current.reset(docRef.current.snapshot());
      setVersion((v) => v + 1);
      fitIfImageOverflows();
      return true;
    } catch {
      return false;
    }
  }, [fitIfImageOverflows]);

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
    let aboutTimer: ReturnType<typeof setTimeout> | null = null;
    if (autoRestore) {
      restoreAutosave();
      try {
        const params = new URLSearchParams(window.location.search);
        if (!params.has("file") && window.localStorage.getItem("dp_about") !== "true") {
          aboutTimer = setTimeout(() => {
            setAboutOpen(true);
            window.localStorage.setItem("dp_about", "true");
          }, 200);
        }
      } catch {
        // Local storage can be unavailable in private / test environments.
      }
    }
    return () => {
      if (aboutTimer) clearTimeout(aboutTimer);
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
      docRef.current = new ImageDocument({
        width: w,
        height: h,
        palette: autoRestore ? LEGACY_STARTUP_PALETTE : undefined,
      });
      historyRef.current.reset(docRef.current.snapshot());
      commit();
    },
    [autoRestore, commit],
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
  const toggleBitplanes = useCallback(() => setShowBitplanes((v) => !v), []);

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

  /** Replace the palette from a decoded palette file (.act / JASC-PAL). */
  const loadPalette = useCallback(
    (bytes: Uint8Array, name = "") => {
      if (paletteLockedRef.current) return;
      const colors = decodePaletteFile(bytes, name);
      if (colors.length) {
        docRef.current.palette = colors.map((c) => [c[0], c[1], c[2]] as ColorArray);
        commit();
      }
    },
    [commit],
  );

  /** Encode the current palette as an Adobe Color Table (.act). */
  const savePaletteACT = useCallback(
    () => encodeACT(docRef.current.palette.map((c) => [c[0]!, c[1]!, c[2]!])),
    [],
  );
  /** Encode the current palette as a JASC-PAL text palette. */
  const savePaletteJASC = useCallback(
    () => encodeJASC(docRef.current.palette.map((c) => [c[0]!, c[1]!, c[2]!])),
    [],
  );

  /** Encode the palette as a small swatch PNG (export). */
  const exportPaletteImage = useCallback(() => {
    const doc = docRef.current;
    const sw = 16;
    const cols = Math.min(16, doc.palette.length);
    const rows = Math.ceil(doc.palette.length / cols);
    const w = cols * sw;
    const h = rows * sw;
    const data = new Uint8ClampedArray(w * h * 4);
    doc.palette.forEach((c, i) => {
      const cx = (i % cols) * sw;
      const cy = Math.floor(i / cols) * sw;
      for (let y = 0; y < sw; y++) {
        for (let x = 0; x < sw; x++) {
          const o = ((cy + y) * w + (cx + x)) * 4;
          data[o] = c[0]!;
          data[o + 1] = c[1]!;
          data[o + 2] = c[2]!;
          data[o + 3] = 255;
        }
      }
    });
    return encodePNG({ width: w, height: h, data });
  }, []);

  /** Reduce the palette to at most `count` colours (derived from the image). */
  const reducePaletteTo = useCallback(
    (count: number) => {
      if (paletteLockedRef.current) return;
      const doc = docRef.current;
      doc.palette = medianCut(doc.composite(), Math.max(2, count));
      commit();
    },
    [commit],
  );

  /** Replace the palette with a named built-in preset. */
  const applyPalettePreset = useCallback(
    (name: PalettePresetId) => {
      if (paletteLockedRef.current) return;
      docRef.current.palette = PALETTE_PRESETS[name].map((c) => c.slice() as ColorArray);
      commit();
    },
    [commit],
  );

  /** Lock the palette: palette-changing operations become no-ops while set. */
  const toggleLockPalette = useCallback(() => setPaletteLocked((v) => !v), []);

  /** Colour mask (stencil): protect pixels of the background colour from drawing. */
  const toggleColorMask = useCallback(() => {
    setColorMaskActive((active) => {
      docRef.current.stencilColor = active ? null : [bgColor[0]!, bgColor[1]!, bgColor[2]!];
      return !active;
    });
  }, [bgColor]);

  const toggleBrushDither = useCallback(() => setBrushDither((v) => !v), []);

  const setBrushSetting = useCallback(<K extends keyof BrushSettings>(key: K, value: number) => {
    setBrushSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const openDitherEditor = useCallback(() => setDitherEditorOpen(true), []);
  const closeDitherEditor = useCallback(() => setDitherEditorOpen(false), []);
  const toggleDitherCell = useCallback((i: number) => {
    setCustomDither((prev) => {
      const next = prev.slice();
      next[i] = next[i] ? 0 : 1;
      return next;
    });
  }, []);

  /** Resolve the colour the brush paints at (x,y), honouring the dither pattern. */
  const ditherColorAt = useCallback(
    (x: number, y: number): ColorArray => {
      let fg: ColorArray = [color[0]!, color[1]!, color[2]!];
      const bg: ColorArray = [bgColor[0]!, bgColor[1]!, bgColor[2]!];
      if (brushInvertRef.current) fg = [255 - fg[0]!, 255 - fg[1]!, 255 - fg[2]!];
      // dither: an explicit pattern, or the legacy 50% "dither" toggle (pattern 1)
      const idx = ditherPatternRef.current || (brushDitherRef.current ? 1 : 0);
      if (idx === 0) return fg;
      const pat = idx === 4 ? customDitherRef.current : DITHER_PATTERNS[idx];
      if (!pat) return fg;
      const bit = pat[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)];
      return bit ? fg : bg;
    },
    [color, bgColor],
  );

  /** Erase along a segment with a brush of the current brush size. */
  const eraseStroke = useCallback((x0: number, y0: number, x1: number, y1: number) => {
    const size = Math.max(1, brushSettingsRef.current.size);
    // a 1px eraser clears exact pixels (a 0.5-radius circle would miss them)
    if (size <= 1) docRef.current.drawLine(x0, y0, x1, y1, [0, 0, 0, 0]);
    else docRef.current.clearStroke(x0, y0, x1, y1, size);
  }, []);

  /** Paint a parametric brush stroke from (x0,y0) to (x1,y1) on the active layer. */
  const brushStroke = useCallback(
    (x0: number, y0: number, x1: number, y1: number, colorOverride?: ColorArray) => {
      const doc = docRef.current;
      const s = brushSettingsRef.current;
      const strokeColor = colorOverride ?? ditherColorAt(Math.round(x1), Math.round(y1));
      // for a 1px hard brush fall back to the crisp Bresenham line
      if (s.size <= 1 && s.softness === 0 && s.opacity >= 100) {
        doc.drawLine(x0, y0, x1, y1, strokeColor);
        return;
      }
      doc.paintBrushStroke(x0, y0, x1, y1, strokeColor, {
        size: s.size,
        softness: s.softness,
        opacity: s.opacity,
        flow: s.flow,
        jitter: s.jitter,
        rotation: s.rotation,
        roundness: (s.roundness ?? 100) / 100,
      });
    },
    [ditherColorAt],
  );
  const toggleBrushInvert = useCallback(() => setBrushInvert((v) => !v), []);

  /** Copy the current selection into a new floating layer. */
  const copyToLayer = useCallback(() => {
    docRef.current.copyToLayer();
    checkpoint();
  }, [checkpoint]);

  /** Advance the colour-cycle palette by one step (manual). */
  const cycleStep = useCallback(() => {
    const doc = docRef.current;
    const ranges: ColorRange[] =
      cycleRangesRef.current.length > 0
        ? cycleRangesRef.current
        : [{ low: 0, high: doc.palette.length - 1 }];
    doc.palette = cyclePalette(doc.palette, ranges, 1);
    commit();
  }, [commit]);

  /** Merge additional colours from the image into the current palette. */
  const expandPaletteFromImage = useCallback(() => {
    if (paletteLockedRef.current) return;
    const doc = docRef.current;
    const seen = new Set(doc.palette.map((c) => (c[0]! << 16) | (c[1]! << 8) | c[2]!));
    const extra = buildPaletteFromImage(doc.composite(), 32);
    for (const c of extra) {
      const key = (c[0]! << 16) | (c[1]! << 8) | c[2]!;
      if (!seen.has(key)) {
        seen.add(key);
        doc.palette.push([c[0]!, c[1]!, c[2]!]);
      }
    }
    commit();
  }, [commit]);

  /** Restore full 24-bit colour (no hardware reduction). */
  const setColorDepth24 = useCallback(() => {
    setEhbActive(false);
    commit();
  }, [commit]);

  // Multi-palette management (active palette lives on the document).
  const addPalette = useCallback(() => {
    setPalettes((list) => {
      const next = [...list, docRef.current.palette.map((c) => c.slice() as ColorArray)];
      setActivePaletteIndex(next.length - 1);
      return next;
    });
  }, []);

  const removePalette = useCallback(() => {
    setPalettes((list) => {
      if (list.length === 0) return list;
      const next = list.slice(0, -1);
      setActivePaletteIndex((i) => Math.min(i, Math.max(0, next.length - 1)));
      return next;
    });
  }, []);

  const switchPalette = useCallback(
    (dir: 1 | -1) => {
      setPalettes((list) => {
        if (list.length === 0) return list;
        setActivePaletteIndex((i) => {
          const ni = (i + dir + list.length) % list.length;
          docRef.current.palette = list[ni]!.map((c) => c.slice() as ColorArray);
          commit();
          return ni;
        });
        return list;
      });
    },
    [commit],
  );
  const nextPalette = useCallback(() => switchPalette(1), [switchPalette]);
  const prevPalette = useCallback(() => switchPalette(-1), [switchPalette]);

  /** Toggle Amiga Extra-Half-Brite: expand to 64 colours (or collapse back). */
  const toggleEHB = useCallback(() => {
    if (paletteLockedRef.current) return;
    const doc = docRef.current;
    setEhbActive((active) => {
      if (active) {
        // restore the exact palette captured before expansion
        doc.palette = preEhbPaletteRef.current ?? doc.palette.slice(0, 32);
        preEhbPaletteRef.current = null;
      } else {
        preEhbPaletteRef.current = doc.palette.map((c) => c.slice() as ColorArray);
        doc.palette = extraHalfBrite(doc.palette);
      }
      commit();
      return !active;
    });
  }, [commit]);

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

  const crop = useCallback(() => {
    const doc = docRef.current;
    const sel = doc.selection;
    if (!sel) return;
    const r = doc.clampRect(sel);
    if (r.width <= 0 || r.height <= 0) return;
    docRef.current = doc.cropped(r.x, r.y, r.width, r.height);
    historyRef.current.reset(docRef.current.snapshot());
    commit();
  }, [commit]);

  const trim = useCallback(() => {
    const doc = docRef.current;
    const b = doc.trimBounds();
    if (!b) return;
    if (b.x === 0 && b.y === 0 && b.width === doc.width && b.height === doc.height) return;
    docRef.current = doc.cropped(b.x, b.y, b.width, b.height);
    historyRef.current.reset(docRef.current.snapshot());
    commit();
  }, [commit]);

  const imageInfo = useCallback(() => {
    const doc = docRef.current;
    return `${doc.width} × ${doc.height} px · ${doc.frameCount} frame${
      doc.frameCount === 1 ? "" : "s"
    } · ${doc.layers.length} layer${doc.layers.length === 1 ? "" : "s"} · ${doc.colorCount()} colours · palette ${doc.palette.length}`;
  }, []);

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

  const clearFrame = useCallback(() => {
    docRef.current.clearFrame();
    checkpoint();
  }, [checkpoint]);

  const moveFrameToEnd = useCallback(() => {
    docRef.current.moveFrameToEnd();
    commit();
  }, [commit]);

  const framesToLayers = useCallback(() => {
    docRef.current.framesToLayers();
    historyRef.current.reset(docRef.current.snapshot());
    commit();
  }, [commit]);

  const layersToFrames = useCallback(() => {
    docRef.current.layersToFrames();
    historyRef.current.reset(docRef.current.snapshot());
    commit();
  }, [commit]);

  const layersToSheet = useCallback(() => {
    docRef.current = docRef.current.toSpriteSheet();
    historyRef.current.reset(docRef.current.snapshot());
    commit();
  }, [commit]);

  const selectAll = useCallback(() => {
    const doc = docRef.current;
    doc.selectionMask = null;
    doc.selection = { x: 0, y: 0, width: doc.width, height: doc.height };
    commit();
  }, [commit]);

  const deselect = useCallback(() => {
    docRef.current.clearSelection();
    commit();
  }, [commit]);

  const invertSelection = useCallback(() => {
    docRef.current.invertSelection();
    commit();
  }, [commit]);

  const selectByColor = useCallback(
    (tolerance = 0) => {
      const doc = docRef.current;
      doc.selectByColor(color, tolerance);
      commit();
    },
    [commit, color],
  );

  const selectAlpha = useCallback(() => {
    docRef.current.selectAlpha();
    commit();
  }, [commit]);

  const selectNotInPalette = useCallback(() => {
    docRef.current.selectNotInPalette();
    commit();
  }, [commit]);

  const layerToSelection = useCallback(() => {
    docRef.current.layerToSelection();
    commit();
  }, [commit]);

  const magicWandSelect = useCallback(
    (x: number, y: number, tolerance = 0) => {
      docRef.current.magicWandSelect(x, y, tolerance);
      commit();
    },
    [commit],
  );

  const selectPolygon = useCallback(
    (points: Array<[number, number]>) => {
      docRef.current.selectPolygon(points);
      commit();
    },
    [commit],
  );

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

  /** Capture the current selection (or whole image) as the custom brush. */
  const captureBrush = useCallback(() => {
    const doc = docRef.current;
    const sel = doc.selection ?? { x: 0, y: 0, width: doc.width, height: doc.height };
    brushRef.current = doc.copyRegion(sel);
    setHasBrush(true);
  }, []);

  const clearBrush = useCallback(() => {
    brushRef.current = null;
    setHasBrush(false);
  }, []);

  const rotateBrush = useCallback((left: boolean) => {
    if (!brushRef.current) return;
    brushRef.current = rotateRegion(brushRef.current, left);
  }, []);

  const flipBrush = useCallback((horizontal: boolean) => {
    if (!brushRef.current) return;
    brushRef.current = flipRegion(brushRef.current, horizontal);
  }, []);

  /** Stamp the brush centred at (x, y) on the active layer. */
  const stampBrush = useCallback(
    (x: number, y: number) => {
      const region = brushRef.current;
      if (!region) return;
      docRef.current.stampRegion(region, x - (region.width >> 1), y - (region.height >> 1));
    },
    [],
  );

  /** Replace the brush from a decoded image (used by "load brush"). */
  const setBrushRegion = useCallback((region: PixelRegion) => {
    brushRef.current = region;
    setHasBrush(true);
  }, []);

  /** The current brush region (for saving), or null. */
  const getBrush = useCallback(() => brushRef.current, []);

  /** Free transform: scale + rotate the selection content in place. */
  const transformSelection = useCallback(
    (scaleFactor: number, angleDeg: number) => {
      const doc = docRef.current;
      const sel = doc.selection
        ? doc.clampRect(doc.selection)
        : { x: 0, y: 0, width: doc.width, height: doc.height };
      if (sel.width <= 0 || sel.height <= 0) return;
      const region = doc.copyRegion(sel);
      let data: Uint8ClampedArray = region.data;
      let w = region.width;
      let h = region.height;
      const sw = Math.max(1, Math.round(w * scaleFactor));
      const sh = Math.max(1, Math.round(h * scaleFactor));
      if (sw !== w || sh !== h) {
        data = resample(data, w, h, sw, sh);
        w = sw;
        h = sh;
      }
      if (angleDeg % 360 !== 0) {
        const r = rotateArbitrary(data, w, h, angleDeg);
        data = r.data;
        w = r.width;
        h = r.height;
      }
      doc.clearRegion(sel);
      const cx = sel.x + (sel.width >> 1);
      const cy = sel.y + (sel.height >> 1);
      doc.stampRegion({ width: w, height: h, data }, cx - (w >> 1), cy - (h >> 1));
      checkpoint();
    },
    [checkpoint],
  );

  const serialize = useCallback(() => serializeToString(docRef.current), []);

  const loadProject = useCallback(
    (json: string) => {
      docRef.current = deserializeFromString(json);
      historyRef.current.reset(docRef.current.snapshot());
      commit();
      fitIfImageOverflows();
    },
    [commit, fitIfImageOverflows],
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

  /** Wrap the flattened image (as ILBM) into a bootable OFS ADF disk image. */
  const saveToADF = useCallback(
    () => encodeADF([{ name: "PICTURE.iff", bytes: exportILBM() }], "DPAINT"),
    [exportILBM],
  );

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
    if (paletteLockedRef.current) return;
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

  const applyEffect = useCallback(
    (kind: EffectKind, value: number) => {
      const doc = docRef.current;
      const layer = doc.activeLayer;
      const { width: w, height: h } = doc;
      const d = layer.data;
      let result: Uint8ClampedArray;
      switch (kind) {
        case "brightness":
          result = adjustBrightness(d, value);
          break;
        case "contrast":
          result = adjustContrast(d, value);
          break;
        case "saturation":
          result = adjustSaturation(d, value);
          break;
        case "hue":
          result = hueRotate(d, value);
          break;
        case "sepia":
          result = sepiaEffect(d, value);
          break;
        case "invert":
          result = invertEffect(d, value);
          break;
        case "blur":
          result = boxBlur(d, w, h, Math.max(1, Math.round(value)));
          break;
        case "sharpen":
          result = sharpen(d, w, h);
          break;
        case "texture":
          result = unsharpMask(d, w, h, value, 2);
          break;
        case "dehaze":
          result = unsharpMask(d, w, h, value, 50);
          break;
        case "balanceR":
          result = colorBalance(d, value, 0, 0);
          break;
        case "balanceG":
          result = colorBalance(d, 0, value, 0);
          break;
        case "balanceB":
          result = colorBalance(d, 0, 0, value);
          break;
        case "feather":
          result = feather(d, w, h, value);
          break;
        case "outline":
          result = outline(d, w, h, [color[0]!, color[1]!, color[2]!]);
          break;
        default:
          return;
      }
      layer.data.set(result);
      checkpoint();
    },
    [checkpoint, color],
  );

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
    // use the configured cycle ranges, or default to the whole palette
    const ranges: ColorRange[] =
      cycleRangesRef.current.length > 0
        ? cycleRangesRef.current
        : [{ low: 0, high: doc.palette.length - 1 }];
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
    }, Math.max(20, cycleSpeedRef.current));
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
      // IFF ANIM becomes a multi-frame document, one animation frame per frame.
      if (detectFormat(bytes, name) === "ANIM") {
        const anim = decodeANIM(bytes);
        const doc = ImageDocument.fromRGBA(
          anim.width,
          anim.height,
          anim.frames[0]!,
          anim.palette.length ? anim.palette : undefined,
        );
        for (let i = 1; i < anim.frames.length; i++) {
          doc.frames.push([
            { name: "Layer 1", visible: true, opacity: 1, data: new Uint8ClampedArray(anim.frames[i]!) },
          ]);
        }
        docRef.current = doc;
        historyRef.current.reset(doc.snapshot());
        commit();
        fitIfImageOverflows();
        return true;
      }
      const decoded = await decodeAnyImage(bytes, name);
      if (!decoded) return false;
      docRef.current = ImageDocument.fromRGBA(
        decoded.width,
        decoded.height,
        decoded.data,
        decoded.palette,
      );
      historyRef.current.reset(docRef.current.snapshot());
      commit();
      fitIfImageOverflows();
      return true;
    },
    [commit, fitIfImageOverflows],
  );

  /** Import an image file as a NEW layer in the current document. */
  const importLayer = useCallback(
    async (bytes: Uint8Array, name = "") => {
      const decoded = await decodeAnyImage(bytes, name);
      if (!decoded) return false;
      const doc = docRef.current;
      const layer = doc.addLayer(name || "Imported");
      // place the imported pixels at the top-left, clipped to the canvas
      const src = decoded.data;
      for (let y = 0; y < Math.min(decoded.height, doc.height); y++) {
        for (let x = 0; x < Math.min(decoded.width, doc.width); x++) {
          const so = (y * decoded.width + x) * 4;
          const to = (y * doc.width + x) * 4;
          layer.data[to] = src[so]!;
          layer.data[to + 1] = src[so + 1]!;
          layer.data[to + 2] = src[so + 2]!;
          layer.data[to + 3] = src[so + 3]!;
        }
      }
      checkpoint();
      return true;
    },
    [checkpoint],
  );

  const loadADF = useCallback(
    async (bytes: Uint8Array) => {
      const disk = new AdfDisk(bytes);
      const images = disk.list().filter((e) => e.type === "FILE" && ADF_IMAGE_EXT.test(e.name));
      if (images.length === 0) return false;
      if (images.length === 1) {
        return loadImageBytes(disk.readFile(images[0]!.sector), images[0]!.name);
      }
      // multiple images — present a picker
      adfDiskRef.current = disk;
      setAdfEntries(images);
      return true;
    },
    [loadImageBytes],
  );

  const openAdfEntry = useCallback(
    async (sector: number, name: string) => {
      const disk = adfDiskRef.current;
      if (!disk) return false;
      const ok = await loadImageBytes(disk.readFile(sector), name);
      setAdfEntries(null);
      adfDiskRef.current = null;
      return ok;
    },
    [loadImageBytes],
  );

  const closeAdf = useCallback(() => {
    setAdfEntries(null);
    adfDiskRef.current = null;
  }, []);

  const openImageUrl = useCallback(
    async (url: string) => {
      const name = url.substring(url.lastIndexOf("/") + 1);
      const attempt = async (u: string) => {
        const res = await fetch(u);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();
        return loadImageBytes(new Uint8Array(buffer), name);
      };
      try {
        return await attempt(url);
      } catch {
        // Likely a CORS error — retry through the same public proxy the legacy
        // app used so remote gallery artwork still loads.
        try {
          return await attempt(
            "https://www.stef.be/bassoontracker/api/proxy/?" + encodeURIComponent(url),
          );
        } catch {
          return false;
        }
      }
    },
    [loadImageBytes],
  );

  const zoomFit = useCallback(() => {
    setZoom(calculateFitZoom());
  }, [calculateFitZoom, setZoom]);

  const toggleGallery = useCallback(() => setGalleryOpen((g) => !g), []);
  const togglePresentation = useCallback(() => setPresentationMode((p) => !p), []);
  const toggleSidePanel = useCallback(() => {
    setSidePanelVisible((visible) => {
      const next = !visible;
      setSettings((prev) => {
        const updated = { ...prev, sidepanel: next };
        saveSettings(updated);
        return updated;
      });
      return next;
    });
  }, []);
  const toggleSplitScreen = useCallback(() => setSplitScreen((s) => !s), []);
  const showAbout = useCallback(() => setAboutOpen(true), []);
  const closeAbout = useCallback(() => setAboutOpen(false), []);
  const showPreferences = useCallback(() => setPreferencesOpen(true), []);
  const closePreferences = useCallback(() => setPreferencesOpen(false), []);
  const showContextMenu = useCallback((x: number, y: number) => setContextMenu({ x, y }), []);
  const hideContextMenu = useCallback(() => setContextMenu(null), []);
  const toggleUae = useCallback(() => setUaeOpen((v) => !v), []);
  const updateSetting = useCallback(<K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      return next;
    });
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const swapColors = useCallback(() => {
    const nextColor = bgColorRef.current;
    const nextBgColor = colorRef.current;
    setColor(nextColor);
    setBgColor(nextBgColor);
  }, []);

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
      zoomFit,
      commit,
      newImage,
      resize,
      scale,
      resampleScale,
      crop,
      trim,
      imageInfo,
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
      importLayer,
      saveToADF,
      loadADF,
      adfEntries,
      openAdfEntry,
      closeAdf,
      openImageUrl,
      galleryOpen,
      toggleGallery,
      presentationMode,
      togglePresentation,
      sidePanelVisible,
      toggleSidePanel,
      splitScreen,
      toggleSplitScreen,
      toggleFullscreen,
      aboutOpen,
      showAbout,
      closeAbout,
      preferencesOpen,
      showPreferences,
      closePreferences,
      settings,
      updateSetting,
      contextMenu,
      showContextMenu,
      hideContextMenu,
      uaeOpen,
      toggleUae,
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
      applyEffect,
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
      clearFrame,
      moveFrameToEnd,
      framesToLayers,
      layersToFrames,
      layersToSheet,
      hasClipboard,
      selectAll,
      deselect,
      invertSelection,
      selectByColor,
      selectAlpha,
      selectNotInPalette,
      layerToSelection,
      magicWandSelect,
      selectPolygon,
      copySelection,
      cutSelection,
      paste,
      transformSelection,
      hasBrush,
      captureBrush,
      clearBrush,
      rotateBrush,
      flipBrush,
      stampBrush,
      setBrushRegion,
      getBrush,
      flipHorizontal,
      flipVertical,
      invert,
      grayscale,
      showGrid,
      toggleGrid,
      showRulers,
      toggleRulers,
      showBitplanes,
      toggleBitplanes,
      setPaletteColor,
      addPaletteColor,
      removePaletteColor,
      loadPalette,
      savePaletteACT,
      savePaletteJASC,
      exportPaletteImage,
      reducePaletteTo,
      applyPalettePreset,
      ehbActive,
      toggleEHB,
      paletteLocked,
      toggleLockPalette,
      colorMaskActive,
      toggleColorMask,
      expandPaletteFromImage,
      cycleStep,
      setColorDepth24,
      paletteCount: palettes.length,
      activePaletteIndex,
      addPalette,
      removePalette,
      nextPalette,
      prevPalette,
      brushDither,
      toggleBrushDither,
      brushInvert,
      toggleBrushInvert,
      brushSettings,
      setBrushSetting,
      ditherPattern,
      setDitherPattern,
      customDither,
      toggleDitherCell,
      ditherEditorOpen,
      openDitherEditor,
      closeDitherEditor,
      brushStroke,
      eraseStroke,
      copyToLayer,
      cycleRanges,
      setCycleRanges,
      cycleSpeed,
      setCycleSpeed,
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
      zoomFit,
      commit,
      newImage,
      resize,
      scale,
      resampleScale,
      crop,
      trim,
      imageInfo,
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
      importLayer,
      saveToADF,
      loadADF,
      adfEntries,
      openAdfEntry,
      closeAdf,
      openImageUrl,
      galleryOpen,
      toggleGallery,
      presentationMode,
      togglePresentation,
      sidePanelVisible,
      toggleSidePanel,
      splitScreen,
      toggleSplitScreen,
      toggleFullscreen,
      aboutOpen,
      showAbout,
      closeAbout,
      preferencesOpen,
      showPreferences,
      closePreferences,
      settings,
      updateSetting,
      contextMenu,
      showContextMenu,
      hideContextMenu,
      uaeOpen,
      toggleUae,
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
      applyEffect,
      colorCycleActive,
      toggleColorCycle,
      addFrame,
      duplicateFrame,
      deleteFrame,
      goToFrame,
      nextFrame,
      prevFrame,
      clearFrame,
      moveFrameToEnd,
      framesToLayers,
      layersToFrames,
      layersToSheet,
      hasClipboard,
      selectAll,
      deselect,
      invertSelection,
      selectByColor,
      selectAlpha,
      selectNotInPalette,
      layerToSelection,
      magicWandSelect,
      selectPolygon,
      copySelection,
      cutSelection,
      paste,
      transformSelection,
      hasBrush,
      captureBrush,
      clearBrush,
      rotateBrush,
      flipBrush,
      stampBrush,
      setBrushRegion,
      getBrush,
      flipHorizontal,
      flipVertical,
      invert,
      grayscale,
      showGrid,
      toggleGrid,
      showRulers,
      toggleRulers,
      showBitplanes,
      toggleBitplanes,
      setPaletteColor,
      addPaletteColor,
      removePaletteColor,
      loadPalette,
      savePaletteACT,
      savePaletteJASC,
      exportPaletteImage,
      reducePaletteTo,
      applyPalettePreset,
      ehbActive,
      toggleEHB,
      paletteLocked,
      toggleLockPalette,
      colorMaskActive,
      toggleColorMask,
      expandPaletteFromImage,
      cycleStep,
      setColorDepth24,
      palettes,
      activePaletteIndex,
      addPalette,
      removePalette,
      nextPalette,
      prevPalette,
      brushDither,
      toggleBrushDither,
      brushInvert,
      toggleBrushInvert,
      brushSettings,
      setBrushSetting,
      ditherPattern,
      setDitherPattern,
      customDither,
      toggleDitherCell,
      ditherEditorOpen,
      openDitherEditor,
      closeDitherEditor,
      brushStroke,
      eraseStroke,
      copyToLayer,
      cycleRanges,
      setCycleRanges,
      cycleSpeed,
      setCycleSpeed,
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
    bus.on(COMMAND.ZOOMIN, () => setZoom(zoomInStep));
    bus.on(COMMAND.ZOOMOUT, () => zoomOut());
    bus.on(COMMAND.ZOOMFIT, () => zoomFit());
    // Tool-selection commands (the legacy menu + toolbar dispatch these on the bus).
    bus.on(COMMAND.DRAW, () => setTool("pencil"));
    bus.on(COMMAND.SELECT, () => setTool("select"));
    bus.on(COMMAND.POLYGONSELECT, () => setTool("polygonselect"));
    bus.on(COMMAND.FLOODSELECT, () => setTool("wandselect"));
    bus.on(COMMAND.CIRCLE, () => setTool("ellipse"));
    bus.on(COMMAND.SQUARE, () => setTool("rect"));
    bus.on(COMMAND.LINE, () => setTool("line"));
    bus.on(COMMAND.ARC, () => setTool("arc"));
    bus.on(COMMAND.GRADIENT, () => setTool("gradient"));
    bus.on(COMMAND.FLOOD, () => setTool("fill"));
    bus.on(COMMAND.SPRAY, () => setTool("spray"));
    bus.on(COMMAND.SMUDGE, () => setTool("smudge"));
    bus.on(COMMAND.ERASE, () => setTool("eraser"));
    bus.on(COMMAND.TEXT, () => setTool("text"));
    bus.on(COMMAND.PAN, () => setTool("pan"));
    bus.on(COMMAND.COLORPICKER, () => setTool("picker"));
    bus.on(COMMAND.SELECTLAYER, () => setTool("layerpick"));
    bus.on(COMMAND.SWAPCOLORS, () => swapColors());
    bus.on(COMMAND.TOGGLEGALLERY, () => setGalleryOpen((g) => !g));
    bus.on(COMMAND.PRESENTATION, () => setPresentationMode((p) => !p));
    bus.on(COMMAND.TOGGLESIDEPANEL, () => toggleSidePanel());
    bus.on(COMMAND.SPLITSCREEN, () => setSplitScreen((s) => !s));
    bus.on(COMMAND.FULLSCREEN, () => toggleFullscreen());
    bus.on(COMMAND.ABOUT, () => setAboutOpen(true));
    bus.on(COMMAND.PREFERENCES, () => setPreferencesOpen(true));
    bus.on(COMMAND.DELUXE, () => setUaeOpen((v) => !v));
    bus.on(COMMAND.NEWLAYER, () => {
      docRef.current.addLayer();
      checkpoint();
    });
    bus.on(COMMAND.DELETELAYER, () => {
      docRef.current.removeLayer(docRef.current.activeLayerIndex);
      checkpoint();
    });
    bus.on(COMMAND.DUPLICATELAYER, () => {
      docRef.current.duplicateLayer();
      checkpoint();
    });
    bus.on(COMMAND.MERGEDOWN, () => {
      docRef.current.mergeDown();
      checkpoint();
    });
    bus.on(COMMAND.FLATTEN, () => {
      docRef.current.flatten();
      checkpoint();
    });
    bus.on(COMMAND.LAYERUP, () => {
      docRef.current.moveLayer(docRef.current.activeLayerIndex, "up");
      checkpoint();
    });
    bus.on(COMMAND.LAYERDOWN, () => {
      docRef.current.moveLayer(docRef.current.activeLayerIndex, "down");
      checkpoint();
    });
    bus.on(COMMAND.LAYERMASK, () => {
      docRef.current.addLayerMask(true);
      checkpoint();
    });
    bus.on(COMMAND.LAYERMASKHIDE, () => {
      docRef.current.addLayerMask(false);
      checkpoint();
    });
    bus.on(COMMAND.DELETELAYERMASK, () => {
      docRef.current.deleteLayerMask();
      checkpoint();
    });
    bus.on(COMMAND.APPLYLAYERMASK, () => {
      docRef.current.applyLayerMask();
      checkpoint();
    });
    bus.on(COMMAND.TOGGLEMASK, () => {
      docRef.current.toggleLayerMask();
      commit();
    });
    bus.on(COMMAND.ENABLELAYERMASK, () => {
      docRef.current.setLayerMaskEnabled(true);
      commit();
    });
    bus.on(COMMAND.DISABLELAYERMASK, () => {
      docRef.current.setLayerMaskEnabled(false);
      commit();
    });
    bus.on(COMMAND.UNDO, () => undo());
    bus.on(COMMAND.REDO, () => redo());
    bus.on(COMMAND.FLIPHORIZONTAL, () => flipHorizontal());
    bus.on(COMMAND.FLIPVERTICAL, () => flipVertical());
    bus.on(COMMAND.PALETTEFROMIMAGE, () => paletteFromImage());
    bus.on(COMMAND.TOGGLEGRID, () => toggleGrid());
    bus.on(COMMAND.TOGGLEPIXELGRID, () => toggleGrid());
    bus.on(COMMAND.TOGGLERULERS, () => toggleRulers());
    bus.on(COMMAND.VIEWPLANES, () => toggleBitplanes());
    bus.on(COMMAND.CYCLEPALETTE, () => toggleColorCycle());
    bus.on(COMMAND.SELECTALL, () => selectAll());
    bus.on(COMMAND.CLEARSELECTION, () => deselect());
    bus.on(COMMAND.INVERTSELECTION, () => invertSelection());
    bus.on(COMMAND.COLORSELECT, () => selectByColor());
    bus.on(COMMAND.ALPHASELECT, () => selectAlpha());
    bus.on(COMMAND.COLORSELECT_NOT_PALETTE, () => selectNotInPalette());
    bus.on(COMMAND.TOSELECTION, () => layerToSelection());
    bus.on(COMMAND.STAMP, () => captureBrush());
    bus.on(COMMAND.BRUSHROTATELEFT, () => rotateBrush(true));
    bus.on(COMMAND.BRUSHROTATERIGHT, () => rotateBrush(false));
    bus.on(COMMAND.BRUSHFLIPHORIZONTAL, () => flipBrush(true));
    bus.on(COMMAND.BRUSHFLIPVERTICAL, () => flipBrush(false));
    bus.on(COMMAND.COPY, () => copySelection());
    bus.on(COMMAND.CUTTOLAYER, () => cutSelection());
    bus.on(COMMAND.PASTE, () => paste());
    bus.on(COMMAND.ADDFRAME, () => addFrame());
    bus.on(COMMAND.DELETEFRAME, () => deleteFrame());
    bus.on(COMMAND.DUPLICATEFRAME, () => duplicateFrame());
    bus.on(COMMAND.CLEARFRAME, () => clearFrame());
    bus.on(COMMAND.FRAMEMOVETOEND, () => moveFrameToEnd());
    bus.on(COMMAND.FRAMES2LAYERS, () => framesToLayers());
    bus.on(COMMAND.LAYERS2FRAMES, () => layersToFrames());
    bus.on(COMMAND.LAYERS2SHEET, () => layersToSheet());
    bus.on(COMMAND.CROP, () => crop());
    bus.on(COMMAND.TRIM, () => trim());
    bus.on(COMMAND.TRANSFORMLAYER, () => transformSelection(1, 90));
    bus.on(COMMAND.ROTATE, () => rotate(false));
    bus.on(COMMAND.RESAMPLE, () => resampleScale(0.5));
    bus.on(COMMAND.COLORDEPTH12, () => reduceToDepth(4));
    bus.on(COMMAND.COLORDEPTH9, () => reduceToDepth(3));
    bus.on(COMMAND.PALETTEREDUCE, () => reducePaletteTo(16));
    bus.on(COMMAND.TOGGLEPALETTES, () => setSidePanelVisible(true));
    bus.on(COMMAND.LOCKPALETTE, () => setPaletteLocked((v) => !v));
    bus.on(COMMAND.COLORMASK, () => toggleColorMask());
    bus.on(COMMAND.PALETTEEXPANDFROMIMAGE, () => expandPaletteFromImage());
    bus.on(COMMAND.CYCLEPALETTESTEP, () => cycleStep());
    bus.on(COMMAND.COLORDEPTH24, () => setColorDepth24());
    bus.on(COMMAND.ADDPALETTE, () => addPalette());
    bus.on(COMMAND.REMOVEPALETTE, () => removePalette());
    bus.on(COMMAND.NEXTPALETTE, () => nextPalette());
    bus.on(COMMAND.PREVPALETTE, () => prevPalette());
    bus.on(COMMAND.TOGGLEDITHER, () => toggleBrushDither());
    bus.on(COMMAND.TOGGLEINVERT, () => toggleBrushInvert());
    bus.on(COMMAND.TOLAYER, () => copyToLayer());
    bus.on(COMMAND.PALETTEMODE_EHB, () => {
      if (!ehbActiveRef.current) toggleEHB();
    });
    bus.on(COMMAND.PALETTEMODE_NORMAL, () => {
      if (ehbActiveRef.current) toggleEHB();
    });
  }

  return <EditorContext.Provider value={api}>{children}</EditorContext.Provider>;
}

export function useEditor(): EditorApi {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within an EditorProvider");
  return ctx;
}
