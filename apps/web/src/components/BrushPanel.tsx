import { useEditor, type BrushSettings } from "../state/EditorContext";

// Legacy brush presets (brushPanel.js): preview thumbnail → brush id.
const PRESETS = [0, 10, 11, 12, 13];

const SLIDERS: { key: keyof BrushSettings; label: string; min: number; max: number }[] = [
  { key: "size", label: "Size", min: 1, max: 100 },
  { key: "softness", label: "Softness", min: 0, max: 10 },
  { key: "opacity", label: "Opacity", min: 1, max: 100 },
  { key: "flow", label: "Flow", min: 1, max: 100 },
  { key: "jitter", label: "Jitter", min: 0, max: 100 },
  { key: "rotation", label: "Rotation", min: 0, max: 360 },
  { key: "roundness", label: "Roundness", min: 5, max: 100 },
];

/** Parametric brush panel, ported from the legacy `.panel.brush` (brushPanel.js). */
export function BrushPanel() {
  const { brushSettings, setBrushSetting, ditherPattern, setDitherPattern, openDitherEditor, setTool } =
    useEditor();
  return (
    <div className="brush-panel" data-testid="brush-panel">
      {SLIDERS.map((s) => (
        <div className="rangeselect" key={s.key}>
          <label className="label">{s.label}</label>
          <input
            type="range"
            data-testid={`brush-${s.key}`}
            min={s.min}
            max={s.max}
            value={brushSettings[s.key]}
            onChange={(e) => setBrushSetting(s.key, Number(e.target.value))}
          />
          <input
            type="text"
            className="rangeinput"
            data-testid={`brush-${s.key}-value`}
            value={brushSettings[s.key]}
            onChange={(e) => setBrushSetting(s.key, Number(e.target.value) || s.min)}
          />
        </div>
      ))}
      <div className="dither">
        <label className="label">Dither</label>
        <div className="patterns">
          {[0, 1, 2, 3].map((p) => (
            <div
              key={p}
              className={`pattern p${p}${ditherPattern === p ? " active" : ""}`}
              data-testid={`brush-dither-${p}`}
              data-tip={p === 0 ? "Solid" : `Pattern ${p}`}
              onClick={() => setDitherPattern(p)}
            />
          ))}
          <div
            className={`pattern p4${ditherPattern === 4 ? " active" : ""}`}
            data-testid="brush-dither-custom"
            data-tip="Custom pattern (click to edit)"
            onClick={() => {
              setDitherPattern(4);
              openDitherEditor();
            }}
          />
        </div>
      </div>
      <div className="presets" data-testid="brush-presets">
        <div className="subcaption">Presets</div>
        {PRESETS.map((id, i) => (
          <div
            key={id}
            className="preset handle"
            data-testid={`brush-preset-${id}`}
            data-tip="Use this brush preset"
            style={{ backgroundImage: `url("/_img/brushes/preview/${i}.png")` }}
            onClick={() => setTool("brush")}
          />
        ))}
      </div>
    </div>
  );
}
