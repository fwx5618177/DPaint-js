import { useState } from "react";
import { useEditor, type EffectKind, type ArtisticFilter } from "../state/EditorContext";

interface EffectDef {
  kind: EffectKind;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

/** Image adjustment effects, ported from the legacy Effects engine. */
const EFFECTS: EffectDef[] = [
  { kind: "brightness", label: "Brightness", min: -128, max: 128, step: 1, default: 20 },
  { kind: "contrast", label: "Contrast", min: 0, max: 3, step: 0.1, default: 1.3 },
  { kind: "saturation", label: "Saturation", min: 0, max: 3, step: 0.1, default: 1.5 },
  { kind: "hue", label: "Hue", min: 0, max: 360, step: 5, default: 90 },
  { kind: "sepia", label: "Sepia", min: 0, max: 1, step: 0.05, default: 1 },
  { kind: "invert", label: "Invert", min: 0, max: 1, step: 0.05, default: 1 },
  { kind: "blur", label: "Blur", min: 1, max: 8, step: 1, default: 2 },
  { kind: "sharpen", label: "Sharpen", min: 0, max: 1, step: 0.1, default: 1 },
  { kind: "texture", label: "Texture", min: 0, max: 2, step: 0.1, default: 0.8 },
  { kind: "dehaze", label: "Dehaze", min: 0, max: 2, step: 0.1, default: 0.5 },
  { kind: "balanceR", label: "Red", min: -100, max: 100, step: 1, default: 30 },
  { kind: "balanceG", label: "Green", min: -100, max: 100, step: 1, default: 30 },
  { kind: "balanceB", label: "Blue", min: -100, max: 100, step: 1, default: 30 },
  { kind: "feather", label: "Feather", min: -1, max: 1, step: 0.1, default: 1 },
  { kind: "outline", label: "Outline", min: 0, max: 1, step: 1, default: 1 },
];

/** One-shot operations (legacy Effect/Reduce dialog + Image menu) as buttons. */
const ARTISTIC: ArtisticFilter[] = ["displace", "glow", "dots", "speckles", "lines", "web", "ripples"];

export function EffectsPanel() {
  const {
    applyEffect,
    grayscale,
    invert,
    posterizeImage,
    thresholdImage,
    blurImage,
    ditherImage,
    offsetImage,
    medianSmooth,
    sharpenImage,
    paletteFromImage,
    applyArtistic,
  } = useEditor();
  const [kind, setKind] = useState<EffectKind>("brightness");
  const def = EFFECTS.find((e) => e.kind === kind)!;
  const [value, setValue] = useState(def.default);

  // one-shot operations keep their legacy MenuBar test ids so every operation
  // stays reachable from the UI (the dedicated Effect/Reduce dialogs are pending).
  const ops: { id: string; label: string; run: () => void }[] = [
    { id: "menu-grayscale", label: "Greyscale", run: grayscale },
    { id: "menu-invert", label: "Invert", run: invert },
    { id: "menu-posterize", label: "Posterise", run: posterizeImage },
    { id: "menu-threshold", label: "Threshold", run: thresholdImage },
    { id: "menu-blur", label: "Blur", run: blurImage },
    { id: "menu-dither", label: "Dither", run: ditherImage },
    { id: "menu-offset", label: "Offset", run: offsetImage },
    { id: "menu-smooth", label: "Smooth", run: medianSmooth },
    { id: "menu-sharpen", label: "Sharpen", run: sharpenImage },
    { id: "menu-palette-from-image", label: "Palette ⟵ image", run: paletteFromImage },
  ];

  return (
    <div className="effects-panel" data-testid="effects-panel">
      <div className="effects-header">Effects</div>
      <select
        data-testid="effect-select"
        value={kind}
        onChange={(e) => {
          const next = EFFECTS.find((x) => x.kind === e.target.value)!;
          setKind(next.kind);
          setValue(next.default);
        }}
      >
        {EFFECTS.map((e) => (
          <option key={e.kind} value={e.kind}>
            {e.label}
          </option>
        ))}
      </select>
      <input
        type="range"
        data-testid="effect-value"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
      />
      <span className="effect-amount" data-testid="effect-amount">
        {value}
      </span>
      <button type="button" data-testid="effect-apply" onClick={() => applyEffect(kind, value)}>
        Apply
      </button>
      <div className="effect-ops" data-testid="effect-ops">
        {ops.map((o) => (
          <button key={o.id} type="button" data-testid={o.id} data-tip={o.label} onClick={o.run}>
            {o.label}
          </button>
        ))}
        {ARTISTIC.map((f) => (
          <button
            key={f}
            type="button"
            data-testid={`menu-${f}`}
            data-tip={`Alchemy: ${f}`}
            onClick={() => applyArtistic(f)}
          >
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}
