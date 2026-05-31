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
import { ImageDocument, type DocumentSnapshot } from "../model/ImageDocument";
import { History } from "../model/History";
import { serializeToString, deserializeFromString } from "../model/serialization";
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

  /** Record the current document state as an undo checkpoint. */
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  /** Serialize the current document to a JSON project string. */
  serialize: () => string;
  /** Replace the document with one parsed from a JSON project string. */
  loadProject: (json: string) => void;
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
  const historyRef = useRef<History<DocumentSnapshot>>(new History<DocumentSnapshot>(50));
  if (historyRef.current.size === 0) historyRef.current.reset(docRef.current.snapshot());

  const commit = useCallback(() => setVersion((v) => v + 1), []);

  const checkpoint = useCallback(() => {
    historyRef.current.push(docRef.current.snapshot());
    setVersion((v) => v + 1);
  }, []);

  const undo = useCallback(() => {
    const snap = historyRef.current.undo();
    if (snap) {
      docRef.current.restore(snap);
      setVersion((v) => v + 1);
    }
  }, []);

  const redo = useCallback(() => {
    const snap = historyRef.current.redo();
    if (snap) {
      docRef.current.restore(snap);
      setVersion((v) => v + 1);
    }
  }, []);

  const newImage = useCallback(
    (w: number, h: number) => {
      docRef.current = new ImageDocument({ width: w, height: h });
      historyRef.current.reset(docRef.current.snapshot());
      commit();
    },
    [commit],
  );

  const serialize = useCallback(() => serializeToString(docRef.current), []);

  const loadProject = useCallback(
    (json: string) => {
      docRef.current = deserializeFromString(json);
      historyRef.current.reset(docRef.current.snapshot());
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
      checkpoint,
      undo,
      redo,
      canUndo: historyRef.current.canUndo,
      canRedo: historyRef.current.canRedo,
      serialize,
      loadProject,
    }),
    [
      version,
      tool,
      color,
      bgColor,
      zoom,
      commit,
      newImage,
      swapColors,
      checkpoint,
      undo,
      redo,
      serialize,
      loadProject,
    ],
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
      checkpoint();
    });
    bus.on(COMMAND.ZOOMIN, () => setZoom((z) => Math.min(z + 1, 32)));
    bus.on(COMMAND.ZOOMOUT, () => setZoom((z) => Math.max(z - 1, 1)));
    bus.on(COMMAND.NEWLAYER, () => {
      docRef.current.addLayer();
      checkpoint();
    });
    bus.on(COMMAND.UNDO, () => undo());
    bus.on(COMMAND.REDO, () => redo());
  }

  return <EditorContext.Provider value={api}>{children}</EditorContext.Provider>;
}

export function useEditor(): EditorApi {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within an EditorProvider");
  return ctx;
}
