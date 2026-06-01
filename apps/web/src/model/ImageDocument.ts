import type { ColorArray } from "@dpaint/util";

/** An RGBA pixel, channels 0-255. */
export type RGBA = [number, number, number, number];

export interface Layer {
  name: string;
  visible: boolean;
  opacity: number; // 0..1
  /** RGBA pixel buffer, width*height*4. */
  data: Uint8ClampedArray;
}

export interface ImageDocumentOptions {
  width: number;
  height: number;
  palette?: ColorArray[];
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
  layers: Layer[];
  activeLayerIndex = 0;

  constructor(options: ImageDocumentOptions) {
    this.width = options.width;
    this.height = options.height;
    this.palette = options.palette ?? ImageDocument.defaultPalette();
    this.layers = [this.createLayer("Layer 1")];
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

  /**
   * Return a new document scaled to `newWidth`×`newHeight` using nearest-neighbour
   * sampling (preserves hard pixel edges — appropriate for pixel art). Layer
   * structure, names, visibility, opacity and the palette are carried over.
   */
  resized(newWidth: number, newHeight: number): ImageDocument {
    const out = new ImageDocument({
      width: newWidth,
      height: newHeight,
      palette: this.palette.map((c) => c.slice()),
    });
    out.layers = this.layers.map((layer, index) => {
      const dst = index === 0 ? out.layers[0]! : out.createLayer(layer.name);
      dst.name = layer.name;
      dst.visible = layer.visible;
      dst.opacity = layer.opacity;
      for (let y = 0; y < newHeight; y++) {
        const sy = Math.min(this.height - 1, Math.floor((y * this.height) / newHeight));
        for (let x = 0; x < newWidth; x++) {
          const sx = Math.min(this.width - 1, Math.floor((x * this.width) / newWidth));
          const so = (sy * this.width + sx) * 4;
          const dstOff = (y * newWidth + x) * 4;
          dst.data[dstOff] = layer.data[so]!;
          dst.data[dstOff + 1] = layer.data[so + 1]!;
          dst.data[dstOff + 2] = layer.data[so + 2]!;
          dst.data[dstOff + 3] = layer.data[so + 3]!;
        }
      }
      return dst;
    });
    out.activeLayerIndex = Math.min(this.activeLayerIndex, out.layers.length - 1);
    return out;
  }

  /** Return a new document cropped to the given rectangle. */
  cropped(x: number, y: number, w: number, h: number): ImageDocument {
    const out = new ImageDocument({
      width: w,
      height: h,
      palette: this.palette.map((c) => c.slice()),
    });
    out.layers = this.layers.map((layer, index) => {
      const dst = index === 0 ? out.layers[0]! : out.createLayer(layer.name);
      dst.name = layer.name;
      dst.visible = layer.visible;
      dst.opacity = layer.opacity;
      for (let yy = 0; yy < h; yy++) {
        const sy = y + yy;
        if (sy < 0 || sy >= this.height) continue;
        for (let xx = 0; xx < w; xx++) {
          const sx = x + xx;
          if (sx < 0 || sx >= this.width) continue;
          const so = (sy * this.width + sx) * 4;
          const dstOff = (yy * w + xx) * 4;
          dst.data[dstOff] = layer.data[so]!;
          dst.data[dstOff + 1] = layer.data[so + 1]!;
          dst.data[dstOff + 2] = layer.data[so + 2]!;
          dst.data[dstOff + 3] = layer.data[so + 3]!;
        }
      }
      return dst;
    });
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

  /** Flatten all visible layers (alpha-over) into a single RGBA buffer. */
  composite(): Uint8ClampedArray {
    const out = new Uint8ClampedArray(this.width * this.height * 4);
    for (const layer of this.layers) {
      if (!layer.visible || layer.opacity <= 0) continue;
      const src = layer.data;
      for (let i = 0; i < out.length; i += 4) {
        const sa = (src[i + 3]! / 255) * layer.opacity;
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
