import { useEffect } from "react";
import { COMMAND } from "@dpaint/runtime";
import { useEditor } from "../state/EditorContext";

/** Global keyboard shortcuts: tool selection plus a couple of bus commands. */
export function useKeyboardShortcuts() {
  const { bus } = useEditor();
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
        if (e.shiftKey && key === "a") {
          e.preventDefault();
          bus.trigger(COMMAND.LAYERMASK);
        } else if (e.shiftKey && key === "f") {
          e.preventDefault();
          bus.trigger(COMMAND.FLATTEN);
        } else if (e.shiftKey && key === "h") {
          e.preventDefault();
          bus.trigger(COMMAND.LAYERMASKHIDE);
        } else if (e.shiftKey && key === "i") {
          e.preventDefault();
          bus.trigger(COMMAND.INVERTSELECTION);
        } else if (e.shiftKey && key === "l") {
          e.preventDefault();
          bus.trigger(COMMAND.TOSELECTION);
        } else if (e.shiftKey && key === "r") {
          e.preventDefault();
          bus.trigger(COMMAND.TOGGLERULERS);
        } else if (key === "a") {
          e.preventDefault();
          bus.trigger(COMMAND.SELECTALL);
        } else if (key === "b") {
          e.preventDefault();
          bus.trigger(COMMAND.STAMP);
        } else if (key === "c") {
          e.preventDefault();
          bus.trigger(COMMAND.COPY);
        } else if (key === "d") {
          e.preventDefault();
          bus.trigger(COMMAND.DUPLICATELAYER);
        } else if (key === "e") {
          e.preventDefault();
          bus.trigger(COMMAND.EFFECTS);
        } else if (key === "g") {
          e.preventDefault();
          bus.trigger(COMMAND.TOGGLEGRID);
        } else if (key === "i") {
          e.preventDefault();
          bus.trigger(COMMAND.IMPORTLAYER);
        } else if (key === "j") {
          e.preventDefault();
          bus.trigger(COMMAND.TOLAYER);
        } else if (key === "k") {
          e.preventDefault();
          bus.trigger(COMMAND.CUTTOLAYER);
        } else if (key === "n") {
          e.preventDefault();
          bus.trigger(COMMAND.NEW);
        } else if (key === "o") {
          e.preventDefault();
          bus.trigger(COMMAND.OPEN);
        } else if (key === "p") {
          e.preventDefault();
          bus.trigger(COMMAND.RESIZE);
        } else if (key === "r") {
          e.preventDefault();
          bus.trigger(COMMAND.RESAMPLE);
        } else if (key === "s") {
          e.preventDefault();
          bus.trigger(COMMAND.SAVE);
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

      if (key === "a") {
        bus.trigger(COMMAND.ARC);
      } else if (key === "b") {
        bus.trigger(COMMAND.DRAW);
      } else if (key === "c") {
        bus.trigger(COMMAND.CIRCLE);
      } else if (key === "d") {
        bus.trigger(COMMAND.TOGGLEDITHER);
      } else if (key === "e") {
        bus.trigger(COMMAND.ERASE);
      } else if (key === "f") {
        bus.trigger(COMMAND.FLOOD);
      } else if (key === "g") {
        bus.trigger(COMMAND.GRADIENT);
      } else if (key === "h") {
        bus.trigger(COMMAND.PAN);
      } else if (key === "i") {
        bus.trigger(COMMAND.TOGGLEINVERT);
      } else if (key === "k") {
        bus.trigger(COMMAND.COLORPICKER);
      } else if (key === "l") {
        bus.trigger(COMMAND.LINE);
      } else if (key === "m") {
        bus.trigger(COMMAND.SMUDGE);
      } else if (key === "o") {
        bus.trigger(COMMAND.SPRAY);
      } else if (key === "p") {
        bus.trigger(COMMAND.POLYGONSELECT);
      } else if (key === "r") {
        bus.trigger(COMMAND.SQUARE);
      } else if (key === "s") {
        bus.trigger(COMMAND.SELECT);
      } else if (key === "t" || key === "v") {
        bus.trigger(COMMAND.TRANSFORMLAYER);
      } else if (key === "w") {
        bus.trigger(COMMAND.FLOODSELECT);
      } else if (key === "x") {
        bus.trigger(COMMAND.SWAPCOLORS);
      } else if (key === "z") {
        bus.trigger(COMMAND.SPLITSCREEN);
      } else if (key === "+" || key === "=") {
        bus.trigger(COMMAND.ZOOMIN);
      } else if (key === "-") {
        bus.trigger(COMMAND.ZOOMOUT);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [bus]);
}
