import { Color } from "@dpaint/primitives";
import { useEditor } from "../state/EditorContext";

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** Colour palette + current fore/background swatches, with palette editing. */
export function Palette() {
  const {
    doc,
    color,
    setColor,
    bgColor,
    setBgColor,
    swapColors,
    setPaletteColor,
    addPaletteColor,
    removePaletteColor,
  } = useEditor();
  return (
    <div className="palette" data-testid="palette">
      <div className="swatches">
        <button
          type="button"
          className="swatch foreground"
          data-testid="swatch-foreground"
          aria-label="Foreground colour"
          style={{ background: Color.toString(color) }}
        />
        <button
          type="button"
          className="swatch background"
          data-testid="swatch-background"
          aria-label="Background colour"
          style={{ background: Color.toString(bgColor) }}
        />
        <button
          type="button"
          className="swap"
          onClick={swapColors}
          data-testid="swap-colors"
          aria-label="Swap colours"
          title="Swap fore/background"
        >
          ⇄
        </button>
      </div>
      <div className="palette-grid" data-testid="palette-grid">
        {doc.palette.map((c, i) => (
          <label key={i} className="palette-color-wrap" title={`Palette colour ${i} — double-click to edit`}>
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
          title="Add the foreground colour to the palette"
          onClick={() => addPaletteColor([color[0]!, color[1]!, color[2]!])}
        >
          +
        </button>
        <button
          type="button"
          data-testid="palette-remove"
          title="Remove the last palette colour"
          disabled={doc.palette.length <= 1}
          onClick={() => removePaletteColor(doc.palette.length - 1)}
        >
          −
        </button>
      </div>
    </div>
  );
}
