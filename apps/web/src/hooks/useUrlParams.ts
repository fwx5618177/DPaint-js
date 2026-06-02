import { useEffect, useRef } from "react";
import { useEditor } from "../state/EditorContext";

/**
 * Honour the legacy URL parameters on first load:
 *   ?file=<url>   open an image from a URL
 *   &zoom         zoom-to-fit after loading
 *   &play         start palette colour cycling
 *   &palette      regenerate the palette from the image
 *   ?gallery      open the artwork gallery
 */
export function useUrlParams() {
  const { openImageUrl, zoomFit, toggleColorCycle, paletteFromImage, toggleGallery } = useEditor();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);

    const file = params.get("file");
    if (file) {
      void openImageUrl(file).then((ok) => {
        if (!ok) return;
        if (params.has("zoom")) zoomFit();
        if (params.has("palette")) paletteFromImage();
        if (params.has("play")) toggleColorCycle();
      });
      return;
    }

    if (params.has("gallery")) toggleGallery();
  }, [openImageUrl, zoomFit, toggleColorCycle, paletteFromImage, toggleGallery]);
}
