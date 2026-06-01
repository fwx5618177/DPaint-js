import { TOOLS_BY_ID } from "@dpaint/document";
import { useEditor } from "../state/EditorContext";

/** Bottom status bar: dimensions, layer count, active tool and colour usage. */
export function StatusBar() {
  const { doc, tool, version } = useEditor();
  // version is referenced so the colour count refreshes after edits
  void version;
  return (
    <div className="statusbar" data-testid="statusbar">
      <span data-testid="status-size">
        {doc.width}×{doc.height}
      </span>
      <span data-testid="status-layers">{doc.layers.length} layer(s)</span>
      <span data-testid="status-tool">{TOOLS_BY_ID[tool].label}</span>
      <span data-testid="status-colors">{doc.colorCount()} colours</span>
    </div>
  );
}
