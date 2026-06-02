import type { ColorArray } from "@dpaint/primitives";
import { resample, rotateArbitrary } from "@dpaint/imaging";

/** An RGBA pixel, channels 0-255. */
export type RGBA = [number, number, number, number];

export interface Layer {
  name: string;
  visible: boolean;
  opacity: number; // 0..1
  /** RGBA pixel buffer, width*height*4. */
  data: Uint8ClampedArray;
  /** Optional per-pixel alpha mask (length width*height, 0-255), or null. */
  mask?: Uint8Array | null;
  /** Whether the mask is applied during compositing (default true when present). */
  maskEnabled?: boolean;
}

export interface ImageDocumentOptions {
  width: number;
  height: number;
  palette?: ColorArray[];
}

/** A rectangular selection in document coordinates. */
export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A detached pixel region (clipboard / cut content). */
export interface PixelRegion {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA
}

/** Immutable, deep-copied capture of an {@link ImageDocument}'s editable state. */
export interface DocumentSnapshot {
  width: number;
  height: number;
  activeLayerIndex: number;
  palette: ColorArray[];
  layers: Array<{
    name: string;
    visible: boolean;
    opacity: number;
    data: Uint8ClampedArray;
    mask?: Uint8Array | null;
    maskEnabled?: boolean;
  }>;
}

/**
 * A minimal but genuinely functional raster image model: layers of RGBA pixel
 * buffers plus drawing primitives (pencil, line, rectangle, flood fill). It is
 * deliberately framework-agnostic and DOM-free so it is fully unit-testable;
 * the React layer renders its composite into a `<canvas>`.
 */
export class ImageDocument {
  readonly width: number;
  readonly height: number;
  palette: ColorArray[];
  /** Animation frames; each frame is its own stack of layers. */
  frames: Layer[][];
  activeFrameIndex = 0;
  activeLayerIndex = 0;
  /** Current rectangular selection, or null for "whole image". */
  selection: SelectionRect | null = null;
  /**
   * Optional per-pixel selection mask (length width*height, 0 or 255). When set,
   * region operations (copy/clear) are restricted to the masked pixels; the
   * {@link selection} rectangle is kept as its bounding box.
   */
  selectionMask: Uint8Array | null = null;
  /**
   * Optional drawing stencil: when set, pixels whose current colour matches this
   * RGB are protected from drawing (DPaint "colour mask" / background stencil).
   */
  stencilColor: ColorArray | null = null;

  constructor(options: ImageDocumentOptions) {
    this.width = options.width;
    this.height = options.height;
    this.palette = options.palette ?? ImageDocument.defaultPalette();
    this.frames = [[this.createLayer("Layer 1")]];
  }

  /** Layers of the active frame (the editable stack). */
  get layers(): Layer[] {
    return this.frames[this.activeFrameIndex]!;
  }
  set layers(value: Layer[]) {
    this.frames[this.activeFrameIndex] = value;
  }

  get frameCount(): number {
    return this.frames.length;
  }

  /** Append a frame — blank, or a deep copy of the current frame. */
  addFrame(duplicate = false): void {
    const frame = duplicate
      ? this.layers.map((l) => ({
          name: l.name,
          visible: l.visible,
          opacity: l.opacity,
          data: new Uint8ClampedArray(l.data),
        }))
      : [this.createLayer("Layer 1")];
    this.frames.push(frame);
    this.activeFrameIndex = this.frames.length - 1;
    this.activeLayerIndex = Math.min(this.activeLayerIndex, this.layers.length - 1);
  }

  duplicateFrame(): void {
    this.addFrame(true);
  }

  removeFrame(index: number): void {
    if (this.frames.length <= 1) return;
    this.frames.splice(index, 1);
    this.activeFrameIndex = Math.min(this.activeFrameIndex, this.frames.length - 1);
    this.activeLayerIndex = Math.min(this.activeLayerIndex, this.layers.length - 1);
  }

  /** Clear all pixels of every layer in a frame (keeps the layer stack). */
  clearFrame(index = this.activeFrameIndex): void {
    const frame = this.frames[index];
    if (!frame) return;
    for (const layer of frame) layer.data.fill(0);
  }

  /** Move a frame to the end of the timeline. */
  moveFrameToEnd(index = this.activeFrameIndex): void {
    if (index < 0 || index >= this.frames.length) return;
    const [frame] = this.frames.splice(index, 1);
    this.frames.push(frame!);
    this.activeFrameIndex = this.frames.length - 1;
    this.activeLayerIndex = Math.min(this.activeLayerIndex, this.layers.length - 1);
  }

  /** Collapse every frame into a single frame, one layer per former frame. */
  framesToLayers(): void {
    const layers: Layer[] = this.frames.map((_, i) => ({
      name: `Frame ${i + 1}`,
      visible: true,
      opacity: 1,
      data: this.composite(i),
    }));
    this.frames = [layers];
    this.activeFrameIndex = 0;
    this.activeLayerIndex = 0;
  }

  /** Explode the active frame's layers into one frame each (bottom layer first). */
  layersToFrames(): void {
    this.frames = this.layers.map((layer) => [
      { name: layer.name, visible: true, opacity: 1, data: new Uint8ClampedArray(layer.data) },
    ]);
    this.activeFrameIndex = 0;
    this.activeLayerIndex = 0;
  }

  /** Build a new single-frame document tiling all frames horizontally (sprite sheet). */
  toSpriteSheet(columns = this.frameCount): ImageDocument {
    const cols = Math.max(1, Math.min(columns, this.frameCount));
    const rows = Math.ceil(this.frameCount / cols);
    const sheet = new ImageDocument({
      width: this.width * cols,
      height: this.height * rows,
      palette: this.palette.map((c) => c.slice()),
    });
    const target = sheet.layers[0]!.data;
    for (let f = 0; f < this.frameCount; f++) {
      const frame = this.composite(f);
      const ox = (f % cols) * this.width;
      const oy = Math.floor(f / cols) * this.height;
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const so = (y * this.width + x) * 4;
          const to = ((oy + y) * sheet.width + (ox + x)) * 4;
          target[to] = frame[so]!;
          target[to + 1] = frame[so + 1]!;
          target[to + 2] = frame[so + 2]!;
          target[to + 3] = frame[so + 3]!;
        }
      }
    }
    return sheet;
  }

  goToFrame(index: number): void {
    if (index < 0 || index >= this.frames.length) return;
    this.activeFrameIndex = index;
    this.activeLayerIndex = Math.min(this.activeLayerIndex, this.layers.length - 1);
  }

  /** Build a single-layer document from a raw RGBA pixel buffer. */
  static fromRGBA(
    width: number,
    height: number,
    data: Uint8Array | Uint8ClampedArray,
    palette?: ColorArray[],
  ): ImageDocument {
    const doc = new ImageDocument({ width, height, palette });
    const expected = width * height * 4;
    if (data.length !== expected) {
      throw new Error(`RGBA buffer is ${data.length} bytes, expected ${expected}`);
    }
    doc.layers[0]!.data = new Uint8ClampedArray(data);
    return doc;
  }

  static defaultPalette(): ColorArray[] {
    return [
      [0, 0, 0],
      [255, 255, 255],
      [136, 0, 0],
      [170, 255, 238],
      [204, 68, 204],
      [0, 204, 85],
      [0, 0, 170],
      [238, 238, 119],
      [221, 136, 85],
      [102, 68, 0],
      [255, 119, 119],
      [51, 51, 51],
      [119, 119, 119],
      [170, 255, 102],
      [0, 136, 255],
      [187, 187, 187],
    ];
  }

  createLayer(name: string): Layer {
    return {
      name,
      visible: true,
      opacity: 1,
      data: new Uint8ClampedArray(this.width * this.height * 4),
    };
  }

  get activeLayer(): Layer {
    return this.layers[this.activeLayerIndex]!;
  }

  addLayer(name?: string): Layer {
    const layer = this.createLayer(name ?? `Layer ${this.layers.length + 1}`);
    this.layers.push(layer);
    this.activeLayerIndex = this.layers.length - 1;
    return layer;
  }

  removeLayer(index: number): void {
    if (this.layers.length <= 1) return;
    this.layers.splice(index, 1);
    this.activeLayerIndex = Math.min(this.activeLayerIndex, this.layers.length - 1);
  }

  /** Insert a deep copy of a layer directly above it and make it active. */
  duplicateLayer(index = this.activeLayerIndex): Layer {
    const src = this.layers[index];
    if (!src) return this.activeLayer;
    const copy: Layer = {
      name: `${src.name} copy`,
      visible: src.visible,
      opacity: src.opacity,
      data: new Uint8ClampedArray(src.data),
      mask: src.mask ? new Uint8Array(src.mask) : null,
      maskEnabled: src.maskEnabled,
    };
    this.layers.splice(index + 1, 0, copy);
    this.activeLayerIndex = index + 1;
    return copy;
  }

  /** Move a layer up (towards the front) or down (towards the back). */
  moveLayer(index: number, dir: "up" | "down"): void {
    const target = dir === "up" ? index + 1 : index - 1;
    if (index < 0 || index >= this.layers.length) return;
    if (target < 0 || target >= this.layers.length) return;
    const layers = this.layers;
    [layers[index], layers[target]] = [layers[target]!, layers[index]!];
    if (this.activeLayerIndex === index) this.activeLayerIndex = target;
    else if (this.activeLayerIndex === target) this.activeLayerIndex = index;
  }

  /** Alpha-composite `upper` over `lower`, writing into `lower` (opacity baked in). */
  private blendLayerInto(upper: Layer, lower: Layer): void {
    const src = upper.data;
    const dst = lower.data;
    for (let i = 0; i < dst.length; i += 4) {
      const sa = (src[i + 3]! / 255) * upper.opacity;
      const da = (dst[i + 3]! / 255) * lower.opacity;
      const outA = sa + da * (1 - sa);
      if (outA <= 0) {
        dst[i] = dst[i + 1] = dst[i + 2] = dst[i + 3] = 0;
        continue;
      }
      for (let c = 0; c < 3; c++) {
        dst[i + c] = (src[i + c]! * sa + dst[i + c]! * da * (1 - sa)) / outA;
      }
      dst[i + 3] = outA * 255;
    }
    lower.opacity = 1;
  }

  /** Merge a layer down into the one beneath it. */
  mergeDown(index = this.activeLayerIndex): void {
    if (index <= 0 || index >= this.layers.length) return;
    const upper = this.layers[index]!;
    const lower = this.layers[index - 1]!;
    this.blendLayerInto(upper, lower);
    this.layers.splice(index, 1);
    this.activeLayerIndex = index - 1;
  }

  /** Copy the current selection's pixels into a new layer above the active one. */
  copyToLayer(): Layer {
    const sel = this.selection ?? { x: 0, y: 0, width: this.width, height: this.height };
    const r = this.clampRect(sel);
    const region = this.copyRegion(r);
    const layer = this.addLayer("Floating");
    this.stampRegion(region, r.x, r.y, layer);
    return layer;
  }

  /** Index of the top-most visible layer with an opaque pixel at (x, y), or -1. */
  topLayerAt(x: number, y: number): number {
    if (!this.inBounds(x, y)) return -1;
    const o = this.offset(x, y);
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i]!;
      if (layer.visible && layer.data[o + 3]! > 0) return i;
    }
    return -1;
  }

  /** Collapse all layers of the active frame into a single layer. */
  flatten(): void {
    const flat: Layer = {
      name: "Layer 1",
      visible: true,
      opacity: 1,
      data: this.composite(),
    };
    this.layers = [flat];
    this.activeLayerIndex = 0;
  }

  /** Attach a mask to a layer: `showAll` = fully opaque (255), else hidden (0). */
  addLayerMask(showAll = true, index = this.activeLayerIndex): void {
    const layer = this.layers[index];
    if (!layer) return;
    layer.mask = new Uint8Array(this.width * this.height).fill(showAll ? 255 : 0);
    layer.maskEnabled = true;
  }

  deleteLayerMask(index = this.activeLayerIndex): void {
    const layer = this.layers[index];
    if (layer) {
      layer.mask = null;
      layer.maskEnabled = undefined;
    }
  }

  /** Bake the mask into the layer's alpha, then drop the mask. */
  applyLayerMask(index = this.activeLayerIndex): void {
    const layer = this.layers[index];
    if (!layer || !layer.mask) return;
    const mask = layer.mask;
    for (let i = 0; i < mask.length; i++) {
      layer.data[i * 4 + 3] = (layer.data[i * 4 + 3]! * mask[i]!) / 255;
    }
    layer.mask = null;
    layer.maskEnabled = undefined;
  }

  setLayerMaskEnabled(enabled: boolean, index = this.activeLayerIndex): void {
    const layer = this.layers[index];
    if (layer && layer.mask) layer.maskEnabled = enabled;
  }

  toggleLayerMask(index = this.activeLayerIndex): void {
    const layer = this.layers[index];
    if (layer && layer.mask) layer.maskEnabled = layer.maskEnabled === false;
  }

  /** Write a value (0-255) into a layer mask at a pixel (for mask painting). */
  setMaskPixel(x: number, y: number, value: number, index = this.activeLayerIndex): void {
    const layer = this.layers[index];
    if (!layer || !layer.mask || !this.inBounds(x, y)) return;
    layer.mask[y * this.width + x] = value;
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  private offset(x: number, y: number): number {
    return (y * this.width + x) * 4;
  }

  getPixel(x: number, y: number, layer: Layer = this.activeLayer): RGBA | null {
    if (!this.inBounds(x, y)) return null;
    const o = this.offset(x, y);
    return [layer.data[o]!, layer.data[o + 1]!, layer.data[o + 2]!, layer.data[o + 3]!];
  }

  setPixel(x: number, y: number, color: ColorArray, layer: Layer = this.activeLayer): void {
    if (!this.inBounds(x, y)) return;
    const o = this.offset(x, y);
    // colour-mask stencil: don't overwrite protected pixels
    const s = this.stencilColor;
    if (s && layer.data[o] === s[0] && layer.data[o + 1] === s[1] && layer.data[o + 2] === s[2]) {
      return;
    }
    layer.data[o] = color[0]!;
    layer.data[o + 1] = color[1]!;
    layer.data[o + 2] = color[2]!;
    layer.data[o + 3] = color[3] ?? 255;
  }

  /** Bresenham line. */
  drawLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: ColorArray,
    layer: Layer = this.activeLayer,
  ): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.setPixel(x0, y0, color, layer);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /**
   * Draw a quadratic arc from (x0,y0) to (x1,y1) that passes through the
   * waypoint (mx,my) at its midpoint (the control point is derived so the curve
   * bows through that point).
   */
  drawArc(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    mx: number,
    my: number,
    color: ColorArray,
    layer: Layer = this.activeLayer,
  ): void {
    const cx = 2 * mx - 0.5 * x0 - 0.5 * x1;
    const cy = 2 * my - 0.5 * y0 - 0.5 * y1;
    const steps = Math.max(
      Math.abs(x1 - x0) + Math.abs(y1 - y0) + Math.abs(cx - x0) + Math.abs(cy - y0),
      8,
    );
    let px = x0;
    let py = y0;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const it = 1 - t;
      const x = Math.round(it * it * x0 + 2 * it * t * cx + t * t * x1);
      const y = Math.round(it * it * y0 + 2 * it * t * cy + t * t * y1);
      this.drawLine(px, py, x, y, color, layer);
      px = x;
      py = y;
    }
  }

  drawRect(
    x: number,
    y: number,
    w: number,
    h: number,
    color: ColorArray,
    fill = false,
    layer: Layer = this.activeLayer,
  ): void {
    const x1 = x + w - 1;
    const y1 = y + h - 1;
    if (fill) {
      for (let yy = y; yy <= y1; yy++) {
        for (let xx = x; xx <= x1; xx++) this.setPixel(xx, yy, color, layer);
      }
      return;
    }
    this.drawLine(x, y, x1, y, color, layer);
    this.drawLine(x, y1, x1, y1, color, layer);
    this.drawLine(x, y, x, y1, color, layer);
    this.drawLine(x1, y, x1, y1, color, layer);
  }

  /**
   * Draw an axis-aligned ellipse inscribed in the rectangle spanning the two
   * corners (inclusive). Uses the midpoint ellipse algorithm; `fill` draws solid
   * horizontal spans. A zero-size box degenerates to a single pixel.
   */
  drawEllipse(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: ColorArray,
    fill = false,
    layer: Layer = this.activeLayer,
  ): void {
    const left = Math.min(x0, x1);
    const right = Math.max(x0, x1);
    const top = Math.min(y0, y1);
    const bottom = Math.max(y0, y1);
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    const a = (right - left) / 2;
    const b = (bottom - top) / 2;
    if (a === 0 && b === 0) {
      this.setPixel(Math.round(cx), Math.round(cy), color, layer);
      return;
    }

    const plot = (px: number, py: number) => this.setPixel(Math.round(px), Math.round(py), color, layer);
    const span = (px0: number, px1: number, py: number) =>
      this.drawLine(Math.round(px0), Math.round(py), Math.round(px1), Math.round(py), color, layer);

    const a2 = a * a;
    const b2 = b * b;
    let x = 0;
    let y = b;
    let dx = 0;
    let dy = 2 * a2 * y;
    let err = Math.round(b2 - a2 * b + 0.25 * a2);

    const emit = (ex: number, ey: number) => {
      if (fill) {
        span(cx - ex, cx + ex, cy + ey);
        span(cx - ex, cx + ex, cy - ey);
      } else {
        plot(cx + ex, cy + ey);
        plot(cx - ex, cy + ey);
        plot(cx + ex, cy - ey);
        plot(cx - ex, cy - ey);
      }
    };

    // Region 1
    while (dx < dy) {
      emit(x, y);
      x++;
      dx += 2 * b2;
      if (err < 0) {
        err += b2 + dx;
      } else {
        y--;
        dy -= 2 * a2;
        err += b2 + dx - dy;
      }
    }
    // Region 2
    err = Math.round(b2 * (x + 0.5) * (x + 0.5) + a2 * (y - 1) * (y - 1) - a2 * b2);
    while (y >= 0) {
      emit(x, y);
      y--;
      dy -= 2 * a2;
      if (err > 0) {
        err += a2 - dy;
      } else {
        x++;
        dx += 2 * b2;
        err += a2 - dy + dx;
      }
    }
  }

  /** Deep-copy the full editable state so it can be restored later (undo/redo). */
  snapshot(): DocumentSnapshot {
    return {
      width: this.width,
      height: this.height,
      activeLayerIndex: this.activeLayerIndex,
      palette: this.palette.map((c) => c.slice()),
      layers: this.layers.map((l) => ({
        name: l.name,
        visible: l.visible,
        opacity: l.opacity,
        data: new Uint8ClampedArray(l.data),
        mask: l.mask ? new Uint8Array(l.mask) : null,
        maskEnabled: l.maskEnabled,
      })),
    };
  }

  /** Restore state previously captured with {@link snapshot}. */
  restore(snapshot: DocumentSnapshot): void {
    if (snapshot.width !== this.width || snapshot.height !== this.height) {
      throw new Error("Cannot restore a snapshot with different dimensions");
    }
    this.palette = snapshot.palette.map((c) => c.slice());
    this.layers = snapshot.layers.map((l) => ({
      name: l.name,
      visible: l.visible,
      opacity: l.opacity,
      data: new Uint8ClampedArray(l.data),
      mask: l.mask ? new Uint8Array(l.mask) : null,
      maskEnabled: l.maskEnabled,
    }));
    this.activeLayerIndex = Math.min(snapshot.activeLayerIndex, this.layers.length - 1);
  }

  /**
   * Fill a layer with a linear gradient from `colorA` (at the start point) to
   * `colorB` (at the end point), projecting each pixel onto the drag vector.
   */
  gradientLinear(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    colorA: ColorArray,
    colorB: ColorArray,
    layer: Layer = this.activeLayer,
  ): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    const ar = colorA[0]!;
    const ag = colorA[1]!;
    const ab = colorA[2]!;
    const br = colorB[0]!;
    const bg = colorB[1]!;
    const bb = colorB[2]!;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let t = len2 === 0 ? 0 : ((x - x0) * dx + (y - y0) * dy) / len2;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
        const o = (y * this.width + x) * 4;
        layer.data[o] = Math.round(ar + (br - ar) * t);
        layer.data[o + 1] = Math.round(ag + (bg - ag) * t);
        layer.data[o + 2] = Math.round(ab + (bb - ab) * t);
        layer.data[o + 3] = 255;
      }
    }
  }

  /**
   * Airbrush: scatter `count` pixels of `color` within `radius` of (cx, cy),
   * uniformly over the disc. `rng` is injectable for deterministic tests.
   */
  /** Tunable parametric brush. */
  // size: diameter in px; softness 0..10 (edge falloff); opacity 0..1.
  // roundness 0..1 (1 = circle, <1 = ellipse), rotated by `rotation` degrees.
  paintDab(
    cx: number,
    cy: number,
    color: ColorArray,
    size: number,
    softness: number,
    opacity: number,
    layer: Layer = this.activeLayer,
    rotation = 0,
    roundness = 1,
  ): void {
    const radius = Math.max(0.5, size / 2);
    const inner = radius * (1 - Math.max(0, Math.min(10, softness)) / 10);
    const rnd = Math.max(0.05, Math.min(1, roundness));
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const x0 = Math.floor(cx - radius);
    const x1 = Math.ceil(cx + radius);
    const y0 = Math.floor(cy - radius);
    const y1 = Math.ceil(cy + radius);
    const r = color[0]!;
    const g = color[1]!;
    const b = color[2]!;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!this.inBounds(x, y)) continue;
        // rotate the offset into brush space; squash the minor axis by roundness
        const ox = x + 0.5 - cx;
        const oy = y + 0.5 - cy;
        const bx = ox * cos + oy * sin;
        const by = (-ox * sin + oy * cos) / rnd;
        const d = Math.hypot(bx, by);
        if (d > radius) continue;
        let a = 1;
        if (d > inner && radius > inner) a = 1 - (d - inner) / (radius - inner);
        a *= opacity;
        if (a <= 0) continue;
        const o = this.offset(x, y);
        const s = this.stencilColor;
        if (s && layer.data[o] === s[0] && layer.data[o + 1] === s[1] && layer.data[o + 2] === s[2]) {
          continue;
        }
        const da = (layer.data[o + 3]! / 255) * (1 - a);
        const outA = a + da;
        if (outA <= 0) continue;
        layer.data[o] = (r * a + layer.data[o]! * da) / outA;
        layer.data[o + 1] = (g * a + layer.data[o + 1]! * da) / outA;
        layer.data[o + 2] = (b * a + layer.data[o + 2]! * da) / outA;
        layer.data[o + 3] = outA * 255;
      }
    }
  }

  /** Erase a circular dab of diameter `size` back to full transparency. */
  clearDab(cx: number, cy: number, size: number, layer: Layer = this.activeLayer): void {
    const radius = Math.max(0.5, size / 2);
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        if (!this.inBounds(x, y)) continue;
        if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > radius) continue;
        const o = this.offset(x, y);
        layer.data[o] = layer.data[o + 1] = layer.data[o + 2] = layer.data[o + 3] = 0;
      }
    }
  }

  /** Erase along a segment with a brush of the given `size`. */
  clearStroke(x0: number, y0: number, x1: number, y1: number, size: number, layer: Layer = this.activeLayer): void {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.round(dist / Math.max(0.5, size / 4)));
    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      this.clearDab(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, size, layer);
    }
  }

  /** Stroke the parametric brush from (x0,y0) to (x1,y1), spacing dabs by flow. */
  paintBrushStroke(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: ColorArray,
    opts: {
      size: number;
      softness: number;
      opacity: number;
      flow: number;
      jitter: number;
      rotation?: number;
      roundness?: number;
    },
    layer: Layer = this.activeLayer,
    rng: () => number = Math.random,
  ): void {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const spacing = Math.max(0.5, (opts.size / 2) * (1 - Math.min(0.99, opts.flow / 100)));
    const steps = Math.max(1, Math.round(dist / spacing));
    const dabAlpha = Math.max(0.02, opts.opacity / 100);
    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      const jx = opts.jitter ? (rng() - 0.5) * opts.jitter : 0;
      const jy = opts.jitter ? (rng() - 0.5) * opts.jitter : 0;
      this.paintDab(
        x0 + (x1 - x0) * t + jx,
        y0 + (y1 - y0) * t + jy,
        color,
        opts.size,
        opts.softness,
        dabAlpha,
        layer,
        opts.rotation ?? 0,
        opts.roundness ?? 1,
      );
    }
  }

  spray(
    cx: number,
    cy: number,
    radius: number,
    count: number,
    color: ColorArray,
    layer: Layer = this.activeLayer,
    rng: () => number = Math.random,
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = Math.sqrt(rng()) * radius; // sqrt → uniform disc density
      const x = Math.round(cx + Math.cos(angle) * dist);
      const y = Math.round(cy + Math.sin(angle) * dist);
      this.setPixel(x, y, color, layer);
    }
  }

  /**
   * Smudge: drag the colour picked up at (x0,y0) along the path to (x1,y1),
   * blending each visited pixel toward the carried colour by `strength` (0..1).
   * Deterministic.
   */
  smudge(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    strength: number,
    layer: Layer = this.activeLayer,
  ): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const carried = this.getPixel(x0, y0, layer);
    if (!carried) return;
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(x0 + ((x1 - x0) * s) / steps);
      const y = Math.round(y0 + ((y1 - y0) * s) / steps);
      const current = this.getPixel(x, y, layer);
      if (!current) continue;
      const blended: ColorArray = [
        Math.round(current[0] + (carried[0] - current[0]) * strength),
        Math.round(current[1] + (carried[1] - current[1]) * strength),
        Math.round(current[2] + (carried[2] - current[2]) * strength),
        current[3],
      ];
      this.setPixel(x, y, blended, layer);
      // pick up the new colour for the next step
      carried[0] = blended[0]!;
      carried[1] = blended[1]!;
      carried[2] = blended[2]!;
    }
  }

  /** 4-way scanline flood fill. */
  floodFill(x: number, y: number, color: ColorArray, layer: Layer = this.activeLayer): void {
    if (!this.inBounds(x, y)) return;
    const target = this.getPixel(x, y, layer)!;
    const replacement: RGBA = [color[0]!, color[1]!, color[2]!, color[3] ?? 255];
    if (this.sameColor(target, replacement)) return;

    const stack: Array<[number, number]> = [[x, y]];
    while (stack.length) {
      const [px, py] = stack.pop()!;
      if (!this.inBounds(px, py)) continue;
      const current = this.getPixel(px, py, layer)!;
      if (!this.sameColor(current, target)) continue;
      this.setPixel(px, py, replacement, layer);
      stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
  }

  private sameColor(a: RGBA, b: RGBA): boolean {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
  }

  clear(layer: Layer = this.activeLayer): void {
    layer.data.fill(0);
  }

  /** Intersect a rectangle with the document bounds (may yield zero size). */
  clampRect(rect: SelectionRect): SelectionRect {
    const x0 = Math.max(0, Math.floor(rect.x));
    const y0 = Math.max(0, Math.floor(rect.y));
    const x1 = Math.min(this.width, Math.floor(rect.x + rect.width));
    const y1 = Math.min(this.height, Math.floor(rect.y + rect.height));
    return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
  }

  /** Drop any selection (rectangle + mask). */
  clearSelection(): void {
    this.selection = null;
    this.selectionMask = null;
  }

  /** Bounding box of the set pixels in a mask, or null if empty. */
  private maskBounds(mask: Uint8Array): SelectionRect | null {
    let minX = this.width;
    let minY = this.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (mask[y * this.width + x]! === 0) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return null;
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }

  /** Install a mask as the current selection, deriving the bounding rectangle. */
  setSelectionMask(mask: Uint8Array): void {
    const bounds = this.maskBounds(mask);
    if (!bounds) {
      this.clearSelection();
      return;
    }
    this.selectionMask = mask;
    this.selection = bounds;
  }

  /** The current selection as a full-image mask (rect, mask, or whole image). */
  private currentMask(): Uint8Array {
    const mask = new Uint8Array(this.width * this.height);
    if (this.selectionMask) {
      mask.set(this.selectionMask);
      return mask;
    }
    const r = this.selection ? this.clampRect(this.selection) : null;
    if (!r) {
      mask.fill(255);
      return mask;
    }
    for (let y = 0; y < r.height; y++) {
      for (let x = 0; x < r.width; x++) mask[(r.y + y) * this.width + (r.x + x)] = 255;
    }
    return mask;
  }

  private colorWithinTolerance(a: RGBA, b: RGBA, tolerance: number): boolean {
    return (
      Math.abs(a[0] - b[0]) <= tolerance &&
      Math.abs(a[1] - b[1]) <= tolerance &&
      Math.abs(a[2] - b[2]) <= tolerance &&
      Math.abs(a[3] - b[3]) <= tolerance
    );
  }

  /** Select every pixel of a layer matching a colour within a tolerance. */
  selectByColor(color: ColorArray, tolerance = 0, layer: Layer = this.activeLayer): void {
    const ref: RGBA = [color[0]!, color[1]!, color[2]!, color[3] ?? 255];
    const mask = new Uint8Array(this.width * this.height);
    for (let i = 0; i < mask.length; i++) {
      const o = i * 4;
      const px: RGBA = [layer.data[o]!, layer.data[o + 1]!, layer.data[o + 2]!, layer.data[o + 3]!];
      if (this.colorWithinTolerance(px, ref, tolerance)) mask[i] = 255;
    }
    this.setSelectionMask(mask);
  }

  /** Select all pixels of the composite whose colour is NOT in the palette. */
  selectNotInPalette(): void {
    const inPalette = new Set(this.palette.map((c) => (c[0]! << 16) | (c[1]! << 8) | c[2]!));
    const composite = this.composite();
    const mask = new Uint8Array(this.width * this.height);
    for (let i = 0; i < mask.length; i++) {
      const o = i * 4;
      if (composite[o + 3]! === 0) continue;
      const key = (composite[o]! << 16) | (composite[o + 1]! << 8) | composite[o + 2]!;
      if (!inPalette.has(key)) mask[i] = 255;
    }
    this.setSelectionMask(mask);
  }

  /** Select the transparent (alpha == 0) pixels of the composite. */
  selectAlpha(): void {
    const composite = this.composite();
    const mask = new Uint8Array(this.width * this.height);
    for (let i = 0; i < mask.length; i++) {
      if (composite[i * 4 + 3]! === 0) mask[i] = 255;
    }
    this.setSelectionMask(mask);
  }

  /** Select the non-transparent pixels of a layer (layer → selection). */
  layerToSelection(layer: Layer = this.activeLayer): void {
    const mask = new Uint8Array(this.width * this.height);
    for (let i = 0; i < mask.length; i++) {
      if (layer.data[i * 4 + 3]! > 0) mask[i] = 255;
    }
    this.setSelectionMask(mask);
  }

  /** Contiguous (4-way) magic-wand select from a seed pixel. */
  magicWandSelect(x: number, y: number, tolerance = 0, layer: Layer = this.activeLayer): void {
    if (!this.inBounds(x, y)) return;
    const target = this.getPixel(x, y, layer)!;
    const mask = new Uint8Array(this.width * this.height);
    const stack: Array<[number, number]> = [[x, y]];
    while (stack.length) {
      const [px, py] = stack.pop()!;
      if (!this.inBounds(px, py)) continue;
      const idx = py * this.width + px;
      if (mask[idx]) continue;
      const current = this.getPixel(px, py, layer)!;
      if (!this.colorWithinTolerance(current, target, tolerance)) continue;
      mask[idx] = 255;
      stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
    this.setSelectionMask(mask);
  }

  /** Build a selection mask from a polygon outline (even-odd fill rule). */
  selectPolygon(points: Array<[number, number]>): void {
    if (points.length < 3) return;
    const mask = new Uint8Array(this.width * this.height);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.pointInPolygon(x + 0.5, y + 0.5, points)) mask[y * this.width + x] = 255;
      }
    }
    this.setSelectionMask(mask);
  }

  private pointInPolygon(px: number, py: number, poly: Array<[number, number]>): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i]![0];
      const yi = poly[i]![1];
      const xj = poly[j]![0];
      const yj = poly[j]![1];
      const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /** Invert the current selection (within image bounds). */
  invertSelection(): void {
    const mask = this.currentMask();
    for (let i = 0; i < mask.length; i++) mask[i] = mask[i] ? 0 : 255;
    this.setSelectionMask(mask);
  }

  /** Copy a rectangular region of a layer into a detached RGBA region. */
  copyRegion(rect: SelectionRect, layer: Layer = this.activeLayer): PixelRegion {
    const r = this.clampRect(rect);
    const mask = this.selectionMask;
    const data = new Uint8ClampedArray(r.width * r.height * 4);
    for (let y = 0; y < r.height; y++) {
      for (let x = 0; x < r.width; x++) {
        const sx = r.x + x;
        const sy = r.y + y;
        const dofs = (y * r.width + x) * 4;
        // honour a non-rectangular selection: pixels outside the mask stay clear
        if (mask && mask[sy * this.width + sx] === 0) continue;
        const so = (sy * this.width + sx) * 4;
        data[dofs] = layer.data[so]!;
        data[dofs + 1] = layer.data[so + 1]!;
        data[dofs + 2] = layer.data[so + 2]!;
        data[dofs + 3] = layer.data[so + 3]!;
      }
    }
    return { width: r.width, height: r.height, data };
  }

  /** Clear (make transparent) a rectangular region of a layer. */
  clearRegion(rect: SelectionRect, layer: Layer = this.activeLayer): void {
    const r = this.clampRect(rect);
    const mask = this.selectionMask;
    for (let y = 0; y < r.height; y++) {
      for (let x = 0; x < r.width; x++) {
        const sx = r.x + x;
        const sy = r.y + y;
        if (mask && mask[sy * this.width + sx] === 0) continue;
        const o = (sy * this.width + sx) * 4;
        layer.data[o] = 0;
        layer.data[o + 1] = 0;
        layer.data[o + 2] = 0;
        layer.data[o + 3] = 0;
      }
    }
  }

  /** Alpha-over a detached region onto a layer at (dx, dy). */
  stampRegion(region: PixelRegion, dx: number, dy: number, layer: Layer = this.activeLayer): void {
    dx = Math.round(dx);
    dy = Math.round(dy);
    for (let y = 0; y < region.height; y++) {
      const ty = dy + y;
      if (ty < 0 || ty >= this.height) continue;
      for (let x = 0; x < region.width; x++) {
        const tx = dx + x;
        if (tx < 0 || tx >= this.width) continue;
        const so = (y * region.width + x) * 4;
        const sa = region.data[so + 3]! / 255;
        if (sa <= 0) continue;
        const to = (ty * this.width + tx) * 4;
        const da = layer.data[to + 3]! / 255;
        const outA = sa + da * (1 - sa);
        if (outA <= 0) continue;
        for (let c = 0; c < 3; c++) {
          layer.data[to + c] =
            (region.data[so + c]! * sa + layer.data[to + c]! * da * (1 - sa)) / outA;
        }
        layer.data[to + 3] = outA * 255;
      }
    }
  }

  /**
   * Return a new document scaled to `newWidth`×`newHeight` using nearest-neighbour
   * sampling (preserves hard pixel edges — appropriate for pixel art). Layer
   * structure, names, visibility, opacity and the palette are carried over.
   */
  resized(newWidth: number, newHeight: number): ImageDocument {
    return this.transformAllFrames(newWidth, newHeight, (src) => {
      const dst = new Uint8ClampedArray(newWidth * newHeight * 4);
      for (let y = 0; y < newHeight; y++) {
        const sy = Math.min(this.height - 1, Math.floor((y * this.height) / newHeight));
        for (let x = 0; x < newWidth; x++) {
          const sx = Math.min(this.width - 1, Math.floor((x * this.width) / newWidth));
          const so = (sy * this.width + sx) * 4;
          const dstOff = (y * newWidth + x) * 4;
          dst[dstOff] = src[so]!;
          dst[dstOff + 1] = src[so + 1]!;
          dst[dstOff + 2] = src[so + 2]!;
          dst[dstOff + 3] = src[so + 3]!;
        }
      }
      return dst;
    });
  }

  /**
   * Return a new document rotated 90° (all frames). `left` rotates
   * counter-clockwise, otherwise clockwise. Width and height swap.
   */
  resampled(newWidth: number, newHeight: number): ImageDocument {
    return this.transformAllFrames(newWidth, newHeight, (src) =>
      resample(src, this.width, this.height, newWidth, newHeight),
    );
  }

  /** Return a new document rotated by an arbitrary angle (degrees, all frames). */
  rotatedFree(angleDeg: number): ImageDocument {
    const probe = rotateArbitrary(
      new Uint8ClampedArray(this.width * this.height * 4),
      this.width,
      this.height,
      angleDeg,
    );
    return this.transformAllFrames(probe.width, probe.height, (src) =>
      rotateArbitrary(src, this.width, this.height, angleDeg).data,
    );
  }

  /** Return a new document rotated 90° (all frames); `left` = counter-clockwise. */
  rotated90(left: boolean): ImageDocument {
    const W = this.width;
    const H = this.height;
    const newW = H;
    const newH = W;
    return this.transformAllFrames(newW, newH, (src) => {
      const dst = new Uint8ClampedArray(newW * newH * 4);
      for (let dy = 0; dy < newH; dy++) {
        for (let dx = 0; dx < newW; dx++) {
          const sx = left ? W - 1 - dy : dy;
          const sy = left ? dx : H - 1 - dx;
          const so = (sy * W + sx) * 4;
          const dofs = (dy * newW + dx) * 4;
          dst[dofs] = src[so]!;
          dst[dofs + 1] = src[so + 1]!;
          dst[dofs + 2] = src[so + 2]!;
          dst[dofs + 3] = src[so + 3]!;
        }
      }
      return dst;
    });
  }

  /** Return a new document cropped to the given rectangle (all frames). */
  cropped(x: number, y: number, w: number, h: number): ImageDocument {
    return this.transformAllFrames(w, h, (src) => {
      const dst = new Uint8ClampedArray(w * h * 4);
      for (let yy = 0; yy < h; yy++) {
        const sy = y + yy;
        if (sy < 0 || sy >= this.height) continue;
        for (let xx = 0; xx < w; xx++) {
          const sx = x + xx;
          if (sx < 0 || sx >= this.width) continue;
          const so = (sy * this.width + sx) * 4;
          const dstOff = (yy * w + xx) * 4;
          dst[dstOff] = src[so]!;
          dst[dstOff + 1] = src[so + 1]!;
          dst[dstOff + 2] = src[so + 2]!;
          dst[dstOff + 3] = src[so + 3]!;
        }
      }
      return dst;
    });
  }

  /**
   * Bounding box of the non-transparent content in the active frame's composite,
   * or null if the image is entirely transparent.
   */
  trimBounds(): SelectionRect | null {
    const composite = this.composite();
    let minX = this.width;
    let minY = this.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (composite[(y * this.width + x) * 4 + 3]! === 0) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return null;
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }

  /** Build a new document of the given size, remapping every layer of every frame. */
  private transformAllFrames(
    newWidth: number,
    newHeight: number,
    mapData: (src: Uint8ClampedArray) => Uint8ClampedArray,
  ): ImageDocument {
    const out = new ImageDocument({
      width: newWidth,
      height: newHeight,
      palette: this.palette.map((c) => c.slice()),
    });
    out.frames = this.frames.map((frame) =>
      frame.map((layer) => ({
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        data: mapData(layer.data),
      })),
    );
    out.activeFrameIndex = Math.min(this.activeFrameIndex, out.frames.length - 1);
    out.activeLayerIndex = Math.min(this.activeLayerIndex, out.layers.length - 1);
    return out;
  }

  /** Flip every layer horizontally (mirror left↔right), preserving dimensions. */
  flipHorizontal(): void {
    for (const layer of this.layers) {
      const src = layer.data;
      const out = new Uint8ClampedArray(src.length);
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const from = (y * this.width + x) * 4;
          const to = (y * this.width + (this.width - 1 - x)) * 4;
          out[to] = src[from]!;
          out[to + 1] = src[from + 1]!;
          out[to + 2] = src[from + 2]!;
          out[to + 3] = src[from + 3]!;
        }
      }
      layer.data = out;
    }
  }

  /** Flip every layer vertically (mirror top↔bottom), preserving dimensions. */
  flipVertical(): void {
    const rowBytes = this.width * 4;
    for (const layer of this.layers) {
      const src = layer.data;
      const out = new Uint8ClampedArray(src.length);
      for (let y = 0; y < this.height; y++) {
        const srcRow = y * rowBytes;
        const dstRow = (this.height - 1 - y) * rowBytes;
        out.set(src.subarray(srcRow, srcRow + rowBytes), dstRow);
      }
      layer.data = out;
    }
  }

  /** Invert the RGB channels of a layer (alpha preserved). */
  invertColors(layer: Layer = this.activeLayer): void {
    const d = layer.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i]!;
      d[i + 1] = 255 - d[i + 1]!;
      d[i + 2] = 255 - d[i + 2]!;
    }
  }

  /** Convert a layer to greyscale using Rec. 601 luma (alpha preserved). */
  grayscale(layer: Layer = this.activeLayer): void {
    const d = layer.data;
    for (let i = 0; i < d.length; i += 4) {
      const luma = Math.round(0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!);
      d[i] = luma;
      d[i + 1] = luma;
      d[i + 2] = luma;
    }
  }

  /** Flatten all visible layers of a frame (alpha-over) into a single RGBA buffer. */
  composite(frameIndex: number = this.activeFrameIndex): Uint8ClampedArray {
    const out = new Uint8ClampedArray(this.width * this.height * 4);
    const layers = this.frames[frameIndex] ?? this.layers;
    for (const layer of layers) {
      if (!layer.visible || layer.opacity <= 0) continue;
      const src = layer.data;
      const mask = layer.maskEnabled !== false ? layer.mask : null;
      for (let i = 0; i < out.length; i += 4) {
        const maskFactor = mask ? mask[i >> 2]! / 255 : 1;
        const sa = (src[i + 3]! / 255) * layer.opacity * maskFactor;
        if (sa <= 0) continue;
        const da = out[i + 3]! / 255;
        const outA = sa + da * (1 - sa);
        if (outA <= 0) continue;
        for (let c = 0; c < 3; c++) {
          out[i + c] = (src[i + c]! * sa + out[i + c]! * da * (1 - sa)) / outA;
        }
        out[i + 3] = outA * 255;
      }
    }
    return out;
  }

  /** Number of distinct opaque colours used across the composite. */
  colorCount(): number {
    const composite = this.composite();
    const seen = new Set<number>();
    for (let i = 0; i < composite.length; i += 4) {
      if (composite[i + 3]! === 0) continue;
      seen.add((composite[i]! << 16) | (composite[i + 1]! << 8) | composite[i + 2]!);
    }
    return seen.size;
  }
}
