import type { ColorArray } from "@dpaint/primitives";
import type { PixelRegion } from "@dpaint/document";

/**
 * Rasterise a line of text into a detached RGBA region using an offscreen
 * canvas. Returns null when no 2D canvas context is available (e.g. jsdom).
 */
export function renderTextRegion(
  text: string,
  color: ColorArray,
  fontPx = 12,
): PixelRegion | null {
  if (!text) return null;
  const canvas = document.createElement("canvas");
  const measureCtx = canvas.getContext("2d");
  if (!measureCtx) return null;

  const font = `${fontPx}px monospace`;
  measureCtx.font = font;
  const width = Math.max(1, Math.ceil(measureCtx.measureText(text).width));
  const height = fontPx + 4;

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = font;
  ctx.textBaseline = "top";
  ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
  ctx.fillText(text, 0, 2);

  const image = ctx.getImageData(0, 0, width, height);
  return { width, height, data: new Uint8ClampedArray(image.data) };
}
