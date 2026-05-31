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
