import { useRef } from "react";
import { COMMAND } from "@dpaint/runtime";
import { useEditor } from "../state/EditorContext";

/** Top menu bar wired to the legacy COMMAND event bus. */
export function MenuBar() {
  const {
    bus,
    newImage,
    scale,
    resampleScale,
    rotate,
    matteImage,
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
    loadADF,
    paletteFromImage,
    ditherImage,
    posterizeImage,
    thresholdImage,
    blurImage,
    reduceToDepth,
    offsetImage,
    medianSmooth,
    sharpenImage,
    applyArtistic,
    colorCycleActive,
    toggleColorCycle,
    hasClipboard,
    copySelection,
    cutSelection,
    paste,
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
      if (name.endsWith(".adf")) {
        await loadADF(new Uint8Array(await file.arrayBuffer()));
        return;
      }
      const isImage =
        name.endsWith(".png") ||
        name.endsWith(".gif") ||
        name.endsWith(".iff") ||
        name.endsWith(".ilbm") ||
        name.endsWith(".lbm") ||
        name.endsWith(".psd") ||
        name.endsWith(".pi1") ||
        name.endsWith(".pi2") ||
        name.endsWith(".pi3") ||
        name.endsWith(".neo") ||
        name.endsWith(".ase") ||
        name.endsWith(".aseprite") ||
        name.endsWith(".info") ||
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
        accept=".json,application/json,.png,image/png,.gif,image/gif,.iff,.ilbm,.lbm,.psd,.pi1,.pi2,.pi3,.neo,.ase,.aseprite,.info,.adf"
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
      <button type="button" data-testid="menu-copy" onClick={copySelection}>
        Copy
      </button>
      <button type="button" data-testid="menu-cut" onClick={cutSelection}>
        Cut
      </button>
      <button type="button" data-testid="menu-paste" disabled={!hasClipboard} onClick={paste}>
        Paste
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
        data-testid="menu-depth-12"
        title="Limit to Amiga 12-bit colour"
        onClick={() => reduceToDepth(4)}
      >
        12-bit
      </button>
      <button
        type="button"
        data-testid="menu-depth-9"
        title="Limit to Atari ST 9-bit colour"
        onClick={() => reduceToDepth(3)}
      >
        9-bit
      </button>
      <button type="button" data-testid="menu-offset" onClick={offsetImage}>
        Offset
      </button>
      <button type="button" data-testid="menu-smooth" onClick={medianSmooth}>
        Smooth
      </button>
      <button type="button" data-testid="menu-sharpen" onClick={sharpenImage}>
        Sharpen
      </button>
      {(["displace", "glow", "dots", "speckles", "lines", "web", "ripples"] as const).map((fx) => (
        <button
          key={fx}
          type="button"
          data-testid={`menu-fx-${fx}`}
          title={`Apply ${fx} filter`}
          onClick={() => applyArtistic(fx)}
        >
          {fx[0]!.toUpperCase() + fx.slice(1)}
        </button>
      ))}
      <span className="menu-sep" aria-hidden="true" />
      <button
        type="button"
        data-testid="menu-scale-up"
        title="Double the image size"
        onClick={() => scale(2)}
      >
        2×
      </button>
      <button
        type="button"
        data-testid="menu-scale-down"
        title="Halve the image size"
        onClick={() => scale(0.5)}
      >
        ½×
      </button>
      <button
        type="button"
        data-testid="menu-resample-down"
        title="Halve the image size with smooth resampling"
        onClick={() => resampleScale(0.5)}
      >
        ½ smooth
      </button>
      <button
        type="button"
        data-testid="menu-rotate-left"
        title="Rotate 90° counter-clockwise"
        onClick={() => rotate(true)}
      >
        ⟲
      </button>
      <button
        type="button"
        data-testid="menu-rotate-right"
        title="Rotate 90° clockwise"
        onClick={() => rotate(false)}
      >
        ⟳
      </button>
      <button type="button" data-testid="menu-matte" title="Defringe transparent edges" onClick={matteImage}>
        Matte
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
        data-testid="menu-cycle"
        className={colorCycleActive ? "active" : ""}
        aria-pressed={colorCycleActive}
        title="Toggle colour-cycling animation"
        onClick={toggleColorCycle}
      >
        Cycle
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
