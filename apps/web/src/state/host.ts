/**
 * Host embedding bridge (ports the legacy host.js / amibase.js). When DPaint
 * runs inside an iframe it talks to the host page over postMessage:
 *
 *   host → app:  { command: "load",  name, data: Uint8Array }   open an image
 *                { command: "getImage" }                        request a PNG
 *                { command: "new", width, height }              new document
 *   app  → host: { command: "ready" }                           on startup
 *                { command: "image", data: Uint8Array }         PNG response
 *
 * The message handling is a pure async function so it is fully unit-testable.
 */

export interface HostApi {
  loadImageBytes: (bytes: Uint8Array, name?: string) => Promise<boolean>;
  exportPNG: () => Promise<Uint8Array>;
  newImage: (width: number, height: number) => void;
}

export interface HostMessage {
  command: string;
  name?: string;
  data?: Uint8Array;
  width?: number;
  height?: number;
}

export type PostBack = (message: HostMessage) => void;

/** Handle a single host message. Returns true if it was recognised. */
export async function handleHostMessage(
  message: HostMessage,
  api: HostApi,
  postBack: PostBack,
): Promise<boolean> {
  switch (message?.command) {
    case "load":
      if (message.data) await api.loadImageBytes(new Uint8Array(message.data), message.name);
      return true;
    case "getImage": {
      const png = await api.exportPNG();
      postBack({ command: "image", data: png });
      return true;
    }
    case "new":
      api.newImage(message.width ?? 64, message.height ?? 48);
      return true;
    default:
      return false;
  }
}

interface WindowLike {
  self: unknown;
  top: unknown;
  parent: { postMessage: (msg: unknown, origin: string) => void };
  addEventListener: (type: "message", handler: (e: MessageEvent) => void) => void;
  removeEventListener: (type: "message", handler: (e: MessageEvent) => void) => void;
}

/**
 * Attach the host bridge to a window (only when embedded in an iframe). Returns
 * a disposer. Posts `ready` to the parent on attach.
 */
export function attachHostBridge(api: HostApi, win: WindowLike = window as unknown as WindowLike): () => void {
  if (win.self === win.top) return () => {}; // not embedded
  const handler = (e: MessageEvent) => {
    void handleHostMessage(e.data as HostMessage, api, (msg) =>
      (e.source as { postMessage?: (m: unknown, o: string) => void } | null)?.postMessage?.(msg, "*"),
    );
  };
  win.addEventListener("message", handler);
  win.parent.postMessage({ command: "ready" }, "*");
  return () => win.removeEventListener("message", handler);
}
