import { COMMAND } from "@dpaint/core";
import { useEditor } from "../state/EditorContext";

/** Top menu bar wired to the legacy COMMAND event bus. */
export function MenuBar() {
  const { bus, newImage, zoom, setZoom } = useEditor();
  return (
    <div className="menubar" role="menubar" data-testid="menubar">
      <span className="brand">DPaint.js</span>
      <button type="button" data-testid="menu-new" onClick={() => newImage(64, 48)}>
        New
      </button>
      <button
        type="button"
        data-testid="menu-clear"
        onClick={() => bus.trigger(COMMAND.CLEAR)}
      >
        Clear
      </button>
      <button
        type="button"
        data-testid="menu-newlayer"
        onClick={() => bus.trigger(COMMAND.NEWLAYER)}
      >
        Add layer
      </button>
      <span className="spacer" />
      <button
        type="button"
        data-testid="menu-zoomout"
        aria-label="Zoom out"
        onClick={() => bus.trigger(COMMAND.ZOOMOUT)}
      >
        −
      </button>
      <span className="zoom-label" data-testid="zoom-label">
        {zoom}×
      </span>
      <button
        type="button"
        data-testid="menu-zoomin"
        aria-label="Zoom in"
        onClick={() => bus.trigger(COMMAND.ZOOMIN)}
      >
        +
      </button>
      <button type="button" data-testid="menu-zoomreset" onClick={() => setZoom(8)}>
        Reset
      </button>
    </div>
  );
}
