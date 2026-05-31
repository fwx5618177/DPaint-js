import { useCallback, useEffect, useRef, useState } from "react";
import { EVENT } from "@dpaint/core";
import { useEditor } from "../state/EditorContext";

interface DragState {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
}

/** Renders the composited document into a canvas and routes pointer input to tools. */
export function CanvasView() {
  const editor = useEditor();
  const { doc, zoom, tool, color, version, commit, checkpoint, bus } = editor;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const composite = doc.composite();
    const image = new ImageData(doc.width, doc.height);
    image.data.set(composite);
    // draw at 1:1 to an offscreen-sized canvas, then scale via nearest-neighbour
    ctx.imageSmoothingEnabled = false;
    const tmp = document.createElement("canvas");
    tmp.width = doc.width;
    tmp.height = doc.height;
    tmp.getContext("2d")!.putImageData(image, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tmp, 0, 0, doc.width * zoom, doc.height * zoom);
  }, [doc, zoom]);

  useEffect(() => {
    paint();
  }, [paint, version]);

  const toDocCoords = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
      const rect = e.currentTarget.getBoundingClientRect();
      return {
        x: Math.floor((e.clientX - rect.left) / zoom),
        y: Math.floor((e.clientY - rect.top) / zoom),
      };
    },
    [zoom],
  );

  const applyStroke = useCallback(
    (x: number, y: number, drag: DragState, preview: boolean) => {
      switch (tool) {
        case "pencil":
          doc.drawLine(drag.lastX, drag.lastY, x, y, color);
          break;
        case "line":
          // for a live tool we keep it simple: commit only on release
          if (!preview) doc.drawLine(drag.startX, drag.startY, x, y, color);
          break;
        case "rect":
        case "fillrect":
          if (!preview) {
            const rx = Math.min(drag.startX, x);
            const ry = Math.min(drag.startY, y);
            const rw = Math.abs(x - drag.startX) + 1;
            const rh = Math.abs(y - drag.startY) + 1;
            doc.drawRect(rx, ry, rw, rh, color, tool === "fillrect");
          }
          break;
        case "ellipse":
        case "fillellipse":
          if (!preview) {
            doc.drawEllipse(drag.startX, drag.startY, x, y, color, tool === "fillellipse");
          }
          break;
        case "fill":
          if (!preview) doc.floodFill(x, y, color);
          break;
        case "picker":
          if (!preview) {
            const p = doc.getPixel(x, y);
            if (p) {
              editor.setColor([p[0], p[1], p[2]]);
              bus.trigger(EVENT.drawColorChanged, p);
            }
          }
          break;
      }
    },
    [tool, doc, color, editor, bus],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const { x, y } = toDocCoords(e);
      const drag: DragState = { startX: x, startY: y, lastX: x, lastY: y };
      dragRef.current = drag;
      if (tool === "pencil") {
        doc.setPixel(x, y, color);
        commit();
      } else if (tool === "fill" || tool === "picker") {
        applyStroke(x, y, drag, false);
        commit();
      }
    },
    [toDocCoords, tool, doc, color, commit, applyStroke],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const { x, y } = toDocCoords(e);
      setCursor({ x, y });
      const drag = dragRef.current;
      if (!drag) return;
      if (tool === "pencil") {
        applyStroke(x, y, drag, false);
        drag.lastX = x;
        drag.lastY = y;
        commit();
      }
    },
    [toDocCoords, tool, applyStroke, commit],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const { x, y } = toDocCoords(e);
      if (
        tool === "line" ||
        tool === "rect" ||
        tool === "fillrect" ||
        tool === "ellipse" ||
        tool === "fillellipse"
      ) {
        applyStroke(x, y, drag, false);
        commit();
      }
      dragRef.current = null;
      // The picker does not mutate pixels, so it does not create an undo step.
      if (tool !== "picker") checkpoint();
    },
    [toDocCoords, tool, applyStroke, commit, checkpoint],
  );

  return (
    <div className="canvas-view" data-testid="canvas-view">
      <canvas
        ref={canvasRef}
        width={doc.width * zoom}
        height={doc.height * zoom}
        className="paint-canvas"
        data-testid="paint-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setCursor(null)}
        style={{ touchAction: "none" }}
      />
      <div className="canvas-coords" data-testid="canvas-coords">
        {cursor ? `${cursor.x}, ${cursor.y}` : "—"}
      </div>
    </div>
  );
}
