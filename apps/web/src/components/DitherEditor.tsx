import { useEditor } from "../state/EditorContext";

/** Editable 4×4 dither-pattern grid, ported from the legacy ditherDialog. */
export function DitherEditor() {
  const { ditherEditorOpen, closeDitherEditor, customDither, toggleDitherCell } = useEditor();
  if (!ditherEditorOpen) return null;
  return (
    <>
      <div className="blanket active" onClick={closeDitherEditor} />
      <div className="modalwindow active dithereditor" data-testid="dither-editor">
        <div className="caption">
          <div className="handle">Dither pattern</div>
          <div className="button" data-testid="dither-editor-close" onClick={closeDitherEditor}>
            x
          </div>
        </div>
        <div className="inner">
          <div className="dither-grid" data-testid="dither-grid">
            {customDither.map((on, i) => (
              <div
                key={i}
                className={`dither-cell${on ? " on" : ""}`}
                data-testid={`dither-cell-${i}`}
                onClick={() => toggleDitherCell(i)}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
