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
