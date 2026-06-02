import { COMMAND } from "@dpaint/runtime";
import { Color } from "@dpaint/primitives";
import type { ToolId } from "@dpaint/document";
import { useState } from "react";
import { useEditor } from "../state/EditorContext";
import { ToolbarPalette } from "./ToolbarPalette";

interface ToolDef {
  cls: string; // legacy icon class (maps to a background-image in _toolbar.scss)
  tool: ToolId;
  cmd: number;
  info: string;
}

/**
 * Tool buttons in the legacy toolbar order (toolbar.js / _toolbar.scss). The
 * order matches the original: draw/select/shape/paint tools, then split, pan,
 * picker, zoom, undo/redo.
 */
const TOOLS: ToolDef[] = [
  { cls: "pencil", tool: "pencil", cmd: COMMAND.DRAW, info: "B — Pencil" },
  { cls: "select", tool: "select", cmd: COMMAND.SELECT, info: "S — Rectangular select" },
  { cls: "polygonselect", tool: "polygonselect", cmd: COMMAND.POLYGONSELECT, info: "P — Polygon select" },
  { cls: "floodselect", tool: "wandselect", cmd: COMMAND.FLOODSELECT, info: "W — Magic wand" },
  { cls: "circle", tool: "ellipse", cmd: COMMAND.CIRCLE, info: "C — Ellipse" },
  { cls: "square", tool: "rect", cmd: COMMAND.SQUARE, info: "R — Rectangle" },
  { cls: "line", tool: "line", cmd: COMMAND.LINE, info: "L — Line" },
  { cls: "curve", tool: "arc", cmd: COMMAND.ARC, info: "A — Arc" },
  { cls: "gradient", tool: "gradient", cmd: COMMAND.GRADIENT, info: "G — Gradient" },
  { cls: "flood", tool: "fill", cmd: COMMAND.FLOOD, info: "F — Fill" },
  { cls: "spray", tool: "spray", cmd: COMMAND.SPRAY, info: "O — Spray brush" },
  { cls: "smudge", tool: "smudge", cmd: COMMAND.SMUDGE, info: "M — Smudge" },
  { cls: "erase", tool: "eraser", cmd: COMMAND.ERASE, info: "E — Erase" },
  { cls: "split", tool: "split" as ToolId, cmd: COMMAND.SPLITSCREEN, info: "N — Split screen" },
  { cls: "pan", tool: "pan", cmd: COMMAND.PAN, info: "H — Pan" },
  { cls: "picker", tool: "picker", cmd: COMMAND.COLORPICKER, info: "K — Pick colour" },
];

/** Left icon toolbar, ported from the legacy `.toolbar > .tools` DOM. */
export function Toolbar() {
  const [paletteToolsVisible, setPaletteToolsVisible] = useState(false);
  const {
    tool,
    setTool,
    bus,
    color,
    bgColor,
    setColor,
    swapColors,
    splitScreen,
    canUndo,
    canRedo,
    sidePanelVisible,
    toggleSidePanel,
    paletteLocked,
    colorCycleActive,
  } = useEditor();

  return (
    <div className="toolbar" data-testid="toolbar">
      <div className="tools">
        <div
          className={`togglepanel sidebar handle info${sidePanelVisible ? " active" : ""}`}
          data-tip="Toggle side panel"
          role="button"
          aria-pressed={sidePanelVisible}
          onClick={toggleSidePanel}
        />
        {/* current brush / brush picker (legacy `.brushes`) */}
        <div
          className={`brushes info${tool === "brush" ? " active" : ""}`}
          data-testid="tool-brush"
          role="button"
          aria-pressed={tool === "brush"}
          data-tip="Brush — click to stamp the custom brush"
          onClick={() => setTool("brush")}
        >
          {Array.from({ length: 10 }, (_, i) => (
            <span
              key={i}
              className={"brush handle" + (i === 0 ? " active" : "")}
              style={{ backgroundPosition: `${-(i % 5) * 11}px ${Math.floor(i / 5) * -11}px` }}
            />
          ))}
        </div>

        {TOOLS.map((t) => {
          const isSplit = t.cls === "split";
          const active = isSplit ? splitScreen : tool === t.tool;
          return (
            <div
              key={t.cls}
              className={`button handle info icon ${t.cls}${active ? " active" : ""}`}
              data-testid={`tool-${t.tool}`}
              role="button"
              aria-pressed={active}
              data-tip={t.info}
              onClick={() => bus.trigger(t.cmd)}
            />
          );
        })}

        <div
          className="button handle info icon zoom"
          data-testid="menu-zoomin"
          role="button"
          data-tip="+ — Zoom in"
          onClick={() => bus.trigger(COMMAND.ZOOMIN)}
        />
        <div
          className="button handle info icon zoomout"
          data-testid="menu-zoomout"
          role="button"
          data-tip="- — Zoom out"
          onClick={() => bus.trigger(COMMAND.ZOOMOUT)}
        />
        <div
          className={`button handle info icon undo${canUndo ? "" : " disabled"}`}
          data-testid="menu-undo"
          role="button"
          data-tip="Ctrl+Z — Undo"
          onClick={() => bus.trigger(COMMAND.UNDO)}
        />
        <div
          className={`button handle info icon redo${canRedo ? "" : " disabled"}`}
          data-testid="menu-redo"
          role="button"
          data-tip="Ctrl+Y — Redo"
          onClick={() => bus.trigger(COMMAND.REDO)}
        />

        {/* foreground/background colour display + swap + transparent (legacy
            `.toolbar .palette .display`) */}
        <div className="palette">
          <div className="display">
            <div
              className="back info"
              data-testid="swatch-background"
              data-tip="Right click drawing color"
              style={{ background: Color.toString(bgColor) }}
            />
            <div
              className="front info"
              data-testid="swatch-foreground"
              data-tip="Left click drawing color"
              style={{ background: Color.toString(color) }}
            />
            <div
              className="button swapcolors info"
              data-testid="swap-colors"
              data-tip="X — Swap foreground and background color"
              role="button"
              onClick={swapColors}
            />
            <div
              className="button transparentcolors info"
              data-testid="transparent-color"
              data-tip="Select the transparent color"
              role="button"
              onClick={() => setColor([0, 0, 0, 0] as unknown as typeof color)}
            />
          </div>
        </div>
      </div>

      {/* palette tool buttons (legacy `.palettebuttons`): edit / cycle / lock / presets */}
      <div
        className={`togglepanel showpalettetools info${paletteToolsVisible ? " active" : ""}`}
        data-tip="Show palette tools"
        role="button"
        onClick={() => setPaletteToolsVisible((visible) => !visible)}
      >
        Palette
      </div>
      <div className={`palettebuttons${paletteToolsVisible ? "" : " hidden"}`}>
        <div
          className="button edit handle info"
          data-testid="palette-edit"
          data-tip="Edit palette"
          role="button"
          onClick={() => bus.trigger(COMMAND.EDITPALETTE)}
        >
          <span className="icon" />
        </div>
        <div
          className={`button cycle handle info${colorCycleActive ? " active" : ""}`}
          data-testid="palette-cycle"
          data-tip="Tab — Toggle colour cycling"
          role="button"
          aria-pressed={colorCycleActive}
          onClick={() => bus.trigger(COMMAND.CYCLEPALETTE)}
        >
          <span className="icon" />
        </div>
        <div
          className={`button lock handle info${paletteLocked ? " active" : ""}`}
          data-testid="palette-lock-toolbar"
          data-tip="Lock palette"
          role="button"
          aria-pressed={paletteLocked}
          onClick={() => bus.trigger(COMMAND.LOCKPALETTE)}
        >
          <span className="icon" />
        </div>
        <div
          className="button hamburger handle info"
          data-testid="palette-presets-toggle"
          data-tip="Show palette presets"
          role="button"
          onClick={() => bus.trigger(COMMAND.TOGGLEPALETTES)}
        >
          <span className="icon" />
        </div>
      </div>

      <ToolbarPalette />
    </div>
  );
}
