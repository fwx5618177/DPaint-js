import { useCallback, useEffect, useRef, useState } from "react";
import { COMMAND, EVENT } from "@dpaint/runtime";
import type { ColorArray } from "@dpaint/primitives";
import { useEditor } from "../state/EditorContext";
import { renderTextRegion } from "../model/textRender";

interface DragState {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  button: number;
  color: ColorArray;
}

/** Renders the composited document into a canvas and routes pointer input to tools. */
export function CanvasView() {
  const editor = useEditor();
  const { doc, zoom, tool, color, bgColor, version, commit, checkpoint, bus, showGrid, showRulers, brushStroke, eraseStroke } =
    editor;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const arcRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const polyRef = useRef<Array<[number, number]>>([]);
  const mirrorRef = useRef<HTMLCanvasElement>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const { splitScreen } = editor;
  const scaledWidth = Math.max(1, Math.round(doc.width * zoom));
  const scaledHeight = Math.max(1, Math.round(doc.height * zoom));

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
    ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);

    // selection overlay (marching-ants style dashed rectangle)
    const sel = doc.selection;
    if (sel && sel.width > 0 && sel.height > 0) {
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#000";
      ctx.strokeRect(sel.x * zoom + 0.5, sel.y * zoom + 0.5, sel.width * zoom, sel.height * zoom);
      ctx.strokeStyle = "#fff";
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(sel.x * zoom + 0.5, sel.y * zoom + 0.5, sel.width * zoom, sel.height * zoom);
      ctx.restore();
    }

    // pixel grid overlay
    if (showGrid && zoom >= 4) {
      ctx.save();
      ctx.strokeStyle = "rgba(128,128,128,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= doc.width; x++) {
        ctx.moveTo(x * zoom + 0.5, 0);
        ctx.lineTo(x * zoom + 0.5, doc.height * zoom);
      }
      for (let y = 0; y <= doc.height; y++) {
        ctx.moveTo(0, y * zoom + 0.5);
        ctx.lineTo(doc.width * zoom, y * zoom + 0.5);
      }
      ctx.stroke();
      ctx.restore();
    }

    // ruler tick marks along the top and left edges
    if (showRulers) {
      ctx.save();
      ctx.strokeStyle = "rgba(74,144,217,0.8)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const step = 8;
      for (let x = 0; x <= doc.width; x += step) {
        ctx.moveTo(x * zoom + 0.5, 0);
        ctx.lineTo(x * zoom + 0.5, 6);
      }
      for (let y = 0; y <= doc.height; y += step) {
        ctx.moveTo(0, y * zoom + 0.5);
        ctx.lineTo(6, y * zoom + 0.5);
      }
      ctx.stroke();
      ctx.restore();
    }
  }, [doc, zoom, showGrid, showRulers]);

  useEffect(() => {
    paint();
  }, [paint, version]);

  // split-screen: paint the composite into the right-panel mirror view
  useEffect(() => {
    if (!splitScreen) return;
    const canvas = mirrorRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const image = new ImageData(doc.width, doc.height);
    image.data.set(doc.composite());
    const tmp = document.createElement("canvas");
    tmp.width = doc.width;
    tmp.height = doc.height;
    tmp.getContext("2d")!.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
  }, [splitScreen, doc, zoom, version]);

  const toDocCoords = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
      const rect = e.currentTarget.getBoundingClientRect();
      return {
        x: Math.floor(((e.clientX - rect.left) / Math.max(1, rect.width)) * doc.width),
        y: Math.floor(((e.clientY - rect.top) / Math.max(1, rect.height)) * doc.height),
      };
    },
    [doc.width, doc.height],
  );

  const applyStroke = useCallback(
    (x: number, y: number, drag: DragState, preview: boolean) => {
      switch (tool) {
        case "pencil":
          brushStroke(drag.lastX, drag.lastY, x, y, drag.color);
          break;
        case "eraser":
          eraseStroke(drag.lastX, drag.lastY, x, y);
          break;
        case "line":
          // for a live tool we keep it simple: commit only on release
          if (!preview) doc.drawLine(drag.startX, drag.startY, x, y, drag.color);
          break;
        case "rect":
        case "fillrect":
          if (!preview) {
            const rx = Math.min(drag.startX, x);
            const ry = Math.min(drag.startY, y);
            const rw = Math.abs(x - drag.startX) + 1;
            const rh = Math.abs(y - drag.startY) + 1;
            doc.drawRect(rx, ry, rw, rh, drag.color, tool === "fillrect");
          }
          break;
        case "ellipse":
        case "fillellipse":
          if (!preview) {
            doc.drawEllipse(drag.startX, drag.startY, x, y, drag.color, tool === "fillellipse");
          }
          break;
        case "fill":
          if (!preview) doc.floodFill(x, y, drag.color);
          break;
        case "gradient":
          if (!preview) doc.gradientLinear(drag.startX, drag.startY, x, y, drag.color, drag.button ? color : bgColor);
          break;
        case "picker":
          if (!preview) {
            const p = doc.getPixel(x, y);
            if (p) {
              const picked: ColorArray = [p[0], p[1], p[2]];
              if (drag.button) editor.setBgColor(picked);
              else editor.setColor(picked);
              bus.trigger(EVENT.drawColorChanged, p);
            }
          }
          break;
      }
    },
    [tool, doc, color, bgColor, editor, bus, brushStroke, eraseStroke],
  );

  const setSelectionFromDrag = useCallback(
    (drag: DragState, x: number, y: number) => {
      const sx = Math.min(drag.startX, x);
      const sy = Math.min(drag.startY, y);
      doc.selectionMask = null; // a fresh rectangular drag replaces any mask
      doc.selection = {
        x: sx,
        y: sy,
        width: Math.abs(x - drag.startX) + 1,
        height: Math.abs(y - drag.startY) + 1,
      };
    },
    [doc],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const { x, y } = toDocCoords(e);
      const dragColor = e.button ? bgColor : color;
      const drag: DragState = { startX: x, startY: y, lastX: x, lastY: y, button: e.button, color: dragColor };
      dragRef.current = drag;
      if (tool === "pencil") {
        brushStroke(x, y, x, y, drag.color);
        commit();
      } else if (tool === "eraser") {
        eraseStroke(x, y, x, y);
        commit();
      } else if (tool === "brush") {
        editor.stampBrush(x, y);
        commit();
      } else if (tool === "polygonselect") {
        polyRef.current.push([x, y]); // accumulate; double-click closes
        dragRef.current = null;
      } else if (tool === "wandselect") {
        editor.magicWandSelect(x, y);
        dragRef.current = null; // one-shot
      } else if (tool === "layerpick") {
        const idx = doc.topLayerAt(x, y);
        if (idx >= 0) {
          doc.activeLayerIndex = idx;
          commit();
        }
        dragRef.current = null;
      } else if (tool === "pan") {
        dragRef.current = null; // view-only; no pixel mutation
      } else if (tool === "arc") {
        if (arcRef.current) {
          // second click supplies the waypoint the arc bows through
          const a = arcRef.current;
          doc.drawArc(a.x0, a.y0, a.x1, a.y1, x, y, drag.color);
          commit();
          checkpoint();
          arcRef.current = null;
          dragRef.current = null;
        }
        // first phase: the chord is captured on pointer up below
      } else if (tool === "spray") {
        doc.spray(x, y, 4, 8, drag.color);
        commit();
      } else if (tool === "fill" || tool === "picker") {
        applyStroke(x, y, drag, false);
        commit();
      } else if (tool === "text") {
        const str = typeof window !== "undefined" ? window.prompt("Enter text:") : null;
        if (str) {
          const region = renderTextRegion(str, drag.color);
          if (region) {
            doc.stampRegion(region, x, y);
            commit();
            checkpoint();
          }
        }
        dragRef.current = null; // one-shot
      } else if (tool === "select") {
        setSelectionFromDrag(drag, x, y);
        commit();
      }
    },
    [toDocCoords, tool, doc, color, bgColor, commit, checkpoint, applyStroke, setSelectionFromDrag, editor, brushStroke, eraseStroke],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const { x, y } = toDocCoords(e);
      setCursor({ x, y });
      const drag = dragRef.current;
      if (!drag) return;
      if (tool === "pencil" || tool === "eraser") {
        applyStroke(x, y, drag, false);
        drag.lastX = x;
        drag.lastY = y;
        commit();
      } else if (tool === "spray") {
        doc.spray(x, y, 4, 8, drag.color);
        commit();
      } else if (tool === "smudge") {
        doc.smudge(drag.lastX, drag.lastY, x, y, 0.5);
        drag.lastX = x;
        drag.lastY = y;
        commit();
      } else if (tool === "select") {
        setSelectionFromDrag(drag, x, y);
        commit();
      }
    },
    [toDocCoords, tool, doc, applyStroke, commit, setSelectionFromDrag],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const { x, y } = toDocCoords(e);
      if (tool === "arc") {
        // first phase: store the chord; the next click supplies the waypoint
        arcRef.current = { x0: drag.startX, y0: drag.startY, x1: x, y1: y };
        dragRef.current = null;
        return;
      }
      if (
        tool === "line" ||
        tool === "rect" ||
        tool === "fillrect" ||
        tool === "ellipse" ||
        tool === "fillellipse" ||
        tool === "gradient"
      ) {
        applyStroke(x, y, drag, false);
        commit();
      } else if (tool === "select") {
        setSelectionFromDrag(drag, x, y);
        commit();
      }
      dragRef.current = null;
      // Picker/select don't mutate pixels; text already checkpointed on down.
      if (tool !== "picker" && tool !== "select" && tool !== "text") checkpoint();
    },
    [toDocCoords, tool, applyStroke, commit, checkpoint, setSelectionFromDrag],
  );

  return (
    <div className="editor splitpanel" data-testid="canvas-view">
      <div className="panel left">
        <div className="toolbar">
          <div className="button info" data-tip="Zoom out" onClick={() => bus.trigger(COMMAND.ZOOMOUT)}>
            −
          </div>
          <div className="button auto info" data-tip="Reset zoom" data-testid="zoom-label" onClick={() => editor.setZoom(1)}>
            {Math.round(zoom * 100)}%
          </div>
          <div className="button info" data-tip="Zoom in" onClick={() => bus.trigger(COMMAND.ZOOMIN)}>
            +
          </div>
          <div className="button expand info" data-tip="Fit to window" data-testid="menu-zoomfit" onClick={() => editor.zoomFit()} />
        </div>
        <div className="viewport">
          <div className="canvaswrapper">
            <div className="canvascontainer">
              <canvas
                ref={canvasRef}
                width={scaledWidth}
                height={scaledHeight}
                className="maincanvas info"
                data-testid="paint-canvas"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={() => setCursor(null)}
                onDoubleClick={() => {
                  if (tool === "polygonselect" && polyRef.current.length >= 3) {
                    editor.selectPolygon(polyRef.current.slice());
                  }
                  polyRef.current = [];
                }}
                onContextMenu={(e) => e.preventDefault()}
                style={{ touchAction: "none" }}
              />
            </div>
          </div>
          <div className="canvas-coords" data-testid="canvas-coords">
            {cursor ? `${cursor.x}, ${cursor.y}` : "—"}
          </div>
        </div>
      </div>
      {/* legacy hides the `:last-of-type` panel; on split-screen it shows a second
          view of the image (here a live mirror of the composite). */}
      <div className="panel right" data-testid="canvas-panel-right">
        {splitScreen && (
          <div className="viewport">
            <div className="canvaswrapper">
              <div className="canvascontainer">
                <canvas
                  ref={mirrorRef}
                  width={scaledWidth}
                  height={scaledHeight}
                  className="maincanvas info"
                  data-testid="paint-canvas-mirror"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
