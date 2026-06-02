import { COMMAND } from "@dpaint/runtime";
import { useEditor } from "../state/EditorContext";

interface MenuItem {
  label: string;
  command: number;
}

const ITEMS: MenuItem[] = [
  { label: "Cut", command: COMMAND.CUTTOLAYER },
  { label: "Copy", command: COMMAND.COPY },
  { label: "Paste", command: COMMAND.PASTE },
  { label: "Select all", command: COMMAND.SELECTALL },
  { label: "Deselect", command: COMMAND.CLEARSELECTION },
  { label: "Invert selection", command: COMMAND.INVERTSELECTION },
  { label: "Crop", command: COMMAND.CROP },
  { label: "Undo", command: COMMAND.UNDO },
  { label: "Redo", command: COMMAND.REDO },
];

/** Right-click context menu over the canvas, ported from the legacy ContextMenu. */
export function ContextMenu() {
  const { contextMenu, hideContextMenu, bus } = useEditor();
  if (!contextMenu) return null;
  return (
    <>
      <div className="contextmenu-backdrop" data-testid="contextmenu-backdrop" onClick={hideContextMenu} />
      <ul
        className="contextmenu active"
        data-testid="context-menu"
        style={{ left: contextMenu.x, top: contextMenu.y }}
      >
        {ITEMS.map((item) => (
          <li key={item.label}>
            <button
              type="button"
              className="contextmenuitem"
              data-testid={`context-${item.label.replace(/\s+/g, "-").toLowerCase()}`}
              onClick={() => {
                bus.trigger(item.command);
                hideContextMenu();
              }}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
