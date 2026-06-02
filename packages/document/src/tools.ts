export type ToolId =
  | "select"
  | "wandselect"
  | "polygonselect"
  | "pencil"
  | "eraser"
  | "line"
  | "rect"
  | "fillrect"
  | "ellipse"
  | "fillellipse"
  | "arc"
  | "fill"
  | "gradient"
  | "spray"
  | "smudge"
  | "text"
  | "picker"
  | "brush"
  | "layerpick"
  | "pan";

export interface ToolDef {
  id: ToolId;
  label: string;
  /** glyph shown in the toolbar button */
  glyph: string;
  /** keyboard shortcut (single key) */
  shortcut: string;
  hint: string;
}

export const TOOLS: ToolDef[] = [
  { id: "select", label: "Select", glyph: "▱", shortcut: "s", hint: "Rectangular selection" },
  { id: "wandselect", label: "Magic wand", glyph: "🪄", shortcut: "w", hint: "Contiguous colour selection" },
  { id: "polygonselect", label: "Lasso", glyph: "✒️", shortcut: "q", hint: "Polygon selection (double-click to close)" },
  { id: "pencil", label: "Pencil", glyph: "✏️", shortcut: "p", hint: "Freehand draw" },
  { id: "eraser", label: "Eraser", glyph: "🧽", shortcut: "d", hint: "Erase to transparent" },
  { id: "line", label: "Line", glyph: "📏", shortcut: "l", hint: "Straight line" },
  { id: "rect", label: "Rectangle", glyph: "▭", shortcut: "r", hint: "Rectangle outline" },
  { id: "fillrect", label: "Filled box", glyph: "▬", shortcut: "b", hint: "Filled rectangle" },
  { id: "ellipse", label: "Ellipse", glyph: "◯", shortcut: "e", hint: "Ellipse outline" },
  { id: "fillellipse", label: "Filled ellipse", glyph: "⬤", shortcut: "o", hint: "Filled ellipse" },
  { id: "arc", label: "Arc", glyph: "🌙", shortcut: "c", hint: "Quadratic arc (3 points)" },
  { id: "fill", label: "Fill", glyph: "🪣", shortcut: "f", hint: "Flood fill" },
  { id: "gradient", label: "Gradient", glyph: "🌈", shortcut: "g", hint: "Linear gradient (fore→back)" },
  { id: "spray", label: "Airbrush", glyph: "💨", shortcut: "a", hint: "Spray / airbrush" },
  { id: "smudge", label: "Smudge", glyph: "👆", shortcut: "m", hint: "Smudge colours" },
  { id: "text", label: "Text", glyph: "🅰", shortcut: "t", hint: "Place text" },
  { id: "picker", label: "Picker", glyph: "💧", shortcut: "k", hint: "Pick colour" },
  { id: "brush", label: "Brush", glyph: "🖌", shortcut: "j", hint: "Stamp the custom brush" },
  { id: "layerpick", label: "Pick layer", glyph: "🗇", shortcut: "y", hint: "Select the layer under the cursor" },
  { id: "pan", label: "Pan", glyph: "✋", shortcut: "h", hint: "Pan the view" },
];

export const TOOLS_BY_ID: Record<ToolId, ToolDef> = Object.fromEntries(
  TOOLS.map((t) => [t.id, t]),
) as Record<ToolId, ToolDef>;

export const TOOL_BY_SHORTCUT: Record<string, ToolId> = Object.fromEntries(
  TOOLS.map((t) => [t.shortcut, t.id]),
);
