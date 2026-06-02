import { useRef } from "react";
import { COMMAND } from "@dpaint/runtime";
import { encodePNG, decodePNG } from "@dpaint/codecs";
import { useEditor } from "../state/EditorContext";

/** Top menu bar wired to the legacy COMMAND event bus. */
export function MenuBar() {
  const {
    bus,
    doc,
    newImage,
    resize,
    scale,
    resampleScale,
    crop,
    trim,
    imageInfo,
    transformSelection,
    rotate,
    rotateFree,
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
    exportHAM,
    exportSHAM,
    exportPSD,
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
    restoreAutosave,
    recording,
    recordedFrameCount,
    toggleRecording,
    exportRecording,
    showGrid,
    toggleGrid,
    showRulers,
    toggleRulers,
    showBitplanes,
    toggleBitplanes,
    zoomFit,
    galleryOpen,
    toggleGallery,
    invertSelection,
    selectByColor,
    selectAlpha,
    selectNotInPalette,
    layerToSelection,
    hasBrush,
    captureBrush,
    rotateBrush,
    flipBrush,
    getBrush,
    setBrushRegion,
    loadPalette,
    savePaletteACT,
    exportPaletteImage,
    importLayer,
    saveToADF,
    togglePresentation,
    toggleSidePanel,
    toggleSplitScreen,
    toggleFullscreen,
    splitScreen,
    showAbout,
    showPreferences,
    toggleUae,
  } = useEditor();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const brushInputRef = useRef<HTMLInputElement>(null);
  const paletteInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

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

  const handleSaveBrush = async () => {
    const brush = getBrush();
    if (!brush) return;
    const png = await encodePNG({ width: brush.width, height: brush.height, data: brush.data });
    download(png as unknown as BlobPart, "brush.png", "image/png");
  };

  const handleLoadBrush = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const img = await decodePNG(bytes);
    setBrushRegion({
      width: img.width,
      height: img.height,
      data: new Uint8ClampedArray(img.data),
    });
  };

  const handleSavePalette = () =>
    download(savePaletteACT() as unknown as BlobPart, "palette.act", "application/octet-stream");

  const handleExportPalette = async () => {
    const png = await exportPaletteImage();
    download(png as unknown as BlobPart, "palette.png", "image/png");
  };

  const handleLoadPalette = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    loadPalette(bytes, file.name);
  };

  const handleImportLayer = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await importLayer(bytes, file.name);
  };

  const handleSaveADF = () =>
    download(saveToADF() as unknown as BlobPart, "disk.adf", "application/octet-stream");

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
        name.endsWith(".pbm") ||
        name.endsWith(".anim") ||
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
        data-testid="menu-export-ham"
        data-tip="Export HAM6 IFF"
        onClick={() => download(exportHAM() as unknown as BlobPart, "untitled.ham.iff", "image/x-ilbm")}
      >
        HAM
      </button>
      <button
        type="button"
        data-testid="menu-export-sham"
        data-tip="Export sliced-HAM IFF"
        onClick={() => download(exportSHAM() as unknown as BlobPart, "untitled.sham.iff", "image/x-ilbm")}
      >
        SHAM
      </button>
      <button
        type="button"
        data-testid="menu-export-psd"
        data-tip="Export PSD"
        onClick={() => download(exportPSD() as unknown as BlobPart, "untitled.psd", "image/vnd.adobe.photoshop")}
      >
        PSD
      </button>
      <button
        type="button"
        data-testid="menu-load"
        onClick={() => fileInputRef.current?.click()}
      >
        Load
      </button>
      <button type="button" data-testid="menu-restore" onClick={() => restoreAutosave()}>
        Restore
      </button>
      <button
        type="button"
        data-testid="menu-record"
        className={recording ? "active" : ""}
        aria-pressed={recording}
        data-tip="Record edits as animation frames"
        onClick={toggleRecording}
      >
        {recording ? `Rec ${recordedFrameCount}` : "Rec"}
      </button>
      <button
        type="button"
        data-testid="menu-export-rec"
        disabled={recordedFrameCount === 0}
        data-tip="Export the recording as an animated GIF"
        onClick={() => {
          const gif = exportRecording();
          if (gif) download(gif as unknown as BlobPart, "recording.gif", "image/gif");
        }}
      >
        Save Rec
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json,.png,image/png,.gif,image/gif,.iff,.ilbm,.lbm,.pbm,.anim,.psd,.pi1,.pi2,.pi3,.neo,.ase,.aseprite,.info,.adf"
        data-testid="file-input"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleLoadFile(file);
          e.target.value = "";
        }}
      />
      <input
        ref={brushInputRef}
        type="file"
        accept=".png,image/png"
        data-testid="brush-input"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleLoadBrush(file);
          e.target.value = "";
        }}
      />
      <input
        ref={paletteInputRef}
        type="file"
        accept=".act,.pal,.gpl"
        data-testid="palette-input"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleLoadPalette(file);
          e.target.value = "";
        }}
      />
      <input
        ref={importInputRef}
        type="file"
        accept=".png,image/png,.gif,image/gif,.iff,.ilbm,.lbm,.pbm,.anim,.psd,.pi1,.pi2,.pi3,.neo,.ase,.aseprite,.info"
        data-testid="import-input"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportLayer(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        data-testid="menu-import-layer"
        data-tip="Import an image as a new layer"
        onClick={() => importInputRef.current?.click()}
      >
        Import
      </button>
      <button
        type="button"
        data-testid="menu-save-adf"
        data-tip="Save the image into an Amiga ADF disk"
        onClick={handleSaveADF}
      >
        Save ADF
      </button>
      <button
        type="button"
        data-testid="menu-load-palette"
        data-tip="Load a palette file (.act / .pal)"
        onClick={() => paletteInputRef.current?.click()}
      >
        Load pal
      </button>
      <button
        type="button"
        data-testid="menu-save-palette"
        data-tip="Save the palette as .act"
        onClick={handleSavePalette}
      >
        Save pal
      </button>
      <button
        type="button"
        data-testid="menu-export-palette"
        data-tip="Export the palette as a PNG swatch"
        onClick={() => void handleExportPalette()}
      >
        Export pal
      </button>
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
        data-tip="Flip horizontal"
        onClick={() => bus.trigger(COMMAND.FLIPHORIZONTAL)}
      >
        Flip H
      </button>
      <button
        type="button"
        data-testid="menu-flipv"
        data-tip="Flip vertical"
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
        data-tip="Limit to Amiga 12-bit colour"
        onClick={() => reduceToDepth(4)}
      >
        12-bit
      </button>
      <button
        type="button"
        data-testid="menu-depth-9"
        data-tip="Limit to Atari ST 9-bit colour"
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
          data-tip={`Apply ${fx} filter`}
          onClick={() => applyArtistic(fx)}
        >
          {fx[0]!.toUpperCase() + fx.slice(1)}
        </button>
      ))}
      <span className="menu-sep" aria-hidden="true" />
      <button
        type="button"
        data-testid="menu-scale-up"
        data-tip="Double the image size"
        onClick={() => scale(2)}
      >
        2×
      </button>
      <button
        type="button"
        data-testid="menu-scale-down"
        data-tip="Halve the image size"
        onClick={() => scale(0.5)}
      >
        ½×
      </button>
      <button
        type="button"
        data-testid="menu-resample-down"
        data-tip="Halve the image size with smooth resampling"
        onClick={() => resampleScale(0.5)}
      >
        ½ smooth
      </button>
      <button
        type="button"
        data-testid="menu-resize"
        data-tip="Resize to specific dimensions"
        onClick={() => {
          const v =
            typeof window !== "undefined"
              ? window.prompt("Resize to WIDTHxHEIGHT:", `${doc.width}x${doc.height}`)
              : null;
          const m = v?.match(/(\d+)\s*[x,×]\s*(\d+)/);
          if (m) resize(Number(m[1]), Number(m[2]));
        }}
      >
        Resize…
      </button>
      <button
        type="button"
        data-testid="menu-crop"
        data-tip="Crop to selection"
        onClick={() => crop()}
      >
        Crop
      </button>
      <button
        type="button"
        data-testid="menu-trim"
        data-tip="Trim transparent margins"
        onClick={() => trim()}
      >
        Trim
      </button>
      <button
        type="button"
        data-testid="menu-info"
        data-tip="Image information"
        onClick={() => {
          if (typeof window !== "undefined") window.alert(imageInfo());
        }}
      >
        Info
      </button>
      <button
        type="button"
        data-testid="menu-transform"
        data-tip="Free transform the selection (scale + rotate)"
        onClick={() => {
          const s =
            typeof window !== "undefined" ? window.prompt("Scale factor:", "1") : null;
          const a =
            typeof window !== "undefined" ? window.prompt("Rotate degrees:", "0") : null;
          const scale = s ? Number(s) : 1;
          const angle = a ? Number(a) : 0;
          if (!Number.isNaN(scale) && !Number.isNaN(angle)) transformSelection(scale || 1, angle || 0);
        }}
      >
        Transform
      </button>
      <button
        type="button"
        data-testid="menu-select-invert"
        data-tip="Invert selection"
        onClick={() => invertSelection()}
      >
        Invert sel
      </button>
      <button
        type="button"
        data-testid="menu-select-color"
        data-tip="Select by foreground colour"
        onClick={() => selectByColor()}
      >
        Sel colour
      </button>
      <button
        type="button"
        data-testid="menu-select-alpha"
        data-tip="Select transparent pixels"
        onClick={() => selectAlpha()}
      >
        Sel alpha
      </button>
      <button
        type="button"
        data-testid="menu-select-notpalette"
        data-tip="Select colours not in the palette"
        onClick={() => selectNotInPalette()}
      >
        Sel ≠pal
      </button>
      <button
        type="button"
        data-testid="menu-select-layer"
        data-tip="Select the layer's opaque pixels"
        onClick={() => layerToSelection()}
      >
        Sel layer
      </button>
      <button
        type="button"
        data-testid="menu-to-layer"
        data-tip="Copy the selection to a new layer"
        onClick={() => bus.trigger(COMMAND.TOLAYER)}
      >
        →Layer
      </button>
      <button
        type="button"
        data-testid="menu-brush-capture"
        data-tip="Capture the selection as a brush"
        onClick={() => captureBrush()}
      >
        Grab brush
      </button>
      <button
        type="button"
        data-testid="menu-brush-rotate"
        data-tip="Rotate the brush 90°"
        disabled={!hasBrush}
        onClick={() => bus.trigger(COMMAND.BRUSHROTATERIGHT)}
      >
        ↻brush
      </button>
      <button
        type="button"
        data-testid="menu-brush-flip"
        data-tip="Flip the brush horizontally"
        disabled={!hasBrush}
        onClick={() => flipBrush(true)}
      >
        ⇆brush
      </button>
      <button
        type="button"
        data-testid="menu-brush-save"
        data-tip="Save the brush as PNG"
        disabled={!hasBrush}
        onClick={() => void handleSaveBrush()}
      >
        Save brush
      </button>
      <button
        type="button"
        data-testid="menu-brush-load"
        data-tip="Load a brush from a PNG"
        onClick={() => brushInputRef.current?.click()}
      >
        Load brush
      </button>
      <button
        type="button"
        data-testid="menu-rotate-left"
        data-tip="Rotate 90° counter-clockwise"
        onClick={() => rotate(true)}
      >
        ⟲
      </button>
      <button
        type="button"
        data-testid="menu-rotate-right"
        data-tip="Rotate 90° clockwise"
        onClick={() => rotate(false)}
      >
        ⟳
      </button>
      <button
        type="button"
        data-testid="menu-rotate-free"
        data-tip="Rotate by an arbitrary angle"
        onClick={() => {
          const v = typeof window !== "undefined" ? window.prompt("Rotate by degrees:", "45") : null;
          const deg = v ? Number(v) : NaN;
          if (!Number.isNaN(deg)) rotateFree(deg);
        }}
      >
        ∠
      </button>
      <button type="button" data-testid="menu-matte" data-tip="Defringe transparent edges" onClick={matteImage}>
        Matte
      </button>
      <button
        type="button"
        data-testid="menu-palette-from-image"
        data-tip="Build the palette from the image"
        onClick={paletteFromImage}
      >
        Palette
      </button>
      <button
        type="button"
        data-testid="menu-cycle"
        className={colorCycleActive ? "active" : ""}
        aria-pressed={colorCycleActive}
        data-tip="Toggle colour-cycling animation"
        onClick={toggleColorCycle}
      >
        Cycle
      </button>
      <button
        type="button"
        data-testid="menu-dither"
        data-tip="Dither the layer to the palette (Floyd–Steinberg)"
        onClick={ditherImage}
      >
        Dither
      </button>
      <button
        type="button"
        data-testid="menu-grid"
        className={showGrid ? "active" : ""}
        aria-pressed={showGrid}
        data-tip="Toggle pixel grid"
        onClick={toggleGrid}
      >
        Grid
      </button>
      <button
        type="button"
        data-testid="menu-rulers"
        className={showRulers ? "active" : ""}
        aria-pressed={showRulers}
        data-tip="Toggle rulers"
        onClick={toggleRulers}
      >
        Rulers
      </button>
      <button
        type="button"
        data-testid="menu-bitplanes"
        className={showBitplanes ? "active" : ""}
        aria-pressed={showBitplanes}
        data-tip="Toggle bit-planes view"
        onClick={toggleBitplanes}
      >
        Planes
      </button>
      <button
        type="button"
        data-testid="menu-gallery"
        className={galleryOpen ? "active" : ""}
        aria-pressed={galleryOpen}
        data-tip="Open the artwork gallery"
        onClick={toggleGallery}
      >
        Gallery
      </button>
      <button
        type="button"
        data-testid="menu-presentation"
        data-tip="Presentation mode"
        onClick={togglePresentation}
      >
        Present
      </button>
      <button
        type="button"
        data-testid="menu-sidepanel"
        data-tip="Toggle side panel"
        onClick={toggleSidePanel}
      >
        Panel
      </button>
      <button
        type="button"
        data-testid="menu-splitscreen"
        className={splitScreen ? "active" : ""}
        aria-pressed={splitScreen}
        data-tip="Split-screen view"
        onClick={toggleSplitScreen}
      >
        Split
      </button>
      <button
        type="button"
        data-testid="menu-fullscreen"
        data-tip="Toggle fullscreen"
        onClick={toggleFullscreen}
      >
        Full
      </button>
      <button
        type="button"
        data-testid="menu-deluxe"
        data-tip="Amiga Deluxe Paint preview"
        onClick={toggleUae}
      >
        Amiga
      </button>
      <button type="button" data-testid="menu-about" data-tip="About" onClick={showAbout}>
        About
      </button>
      <button
        type="button"
        data-testid="menu-preferences"
        data-tip="Preferences"
        onClick={showPreferences}
      >
        Prefs
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
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        data-testid="menu-zoomin"
        aria-label="Zoom in"
        onClick={() => bus.trigger(COMMAND.ZOOMIN)}
      >
        +
      </button>
      <button type="button" data-testid="menu-zoomfit" data-tip="Fit to window" onClick={zoomFit}>
        Fit
      </button>
      <button type="button" data-testid="menu-zoomreset" onClick={() => setZoom(8)}>
        Reset
      </button>
    </div>
  );
}
