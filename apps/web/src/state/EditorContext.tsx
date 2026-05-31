import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { COMMAND, createEventBus, type EventBus } from "@dpaint/core";
import type { ColorArray } from "@dpaint/util";
import { ImageDocument } from "../model/ImageDocument";
import type { ToolId } from "../model/tools";

export interface EditorApi {
  doc: ImageDocument;
  /** monotonically increasing render token; bump after mutating the document */
  version: number;
  bus: EventBus;

  tool: ToolId;
  setTool: (tool: ToolId) => void;

  color: ColorArray;
  setColor: (color: ColorArray) => void;
  bgColor: ColorArray;
  setBgColor: (color: ColorArray) => void;

  zoom: number;
  setZoom: (zoom: number) => void;

  /** Re-render after an in-place mutation of the document. */
  commit: () => void;
  newImage: (width: number, height: number) => void;
  swapColors: () => void;
}

const EditorContext = createContext<EditorApi | null>(null);

export interface EditorProviderProps {
  width?: number;
  height?: number;
  children: ReactNode;
}

export function EditorProvider({ width = 64, height = 48, children }: EditorProviderProps) {
  const docRef = useRef<ImageDocument>(new ImageDocument({ width, height }));
  const [version, setVersion] = useState(0);
  const [tool, setTool] = useState<ToolId>("pencil");
  const [color, setColor] = useState<ColorArray>([255, 255, 255]);
  const [bgColor, setBgColor] = useState<ColorArray>([0, 0, 0]);
  const [zoom, setZoom] = useState(8);
  const busRef = useRef<EventBus>(createEventBus());

  const commit = useCallback(() => setVersion((v) => v + 1), []);

  const newImage = useCallback(
    (w: number, h: number) => {
      docRef.current = new ImageDocument({ width: w, height: h });
      commit();
    },
    [commit],
  );

  const swapColors = useCallback(() => {
    setColor(bgColor);
    setBgColor(color);
  }, [color, bgColor]);

  const api = useMemo<EditorApi>(
    () => ({
      doc: docRef.current,
      version,
      bus: busRef.current,
      tool,
      setTool,
      color,
      setColor,
      bgColor,
      setBgColor,
      zoom,
      setZoom,
      commit,
      newImage,
      swapColors,
    }),
    [version, tool, color, bgColor, zoom, commit, newImage, swapColors],
  );

  // Bridge legacy COMMAND events to the React API so the menu/bus can drive the
  // editor the way the original app did. These handlers only use functional
  // updates and refs, so binding once is safe (no stale closures).
  const bound = useRef(false);
  if (!bound.current) {
    bound.current = true;
    const bus = busRef.current;
    bus.on(COMMAND.CLEAR, () => {
      docRef.current.clear();
      commit();
    });
    bus.on(COMMAND.ZOOMIN, () => setZoom((z) => Math.min(z + 1, 32)));
    bus.on(COMMAND.ZOOMOUT, () => setZoom((z) => Math.max(z - 1, 1)));
    bus.on(COMMAND.NEWLAYER, () => {
      docRef.current.addLayer();
      commit();
    });
  }

  return <EditorContext.Provider value={api}>{children}</EditorContext.Provider>;
}

export function useEditor(): EditorApi {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within an EditorProvider");
  return ctx;
}
