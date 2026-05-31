import { Color } from "@dpaint/util";
import { useEditor } from "../state/EditorContext";

/** Colour palette + current fore/background swatches. */
export function Palette() {
  const { doc, color, setColor, bgColor, setBgColor, swapColors } = useEditor();
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
          <button
            key={i}
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
        ))}
      </div>
    </div>
  );
}
