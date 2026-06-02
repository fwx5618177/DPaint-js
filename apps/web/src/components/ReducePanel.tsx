import { useState } from "react";
import { useEditor } from "../state/EditorContext";

/** Colour-reduction panel, ported from the legacy `.panel.reduce` (ditherPanel). */
export function ReducePanel() {
  const { reducePaletteTo, ditherImage, paletteFromImage } = useEditor();
  const [palette, setPalette] = useState<"current" | "optimized">("optimized");
  const [colors, setColors] = useState(16);
  const [dither, setDither] = useState(false);

  const apply = () => {
    if (palette === "optimized") reducePaletteTo(colors);
    else paletteFromImage();
    if (dither) ditherImage();
  };

  return (
    <div className="reduce-panel" data-testid="reduce-panel">
      <div className="subpanel flex">
        <label className="label">Palette</label>
        <select
          data-testid="reduce-palette"
          value={palette}
          onChange={(e) => setPalette(e.target.value as "current" | "optimized")}
        >
          <option value="optimized">Optimized</option>
          <option value="current">Current</option>
        </select>
      </div>
      {palette === "optimized" && (
        <div className="subpanel flex">
          <label className="label">Colours</label>
          <input
            type="range"
            data-testid="reduce-colors"
            min={2}
            max={256}
            value={colors}
            onChange={(e) => setColors(Number(e.target.value))}
          />
          <div className="value" data-testid="reduce-colors-value">
            {colors}
          </div>
        </div>
      )}
      <div className="subpanel flex">
        <label className="checkbox label small">
          <label>
            <input
              type="checkbox"
              data-testid="reduce-dither"
              checked={dither}
              onChange={(e) => setDither(e.target.checked)}
            />
            <span>Floyd–Steinberg dither</span>
          </label>
        </label>
      </div>
      <button type="button" className="button full" data-testid="reduce-apply" onClick={apply}>
        Apply
      </button>
    </div>
  );
}
