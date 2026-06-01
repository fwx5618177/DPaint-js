import { useEffect } from "react";
import { COMMAND } from "@dpaint/core";
import { useEditor } from "../state/EditorContext";
import { TOOL_BY_SHORTCUT } from "../model/tools";

/** Global keyboard shortcuts: tool selection plus a couple of bus commands. */
export function useKeyboardShortcuts() {
  const { setTool, bus, swapColors } = useEditor();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const key = e.key.toLowerCase();

      // Undo / redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y)
      if ((e.ctrlKey || e.metaKey) && key === "z") {
        e.preventDefault();
        bus.trigger(e.shiftKey ? COMMAND.REDO : COMMAND.UNDO);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === "y") {
        e.preventDefault();
        bus.trigger(COMMAND.REDO);
        return;
      }
      // Selection / clipboard
      if (e.ctrlKey || e.metaKey) {
        if (key === "a") {
          e.preventDefault();
          bus.trigger(COMMAND.SELECTALL);
        } else if (key === "c") {
          e.preventDefault();
          bus.trigger(COMMAND.COPY);
        } else if (key === "x") {
          e.preventDefault();
          bus.trigger(COMMAND.CUTTOLAYER);
        } else if (key === "v") {
          e.preventDefault();
          bus.trigger(COMMAND.PASTE);
        }
        return;
      }
      if (key === "escape") {
        bus.trigger(COMMAND.CLEARSELECTION);
        return;
      }

      const toolId = TOOL_BY_SHORTCUT[key];
      if (toolId) {
        setTool(toolId);
        return;
      }
      if (key === "x") {
        swapColors();
      } else if (key === "+" || key === "=") {
        bus.trigger(COMMAND.ZOOMIN);
      } else if (key === "-") {
        bus.trigger(COMMAND.ZOOMOUT);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setTool, bus, swapColors]);
}
