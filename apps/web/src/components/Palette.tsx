import { useEditor } from "../state/EditorContext";

/**
 * Palette controls, ported from the legacy palette tools (palette.js): palette
 * modes (EHB / lock / stencil), expand / cycle-step / 24-bit, multi-palette
 * navigation, presets and colour cycling. Styled with the legacy `.subpanel`
 * chrome so it matches the original instead of looking like generic buttons.
 */
export function Palette() {
  const {
    doc,
    reducePaletteTo,
    ehbActive,
    toggleEHB,
    cycleRanges,
    setCycleRanges,
    cycleSpeed,
    setCycleSpeed,
    colorCycleActive,
    toggleColorCycle,
    paletteLocked,
    toggleLockPalette,
    colorMaskActive,
    toggleColorMask,
    expandPaletteFromImage,
    cycleStep,
    setColorDepth24,
    paletteCount,
    activePaletteIndex,
    addPalette,
    removePalette,
    nextPalette,
    prevPalette,
    brushDither,
    toggleBrushDither,
    brushInvert,
    toggleBrushInvert,
    applyPalettePreset,
  } = useEditor();

  const btn = (
    testid: string,
    label: string,
    onClick: () => void,
    opts: { active?: boolean; disabled?: boolean; tip?: string } = {},
  ) => (
    <div
      className={"button" + (opts.active ? " active" : "") + (opts.disabled ? " disabled" : "")}
      role="button"
      aria-pressed={opts.active}
      data-testid={testid}
      data-tip={opts.tip}
      onClick={() => !opts.disabled && onClick()}
    >
      {label}
    </div>
  );

  return (
    <div className="palette" data-testid="palette">
      {/* palette modes */}
      <div className="subpanel flex palettebuttons">
        {btn("palette-reduce", "⤵16", () => reducePaletteTo(16), { tip: "Reduce to 16 colours" })}
        {btn("palette-ehb", "EHB", toggleEHB, {
          active: ehbActive,
          tip: "Toggle Extra-Half-Brite (64 colours)",
        })}
        {btn("palette-lock", paletteLocked ? "🔒" : "🔓", toggleLockPalette, {
          active: paletteLocked,
          tip: "Lock the palette against changes",
        })}
        {btn("palette-colormask", "Stencil", toggleColorMask, {
          active: colorMaskActive,
          tip: "Colour mask: protect background-colour pixels",
        })}
      </div>

      {/* palette operations */}
      <div className="subpanel flex">
        {btn("palette-expand", "Expand", expandPaletteFromImage, { tip: "Add image colours" })}
        {btn("palette-cycle-step", "Step", cycleStep, { tip: "Cycle one step" })}
        {btn("palette-depth-24", "24-bit", setColorDepth24, { tip: "Restore 24-bit colour" })}
        {btn("brush-dither", "Dither", toggleBrushDither, {
          active: brushDither,
          tip: "Brush dither mode",
        })}
        {btn("brush-invert", "Inv", toggleBrushInvert, {
          active: brushInvert,
          tip: "Brush invert mode",
        })}
      </div>

      {/* multi-palette navigation */}
      <div className="subpanel flex palette-multi" data-testid="palette-multi">
        {btn("palette-add-set", "+Pal", addPalette, { tip: "Store current palette" })}
        {btn("palette-remove-set", "−Pal", removePalette, {
          disabled: paletteCount === 0,
          tip: "Remove last stored palette",
        })}
        {btn("palette-prev", "◀", prevPalette, { disabled: paletteCount === 0, tip: "Previous palette" })}
        <span className="value" data-testid="palette-set-indicator">
          {paletteCount === 0 ? "—" : `${activePaletteIndex + 1}/${paletteCount}`}
        </span>
        {btn("palette-next", "▶", nextPalette, { disabled: paletteCount === 0, tip: "Next palette" })}
      </div>

      {/* preset palettes */}
      <div className="subpanel flex palette-presets" data-testid="palette-presets">
        {btn("palette-preset-grayscale", "Gray", () => applyPalettePreset("grayscale"))}
        {btn("palette-preset-cga", "CGA", () => applyPalettePreset("cga"))}
        {btn("palette-preset-ega", "EGA", () => applyPalettePreset("ega"))}
        {btn("palette-preset-gameboy", "GB", () => applyPalettePreset("gameboy"))}
      </div>

      {/* colour cycling */}
      <div className="subpanel flex color-cycle" data-testid="color-cycle">
        {btn("cycle-toggle", "Cycle", toggleColorCycle, { active: colorCycleActive })}
        <label className="cycle-range">
          lo
          <input
            type="number"
            min={0}
            max={doc.palette.length - 1}
            data-testid="cycle-low"
            value={cycleRanges[0]?.low ?? 0}
            onChange={(e) =>
              setCycleRanges([
                { low: Number(e.target.value), high: cycleRanges[0]?.high ?? doc.palette.length - 1 },
              ])
            }
          />
        </label>
        <label className="cycle-range">
          hi
          <input
            type="number"
            min={0}
            max={doc.palette.length - 1}
            data-testid="cycle-high"
            value={cycleRanges[0]?.high ?? doc.palette.length - 1}
            onChange={(e) =>
              setCycleRanges([{ low: cycleRanges[0]?.low ?? 0, high: Number(e.target.value) }])
            }
          />
        </label>
        <label className="cycle-range">
          ms
          <input
            type="number"
            min={20}
            max={2000}
            step={20}
            data-testid="cycle-speed"
            value={cycleSpeed}
            onChange={(e) => setCycleSpeed(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
