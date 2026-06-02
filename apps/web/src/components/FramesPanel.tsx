import { useEffect, useRef } from "react";
import { useEditor } from "../state/EditorContext";

const FRAME_WIDTH = 52;

/** A 48×48 thumbnail of a frame's composite (legacy renders a canvas per frame). */
function FrameThumb({ index }: { index: number }) {
  const { doc, version } = useEditor();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 48, 48);
    try {
      const rgba = doc.composite(index);
      const img = new ImageData(new Uint8ClampedArray(rgba), doc.width, doc.height);
      const tmp = document.createElement("canvas");
      tmp.width = doc.width;
      tmp.height = doc.height;
      tmp.getContext("2d")!.putImageData(img, 0, 0);
      ctx.drawImage(tmp, 0, 0, 48, 48);
    } catch {
      /* frame not renderable yet */
    }
  }, [doc, index, version]);
  return <canvas ref={ref} width={48} height={48} />;
}

/**
 * Animation timeline, ported from the legacy `.panel.frames` (framesPanel.js):
 * a `.paneltools` header (frame index + add/delete, and on multi-frame an
 * inline play/FPS row) above a `.panelcontent` strip of `.frame.info` thumbnails.
 */
export function FramesPanel() {
  const {
    doc,
    frameCount,
    activeFrameIndex,
    addFrame,
    duplicateFrame,
    deleteFrame,
    goToFrame,
    clearFrame,
    moveFrameToEnd,
    framesToLayers,
    layersToFrames,
    layersToSheet,
  } = useEditor();
  void doc;
  const multi = frameCount > 1;

  return (
    <div className="frames-panel" data-testid="frames-panel">
      <div className={"paneltools" + (multi ? " multirow" : "")}>
        <div className="frameselectinline">
          <input
            type="range"
            className={"framerange" + (multi ? "" : " hidden")}
            min={0}
            max={Math.max(0, frameCount - 1)}
            value={activeFrameIndex}
            onChange={(e) => goToFrame(Number(e.target.value))}
          />
          <span className="frame-indicator" data-testid="frame-indicator">
            {activeFrameIndex + 1}/{frameCount}
          </span>
        </div>
        <button
          type="button"
          className="button delete"
          data-tip="Delete active frame"
          data-testid="frame-delete"
          disabled={!multi}
          onClick={deleteFrame}
        />
        <div
          className="button add"
          role="button"
          data-tip="Add new frame"
          data-testid="frame-add"
          onClick={addFrame}
        />
        {multi && (
          <div className="framecontrols">
            <div className="button play" role="button" data-tip="Play animation" />
            <div className="rangeselectinline">
              <label>FPS</label>
              <input type="range" min={1} max={60} defaultValue={12} />
              <input type="text" defaultValue={12} />
            </div>
          </div>
        )}
      </div>

      <div className={"panelcontent" + (multi ? " multirow" : "")}>
        {Array.from({ length: frameCount }, (_, i) => (
          <div
            key={i}
            className={"frame info" + (i === activeFrameIndex && multi ? " active" : "")}
            data-testid={`frame-cell-${i}`}
            style={{ left: i * FRAME_WIDTH }}
            onClick={() => goToFrame(i)}
          >
            <FrameThumb index={i} />
            <div className="label">{i}</div>
          </div>
        ))}
      </div>

      {/* frame operations (legacy exposes these via the frame context menu) */}
      <div className="panelfoot frame-ops">
        <div className="button full" role="button" data-testid="frame-duplicate" data-tip="Duplicate frame" onClick={duplicateFrame}>
          Dup
        </div>
        <div className="button full" role="button" data-testid="frame-clear" data-tip="Clear frame" onClick={clearFrame}>
          Clear
        </div>
        <div className="button full" role="button" data-testid="frame-to-end" data-tip="Move frame to end" onClick={moveFrameToEnd}>
          End
        </div>
      </div>
      <div className="panelfoot frame-convert">
        <div className="button full" role="button" data-testid="frames-to-layers" data-tip="Frames → layers" onClick={framesToLayers}>
          F→L
        </div>
        <div className="button full" role="button" data-testid="layers-to-frames" data-tip="Layers → frames" onClick={layersToFrames}>
          L→F
        </div>
        <div className="button full" role="button" data-testid="layers-to-sheet" data-tip="Frames → sprite sheet" onClick={layersToSheet}>
          Sheet
        </div>
      </div>
    </div>
  );
}
