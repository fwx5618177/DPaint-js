import { useEffect, useRef } from "react";
import { bitplaneImages, buildPaletteFromImage } from "@dpaint/imaging";
import { useEditor } from "../state/EditorContext";

/** Visualises the bit planes of the (palette-quantized) composite image. */
export function BitplanesPanel() {
  const { doc, showBitplanes, version } = useEditor();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showBitplanes) return;
    const container = containerRef.current;
    if (!container) return;
    const composite = doc.composite();
    const palette = doc.palette.length ? doc.palette : buildPaletteFromImage(composite, 16);
    const planes = bitplaneImages(composite, doc.width, doc.height, palette);
    container.innerHTML = "";
    planes.forEach((plane, i) => {
      const canvas = document.createElement("canvas");
      canvas.width = doc.width;
      canvas.height = doc.height;
      canvas.className = "bitplane-canvas";
      canvas.title = `Bit plane ${i}`;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const img = new ImageData(doc.width, doc.height);
        img.data.set(plane);
        ctx.putImageData(img, 0, 0);
      }
      container.appendChild(canvas);
    });
  }, [showBitplanes, version, doc]);

  if (!showBitplanes) return null;
  return (
    <div className="bitplanes-panel" data-testid="bitplanes-panel">
      <div className="bitplanes-header">Bit planes</div>
      <div ref={containerRef} className="bitplanes-grid" data-testid="bitplanes-grid" />
    </div>
  );
}
