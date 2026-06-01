import { useEditor } from "../state/EditorContext";

/** Animation timeline: frame selector + add/duplicate/delete controls. */
export function FramesPanel() {
  const { doc, frameCount, activeFrameIndex, addFrame, duplicateFrame, deleteFrame, goToFrame } =
    useEditor();
  void doc; // re-render on document changes via context version

  return (
    <div className="frames-panel" data-testid="frames-panel">
      <div className="frames-panel-header">
        Frames <span data-testid="frame-indicator">{activeFrameIndex + 1}/{frameCount}</span>
      </div>
      <div className="frame-strip" data-testid="frame-strip">
        {Array.from({ length: frameCount }, (_, i) => (
          <button
            key={i}
            type="button"
            className={"frame-cell" + (i === activeFrameIndex ? " active" : "")}
            data-testid={`frame-cell-${i}`}
            onClick={() => goToFrame(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div className="frame-actions">
        <button type="button" data-testid="frame-add" onClick={addFrame}>
          +
        </button>
        <button type="button" data-testid="frame-duplicate" onClick={duplicateFrame}>
          ⎘
        </button>
        <button
          type="button"
          data-testid="frame-delete"
          disabled={frameCount <= 1}
          onClick={deleteFrame}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
