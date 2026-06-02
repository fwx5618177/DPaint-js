import { useEffect, useRef, useState } from "react";
import { COMMAND } from "@dpaint/runtime";
import { encodePNG, decodePNG } from "@dpaint/codecs";
import { useEditor } from "../state/EditorContext";

/** A single menu entry. `cmd` dispatches on the event bus; `action` runs a fn. */
interface MenuItem {
  label: string;
  cmd?: number;
  action?: () => void;
  shortkey?: string;
  checked?: boolean;
  info?: string;
  /** Optional stable test id (kept compatible with the pre-redesign tests). */
  testid?: string;
  children?: MenuItem[];
}
interface TopMenu {
  label: string;
  className?: string;
  children: MenuItem[];
}

/**
 * Top dropdown menu, ported from the legacy `.menu` DOM (menu.js + _menu.scss).
 * React uses divs rather than the legacy nested anchors so click events remain
 * valid and are not swallowed by the outside-click closer.
 */
export function Menu() {
  const editor = useEditor();
  const {
    bus,
    newImage,
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
    importLayer,
    savePaletteACT,
    loadPalette,
    exportPaletteImage,
    saveToADF,
    getBrush,
    setBrushRegion,
    matteImage,
    rotate,
    recording,
    toggleRecording,
    exportRecording,
    colorCycleActive,
    showGrid,
    showRulers,
    splitScreen,
    sidePanelVisible,
    galleryOpen,
    presentationMode,
  } = editor;

  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const paletteInputRef = useRef<HTMLInputElement>(null);
  const brushInputRef = useRef<HTMLInputElement>(null);
  const adfInputRef = useRef<HTMLInputElement>(null);

  const download = (bytes: BlobPart, filename: string, mime: string) => {
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadFile = async (file: File) => {
    const name = file.name.toLowerCase();
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (name.endsWith(".adf")) return void loadADF(bytes);
    if (/\.(png|gif|iff|ilbm|lbm|pbm|anim|psd|pi1|pi2|pi3|neo|ase|aseprite|info)$/.test(name)) {
      return void loadImageBytes(bytes, file.name);
    }
    loadProject(await file.text());
  };

  // File-I/O commands the legacy menu dispatches on the bus; route them to the
  // hidden inputs / download helpers (bound once).
  const bound = useRef(false);
  if (!bound.current) {
    bound.current = true;
    bus.on(COMMAND.NEW, () => newImage(64, 48));
    bus.on(COMMAND.OPEN, () => fileInputRef.current?.click());
    bus.on(COMMAND.SAVE, () => download(serialize(), "untitled.dpaint.json", "application/json"));
    bus.on(COMMAND.IMPORTLAYER, () => importInputRef.current?.click());
    bus.on(COMMAND.ADF, () => adfInputRef.current?.click());
    bus.on(COMMAND.LOADPALETTE, () => paletteInputRef.current?.click());
    bus.on(COMMAND.SAVEPALETTE, () =>
      download(savePaletteACT() as unknown as BlobPart, "palette.act", "application/octet-stream"),
    );
    bus.on(COMMAND.PALETTEEXPORT, () =>
      void exportPaletteImage().then((p) => download(p as unknown as BlobPart, "palette.png", "image/png")),
    );
    bus.on(COMMAND.INFO, () => {
      if (typeof window !== "undefined") window.alert(editor.imageInfo());
    });
    bus.on(COMMAND.LOADBRUSH, () => brushInputRef.current?.click());
    bus.on(COMMAND.SAVEBRUSH, () => {
      const brush = getBrush();
      if (!brush) return;
      void encodePNG({ width: brush.width, height: brush.height, data: brush.data }).then((png) =>
        download(png as unknown as BlobPart, "brush.png", "image/png"),
      );
    });
  }

  // close the open menu when clicking elsewhere
  useEffect(() => {
    if (openIndex === null) return;
    const close = () => setOpenIndex(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [openIndex]);

  const run = (item: MenuItem) => {
    if (item.action) item.action();
    else if (item.cmd !== undefined) bus.trigger(item.cmd);
    setOpenIndex(null);
  };

  const exportPng = async () =>
    download((await exportPNG()) as unknown as BlobPart, "untitled.png", "image/png");

  const MENU: TopMenu[] = [
    {
      label: "File",
      children: [
        { label: "New", cmd: COMMAND.NEW, shortkey: "Ctrl+N" },
        { label: "Open", cmd: COMMAND.OPEN, shortkey: "Ctrl+O" },
        { label: "Save", cmd: COMMAND.SAVE, shortkey: "Ctrl+S", testid: "menu-save" },
        {
          label: "Export As",
          children: [
            { label: "PNG", action: () => void exportPng(), testid: "menu-export-png" },
            { label: "GIF", action: () => download(exportGIF() as unknown as BlobPart, "untitled.gif", "image/gif"), testid: "menu-export-gif" },
            { label: "IFF / ILBM", action: () => download(exportILBM() as unknown as BlobPart, "untitled.iff", "image/x-ilbm"), testid: "menu-export-iff" },
            { label: "HAM6 IFF", action: () => download(exportHAM() as unknown as BlobPart, "untitled.ham.iff", "image/x-ilbm") },
            { label: "SHAM IFF", action: () => download(exportSHAM() as unknown as BlobPart, "untitled.sham.iff", "image/x-ilbm") },
            { label: "PSD", action: () => download(exportPSD() as unknown as BlobPart, "untitled.psd", "image/vnd.adobe.photoshop"), testid: "menu-export-psd" },
            { label: "ADF disk", action: () => download(saveToADF() as unknown as BlobPart, "disk.adf", "application/octet-stream") },
          ],
        },
        { label: "Import", cmd: COMMAND.IMPORTLAYER, shortkey: "Ctrl+I" },
        { label: "Info", cmd: COMMAND.INFO, testid: "menu-info" },
      ],
    },
    {
      label: "Edit",
      children: [
        { label: "Copy", cmd: COMMAND.COPY, shortkey: "Ctrl+C", testid: "menu-copy" },
        { label: "Cut", cmd: COMMAND.CUTTOLAYER, shortkey: "Ctrl+X", testid: "menu-cut" },
        { label: "Paste", cmd: COMMAND.PASTE, shortkey: "Ctrl+V", testid: "menu-paste" },
        { label: "Undo", cmd: COMMAND.UNDO, shortkey: "Ctrl+Z" },
        { label: "Redo", cmd: COMMAND.REDO, shortkey: "Ctrl+Y" },
        { label: "Preferences", cmd: COMMAND.PREFERENCES, testid: "menu-preferences" },
      ],
    },
    {
      label: "Image",
      children: [
        { label: "Rotate Right", action: () => rotate(false), testid: "menu-rotate-right" },
        { label: "Rotate Left", action: () => rotate(true), testid: "menu-rotate-left" },
        { label: "Crop", cmd: COMMAND.CROP, testid: "menu-crop" },
        { label: "Trim", cmd: COMMAND.TRIM, testid: "menu-trim" },
        { label: "Flatten", cmd: COMMAND.FLATTEN },
        { label: "Matte (defringe)", action: () => matteImage(), testid: "menu-matte" },
        { label: "Image size (resample)", cmd: COMMAND.RESAMPLE, testid: "menu-resample" },
        { label: "Canvas size (resize)", cmd: COMMAND.RESIZE, testid: "menu-resize" },
        {
          label: "Batch",
          children: [
            { label: "Frames to Layers", cmd: COMMAND.FRAMES2LAYERS },
            { label: "Layers to Frames", cmd: COMMAND.LAYERS2FRAMES },
            { label: "Layers to sheet", cmd: COMMAND.LAYERS2SHEET },
          ],
        },
      ],
    },
    {
      label: "Tools",
      children: [
        { label: "Draw", cmd: COMMAND.DRAW, shortkey: "B" },
        { label: "Select", cmd: COMMAND.SELECT, shortkey: "S" },
        { label: "Select Layer", cmd: COMMAND.SELECTLAYER },
        { label: "Polygon Select", cmd: COMMAND.POLYGONSELECT, shortkey: "P" },
        { label: "Magic Wand", cmd: COMMAND.FLOODSELECT, shortkey: "W" },
        { label: "Circle", cmd: COMMAND.CIRCLE, shortkey: "C" },
        { label: "Rectangle", cmd: COMMAND.SQUARE, shortkey: "R" },
        { label: "Line", cmd: COMMAND.LINE, shortkey: "L" },
        { label: "Arc", cmd: COMMAND.ARC, shortkey: "A" },
        { label: "Gradient", cmd: COMMAND.GRADIENT, shortkey: "G" },
        { label: "Fill", cmd: COMMAND.FLOOD, shortkey: "F" },
        { label: "Erase", cmd: COMMAND.ERASE, shortkey: "E" },
        { label: "Smudge", cmd: COMMAND.SMUDGE, shortkey: "M" },
        { label: "Spray", cmd: COMMAND.SPRAY, shortkey: "O" },
        { label: "Text", cmd: COMMAND.TEXT, shortkey: "T" },
        { label: "Hand", cmd: COMMAND.PAN, shortkey: "H" },
        { label: "Color Picker", cmd: COMMAND.COLORPICKER, shortkey: "K" },
      ],
    },
    {
      label: "Layer",
      children: [
        { label: "New", cmd: COMMAND.NEWLAYER, testid: "menu-newlayer" },
        {
          label: "Transform",
          children: [
            { label: "Free Transform", cmd: COMMAND.TRANSFORMLAYER },
            { label: "Flip Horizontal", cmd: COMMAND.FLIPHORIZONTAL, testid: "menu-fliph" },
            { label: "Flip Vertical", cmd: COMMAND.FLIPVERTICAL, testid: "menu-flipv" },
          ],
        },
        { label: "Duplicate", cmd: COMMAND.DUPLICATELAYER },
        { label: "Effects", cmd: COMMAND.EFFECTS },
        { label: "Move Up", cmd: COMMAND.LAYERUP },
        { label: "Move Down", cmd: COMMAND.LAYERDOWN },
        { label: "Merge Down", cmd: COMMAND.MERGEDOWN },
        {
          label: "Add Mask",
          children: [
            { label: "Show All", cmd: COMMAND.LAYERMASK },
            { label: "Hide All", cmd: COMMAND.LAYERMASKHIDE },
            { label: "Apply Mask", cmd: COMMAND.APPLYLAYERMASK },
            { label: "Delete Mask", cmd: COMMAND.DELETELAYERMASK },
          ],
        },
      ],
    },
    {
      label: "Selection",
      children: [
        {
          label: "Select",
          children: [
            { label: "All", cmd: COMMAND.SELECTALL, shortkey: "Ctrl+A" },
            { label: "Pixels in Current Layer", cmd: COMMAND.TOSELECTION, testid: "menu-select-layer" },
            { label: "Pixels in Current Color", cmd: COMMAND.COLORSELECT, testid: "menu-select-color" },
            { label: "Pixels not in Palette", cmd: COMMAND.COLORSELECT_NOT_PALETTE, testid: "menu-select-notpalette" },
            { label: "Transparent pixels", cmd: COMMAND.ALPHASELECT, testid: "menu-select-alpha" },
          ],
        },
        { label: "Deselect", cmd: COMMAND.CLEARSELECTION, shortkey: "Esc" },
        { label: "Invert", cmd: COMMAND.INVERTSELECTION, testid: "menu-select-invert" },
        { label: "Copy To Layer", cmd: COMMAND.TOLAYER, testid: "menu-to-layer" },
        { label: "Cut To Layer", cmd: COMMAND.CUTTOLAYER },
        { label: "Copy To Brush", cmd: COMMAND.STAMP },
      ],
    },
    {
      label: "Brush",
      children: [
        { label: "Load Brush", cmd: COMMAND.LOADBRUSH, testid: "menu-brush-load" },
        { label: "Save Brush", cmd: COMMAND.SAVEBRUSH, testid: "menu-brush-save" },
        {
          label: "Transform",
          children: [
            { label: "Rotate Right", cmd: COMMAND.BRUSHROTATERIGHT },
            { label: "Rotate Left", cmd: COMMAND.BRUSHROTATELEFT },
            { label: "Flip Horizontal", cmd: COMMAND.BRUSHFLIPHORIZONTAL },
            { label: "Flip Vertical", cmd: COMMAND.BRUSHFLIPVERTICAL },
          ],
        },
        { label: "From Selection", cmd: COMMAND.STAMP, testid: "menu-brush-capture" },
      ],
    },
    {
      label: "Palette",
      children: [
        { label: "Edit", cmd: COMMAND.EDITPALETTE },
        {
          label: "From Image",
          children: [
            { label: "Replace palette", cmd: COMMAND.PALETTEFROMIMAGE },
            { label: "Expand palette", cmd: COMMAND.PALETTEEXPANDFROMIMAGE },
          ],
        },
        { label: "Reduce", cmd: COMMAND.PALETTEREDUCE },
        { label: "Show Presets", cmd: COMMAND.TOGGLEPALETTES },
        { label: "Save Palette", cmd: COMMAND.SAVEPALETTE },
        { label: "Load Palette", cmd: COMMAND.LOADPALETTE },
        { label: "Export", cmd: COMMAND.PALETTEEXPORT },
        { label: "Toggle Color Cycle", cmd: COMMAND.CYCLEPALETTE, checked: colorCycleActive },
        {
          label: "Color Depth",
          children: [
            { label: "24bit", cmd: COMMAND.COLORDEPTH24, info: "16 Million", testid: "menu-24bit" },
            { label: "12bit", cmd: COMMAND.COLORDEPTH12, info: "4096 - Amiga OCS", testid: "menu-12bit" },
            { label: "9bit", cmd: COMMAND.COLORDEPTH9, info: "512 - Atari ST", testid: "menu-9bit" },
          ],
        },
      ],
    },
    {
      label: "View",
      className: "view",
      children: [
        { label: "Grid", cmd: COMMAND.TOGGLEGRID, checked: showGrid, testid: "menu-grid" },
        { label: "Rulers", cmd: COMMAND.TOGGLERULERS, checked: showRulers, testid: "menu-rulers" },
        { label: "Split Screen", cmd: COMMAND.SPLITSCREEN, checked: splitScreen },
        { label: "Tool Options", cmd: COMMAND.TOGGLESIDEPANEL, checked: sidePanelVisible, testid: "menu-sidepanel" },
        { label: "Gallery", cmd: COMMAND.TOGGLEGALLERY, checked: galleryOpen, testid: "menu-gallery" },
        { label: "Presentation mode", cmd: COMMAND.PRESENTATION, checked: presentationMode, testid: "menu-presentation" },
        { label: "Full Screen", cmd: COMMAND.FULLSCREEN },
      ],
    },
    {
      label: "Recorder",
      children: [
        { label: "Start", action: () => { if (!recording) toggleRecording(); }, testid: "menu-record-start" },
        { label: "Stop", action: () => { if (recording) toggleRecording(); }, testid: "menu-record-stop" },
      ],
    },
    {
      label: "Amiga",
      children: [
        { label: "Open ADF image", cmd: COMMAND.ADF },
        { label: "Preview in Deluxe Paint", cmd: COMMAND.DELUXE, testid: "menu-deluxe" },
      ],
    },
    {
      label: "Help",
      children: [
        { label: "About DPaint.js", cmd: COMMAND.ABOUT, testid: "menu-about" },
        { label: "Documentation", action: () => window.open("https://www.stef.be/dpaint/docs/", "_blank") },
        { label: "SourceCode on GitHub", action: () => window.open("https://github.com/steffest/dpaint-js", "_blank") },
      ],
    },
  ];

  const renderItems = (items: MenuItem[], sub: "sub" | "subsub") => {
    const checkable = items.some((i) => i.checked !== undefined);
    return (
      <div className={`menuitem ${sub}${checkable ? " checkable" : ""}`} onPointerDown={(e) => e.stopPropagation()}>
        {items.map((item) => {
          const hasChildren = !!item.children?.length;
          const cls = [
            "handle",
            hasChildren ? "caret" : "",
            item.checked ? "checked" : "",
            item.info ? "hasinfo" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={item.label}
              className={cls}
              data-testid={item.testid ?? `menu-item-${item.label}`}
              aria-pressed={item.checked !== undefined ? item.checked : undefined}
              role="menuitem"
              tabIndex={0}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                if (hasChildren) return; // parent of a submenu: hover opens it
                e.stopPropagation();
                run(item);
              }}
            >
              {item.label}
              {item.shortkey && <div className="shortkey">{item.shortkey}</div>}
              {item.info && <div className="info">{item.info}</div>}
              {hasChildren && renderItems(item.children!, "subsub")}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className={"menu" + (openIndex !== null ? " active" : "")}
      data-testid="menu"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="hamburger menuitem" data-testid="menu-brand">
        DPaint.js
      </div>
      {MENU.map((top, i) => (
        <div
          key={top.label}
          className={"menuitem main handle" + (top.className ? " " + top.className : "") + (openIndex === i ? " active" : "")}
          data-testid={`menu-top-${top.label}`}
          role="menuitem"
          tabIndex={0}
          onPointerDown={(e) => {
            e.stopPropagation();
            setOpenIndex((cur) => (cur === i ? null : i));
          }}
          onPointerEnter={() => setOpenIndex((cur) => (cur === null ? cur : i))}
        >
          {top.label}
          {renderItems(top.children, "sub")}
        </div>
      ))}

      {/* hidden file inputs driving the file-I/O commands */}
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
        ref={importInputRef}
        type="file"
        accept=".png,image/png,.gif,image/gif,.iff,.ilbm,.lbm,.pbm,.psd,.neo,.ase,.aseprite,.info"
        data-testid="import-input"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void file.arrayBuffer().then((b) => importLayer(new Uint8Array(b), file.name));
          e.target.value = "";
        }}
      />
      <input
        ref={adfInputRef}
        type="file"
        accept=".adf"
        data-testid="adf-input"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void file.arrayBuffer().then((b) => loadADF(new Uint8Array(b)));
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
          if (file) void file.arrayBuffer().then((b) => loadPalette(new Uint8Array(b), file.name));
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
          if (file)
            void file
              .arrayBuffer()
              .then((b) => decodePNG(new Uint8Array(b)))
              .then((img) =>
                setBrushRegion({ width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) }),
              );
          e.target.value = "";
        }}
      />
    </div>
  );
}
