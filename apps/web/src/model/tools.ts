export type ToolId =
  | "select"
  | "pencil"
  | "line"
  | "rect"
  | "fillrect"
  | "ellipse"
  | "fillellipse"
  | "fill"
  | "gradient"
  | "picker";

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
  { id: "pencil", label: "Pencil", glyph: "✏️", shortcut: "p", hint: "Freehand draw" },
  { id: "line", label: "Line", glyph: "📏", shortcut: "l", hint: "Straight line" },
  { id: "rect", label: "Rectangle", glyph: "▭", shortcut: "r", hint: "Rectangle outline" },
  { id: "fillrect", label: "Filled box", glyph: "▬", shortcut: "b", hint: "Filled rectangle" },
  { id: "ellipse", label: "Ellipse", glyph: "◯", shortcut: "e", hint: "Ellipse outline" },
  { id: "fillellipse", label: "Filled ellipse", glyph: "⬤", shortcut: "o", hint: "Filled ellipse" },
  { id: "fill", label: "Fill", glyph: "🪣", shortcut: "f", hint: "Flood fill" },
  { id: "gradient", label: "Gradient", glyph: "🌈", shortcut: "g", hint: "Linear gradient (fore→back)" },
  { id: "picker", label: "Picker", glyph: "💧", shortcut: "k", hint: "Pick colour" },
];

export const TOOLS_BY_ID: Record<ToolId, ToolDef> = Object.fromEntries(
  TOOLS.map((t) => [t.id, t]),
) as Record<ToolId, ToolDef>;

export const TOOL_BY_SHORTCUT: Record<string, ToolId> = Object.fromEntries(
  TOOLS.map((t) => [t.shortcut, t.id]),
);
