import { useEditor } from "../state/EditorContext";
import { TOOLS } from "../model/tools";

/** Tool selector column. */
export function Toolbar() {
  const { tool, setTool } = useEditor();
  return (
    <div className="toolbar" role="toolbar" aria-label="Tools" data-testid="toolbar">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={"tool-button" + (tool === t.id ? " active" : "")}
          aria-pressed={tool === t.id}
          aria-label={t.label}
          title={`${t.label} (${t.shortcut.toUpperCase()}) — ${t.hint}`}
          data-testid={`tool-${t.id}`}
          onClick={() => setTool(t.id)}
        >
          <span aria-hidden="true">{t.glyph}</span>
        </button>
      ))}
    </div>
  );
}
