import { useRef } from "react";
import { COMMAND } from "@dpaint/core";
import { useEditor } from "../state/EditorContext";

/** Top menu bar wired to the legacy COMMAND event bus. */
export function MenuBar() {
  const {
    bus,
    newImage,
    zoom,
    setZoom,
    canUndo,
    canRedo,
    serialize,
    loadProject,
    exportPNG,
    exportGIF,
    exportILBM,
    loadImageBytes,
    paletteFromImage,
    ditherImage,
    posterizeImage,
    thresholdImage,
    blurImage,
    invert,
    grayscale,
  } = useEditor();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const download = (bytes: BlobPart, filename: string, mime: string) => {
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = () => download(serialize(), "untitled.dpaint.json", "application/json");

  const handleExportPNG = async () => {
    const png = await exportPNG();
    download(png as unknown as BlobPart, "untitled.png", "image/png");
  };

  const handleExportGIF = () => {
    download(exportGIF() as unknown as BlobPart, "untitled.gif", "image/gif");
  };

  const handleExportILBM = () => {
    download(exportILBM() as unknown as BlobPart, "untitled.iff", "image/x-ilbm");
  };

  const handleLoadFile = async (file: File) => {
    try {
      const name = file.name.toLowerCase();
      const isImage =
        name.endsWith(".png") ||
        name.endsWith(".gif") ||
        name.endsWith(".iff") ||
        name.endsWith(".ilbm") ||
        name.endsWith(".lbm") ||
        file.type === "image/png" ||
        file.type === "image/gif";
      if (isImage) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        await loadImageBytes(bytes, file.name);
      } else {
        loadProject(await file.text());
      }
    } catch (err) {
      console.error("Failed to load file", err);
    }
  };

  return (
    <div className="menubar" role="menubar" data-testid="menubar">
      <span className="brand">DPaint.js</span>
      <button type="button" data-testid="menu-new" onClick={() => newImage(64, 48)}>
        New
      </button>
      <button type="button" data-testid="menu-save" onClick={handleSave}>
        Save
      </button>
      <button type="button" data-testid="menu-export-png" onClick={() => void handleExportPNG()}>
        PNG
      </button>
      <button type="button" data-testid="menu-export-gif" onClick={handleExportGIF}>
        GIF
      </button>
      <button type="button" data-testid="menu-export-iff" onClick={handleExportILBM}>
        IFF
      </button>
      <button
        type="button"
        data-testid="menu-load"
        onClick={() => fileInputRef.current?.click()}
      >
        Load
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json,.png,image/png,.gif,image/gif,.iff,.ilbm,.lbm"
        data-testid="file-input"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleLoadFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        data-testid="menu-clear"
        onClick={() => bus.trigger(COMMAND.CLEAR)}
      >
        Clear
      </button>
      <button
        type="button"
        data-testid="menu-newlayer"
        onClick={() => bus.trigger(COMMAND.NEWLAYER)}
      >
        Add layer
      </button>
      <button
        type="button"
        data-testid="menu-undo"
        disabled={!canUndo}
        onClick={() => bus.trigger(COMMAND.UNDO)}
      >
        Undo
      </button>
      <button
        type="button"
        data-testid="menu-redo"
        disabled={!canRedo}
        onClick={() => bus.trigger(COMMAND.REDO)}
      >
        Redo
      </button>
      <span className="menu-sep" aria-hidden="true" />
      <button
        type="button"
        data-testid="menu-fliph"
        title="Flip horizontal"
        onClick={() => bus.trigger(COMMAND.FLIPHORIZONTAL)}
      >
        Flip H
      </button>
      <button
        type="button"
        data-testid="menu-flipv"
        title="Flip vertical"
        onClick={() => bus.trigger(COMMAND.FLIPVERTICAL)}
      >
        Flip V
      </button>
      <button type="button" data-testid="menu-invert" onClick={invert}>
        Invert
      </button>
      <button type="button" data-testid="menu-grayscale" onClick={grayscale}>
        Greyscale
      </button>
      <button type="button" data-testid="menu-posterize" onClick={posterizeImage}>
        Posterise
      </button>
      <button type="button" data-testid="menu-threshold" onClick={thresholdImage}>
        Threshold
      </button>
      <button type="button" data-testid="menu-blur" onClick={blurImage}>
        Blur
      </button>
      <button
        type="button"
        data-testid="menu-palette-from-image"
        title="Build the palette from the image"
        onClick={paletteFromImage}
      >
        Palette
      </button>
      <button
        type="button"
        data-testid="menu-dither"
        title="Dither the layer to the palette (Floyd–Steinberg)"
        onClick={ditherImage}
      >
        Dither
      </button>
      <span className="spacer" />
      <button
        type="button"
        data-testid="menu-zoomout"
        aria-label="Zoom out"
        onClick={() => bus.trigger(COMMAND.ZOOMOUT)}
      >
        −
      </button>
      <span className="zoom-label" data-testid="zoom-label">
        {zoom}×
      </span>
      <button
        type="button"
        data-testid="menu-zoomin"
        aria-label="Zoom in"
        onClick={() => bus.trigger(COMMAND.ZOOMIN)}
      >
        +
      </button>
      <button type="button" data-testid="menu-zoomreset" onClick={() => setZoom(8)}>
        Reset
      </button>
    </div>
  );
}
