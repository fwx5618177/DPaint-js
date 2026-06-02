import { useEffect } from "react";
import { useEditor } from "../state/EditorContext";

/**
 * Amiga "Deluxe" preview, ported from the legacy UAE component. The emulator
 * itself ships as a separate deployed asset (`uae/index.html`); this provides
 * the integration glue — an embedded iframe plus `window.getUaeContent`, which
 * hands the emulator an ADF disk containing the current picture as IFF.
 */
export function UaePreview() {
  const { uaeOpen, toggleUae, saveToADF } = useEditor();

  useEffect(() => {
    if (!uaeOpen) return;
    // The emulator calls this to fetch the boot disk with our picture baked in.
    (window as unknown as { getUaeContent?: () => Promise<ArrayBuffer> }).getUaeContent = () =>
      Promise.resolve(saveToADF().buffer as ArrayBuffer);
    return () => {
      delete (window as unknown as { getUaeContent?: unknown }).getUaeContent;
    };
  }, [uaeOpen, saveToADF]);

  if (!uaeOpen) return null;
  return (
    <div className="uae" data-testid="uae-preview">
      <div className="caption handle">
        Amiga Preview
        <button type="button" className="close" data-testid="uae-close" data-tip="Close Amiga Preview" onClick={toggleUae}>
          x
        </button>
      </div>
      <iframe className="uae-frame" data-testid="uae-frame" data-tip="Amiga UAE preview" src="uae/index.html" />
    </div>
  );
}
