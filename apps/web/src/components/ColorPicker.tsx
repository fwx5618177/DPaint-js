import { useEffect, useRef, useState } from "react";
import { useEditor } from "../state/EditorContext";

const W = 120;
const H = 120;
const HUE_W = 20;

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

/** HSV colour picker, ported from the legacy colorPicker.js / `.colorpicker`. */
export function ColorPicker() {
  const { color, setColor } = useEditor();
  const svRef = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef<HTMLCanvasElement>(null);
  const [hue, setHue] = useState(() => rgbToHsv(color[0]!, color[1]!, color[2]!)[0]);
  const [, sat, val] = rgbToHsv(color[0]!, color[1]!, color[2]!);

  // paint the saturation/value square for the current hue
  useEffect(() => {
    const ctx = svRef.current?.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const [r, g, b] = hsvToRgb(hue, x / (W - 1), 1 - y / (H - 1));
        const o = (y * W + x) * 4;
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [hue]);

  // paint the hue strip once
  useEffect(() => {
    const ctx = hueRef.current?.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(HUE_W, H);
    for (let y = 0; y < H; y++) {
      const [r, g, b] = hsvToRgb((y / (H - 1)) * 360, 1, 1);
      for (let x = 0; x < HUE_W; x++) {
        const o = (y * HUE_W + x) * 4;
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, []);

  const pickSV = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(W - 1, e.clientX - rect.left));
    const y = Math.max(0, Math.min(H - 1, e.clientY - rect.top));
    setColor(hsvToRgb(hue, x / (W - 1), 1 - y / (H - 1)));
  };
  const pickHue = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = Math.max(0, Math.min(H - 1, e.clientY - rect.top));
    const h = (y / (H - 1)) * 360;
    setHue(h);
    setColor(hsvToRgb(h, sat || 1, val || 1));
  };

  return (
    <div className="colorpicker" data-testid="colorpicker">
      <canvas
        ref={svRef}
        className="handle"
        width={W}
        height={H}
        data-testid="colorpicker-sv"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pickSV(e);
        }}
        onPointerMove={(e) => e.buttons === 1 && pickSV(e)}
      />
      <canvas
        ref={hueRef}
        className="handle"
        width={HUE_W}
        height={H}
        data-testid="colorpicker-hue"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pickHue(e);
        }}
        onPointerMove={(e) => e.buttons === 1 && pickHue(e)}
      />
      <div className="dot" style={{ left: sat * W, top: (1 - val) * H }} />
      <div className="line" style={{ top: (hue / 360) * H }} />
    </div>
  );
}
