import { useEffect } from "react";
import { useEditor } from "../state/EditorContext";
import { attachHostBridge } from "../state/host";

/** Wire the postMessage host bridge when the app is embedded in an iframe. */
export function useHostBridge() {
  const { loadImageBytes, exportPNG, newImage } = useEditor();
  useEffect(() => {
    return attachHostBridge({ loadImageBytes, exportPNG, newImage });
  }, [loadImageBytes, exportPNG, newImage]);
}
