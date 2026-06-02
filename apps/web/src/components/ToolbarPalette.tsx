import { Color } from "@dpaint/primitives";
import { useEditor } from "../state/EditorContext";

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

/** The palette swatch grid, in the left toolbar like legacy DPaint. */
export function ToolbarPalette() {
  const { doc, setColor, setBgColor, setPaletteColor, addPaletteColor, removePaletteColor, color, version } =
    useEditor();
  void version; // re-render when the palette mutates
  return (
    <div className="palettegrid" data-testid="toolbar-palette">
      <div className="palette-grid" data-testid="palette-grid">
        {doc.palette.map((c, i) => (
          <label key={i} className="palette-color-wrap" data-tip={`Palette colour ${i}`}>
            <button
              type="button"
              className="palette-color"
              data-testid={`palette-color-${i}`}
              aria-label={`Palette colour ${i}`}
              style={{ background: Color.toString(c) }}
              onClick={() => setColor([c[0]!, c[1]!, c[2]!])}
              onContextMenu={(e) => {
                e.preventDefault();
                setBgColor([c[0]!, c[1]!, c[2]!]);
              }}
            />
            <input
              type="color"
              className="palette-color-edit"
              data-testid={`palette-edit-${i}`}
              aria-label={`Edit palette colour ${i}`}
              value={Color.toHex([c[0]!, c[1]!, c[2]!]) ?? "#000000"}
              onChange={(e) => setPaletteColor(i, hexToRgb(e.target.value))}
            />
          </label>
        ))}
      </div>
      <div className="palette-actions">
        <button
          type="button"
          data-testid="palette-add"
          data-tip="Add the foreground colour"
          onClick={() => addPaletteColor([color[0]!, color[1]!, color[2]!])}
        >
          +
        </button>
        <button
          type="button"
          data-testid="palette-remove"
          data-tip="Remove the last colour"
          disabled={doc.palette.length <= 1}
          onClick={() => removePaletteColor(doc.palette.length - 1)}
        >
          −
        </button>
      </div>
    </div>
  );
}
