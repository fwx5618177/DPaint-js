import { describe, it, expect, vi } from "vitest";
import { handleHostMessage, attachHostBridge, type HostApi } from "../src/state/host";

function fakeApi(): HostApi & { _png: Uint8Array } {
  const png = new Uint8Array([137, 80, 78, 71]);
  return {
    _png: png,
    loadImageBytes: vi.fn(async () => true),
    exportPNG: vi.fn(async () => png),
    newImage: vi.fn(),
  };
}

describe("handleHostMessage", () => {
  it("routes 'load' to loadImageBytes", async () => {
    const api = fakeApi();
    const bytes = new Uint8Array([1, 2, 3]);
    const handled = await handleHostMessage({ command: "load", data: bytes, name: "x.png" }, api, () => {});
    expect(handled).toBe(true);
    expect(api.loadImageBytes).toHaveBeenCalled();
  });

  it("responds to 'getImage' with a PNG", async () => {
    const api = fakeApi();
    const back = vi.fn();
    await handleHostMessage({ command: "getImage" }, api, back);
    expect(back).toHaveBeenCalledWith({ command: "image", data: api._png });
  });

  it("routes 'new' to newImage", async () => {
    const api = fakeApi();
    await handleHostMessage({ command: "new", width: 10, height: 8 }, api, () => {});
    expect(api.newImage).toHaveBeenCalledWith(10, 8);
  });

  it("ignores unknown commands", async () => {
    const api = fakeApi();
    expect(await handleHostMessage({ command: "frobnicate" }, api, () => {})).toBe(false);
  });
});

describe("attachHostBridge", () => {
  it("does nothing when not embedded (self === top)", () => {
    const win = { self: 1, top: 1 } as never;
    expect(() => attachHostBridge(fakeApi(), win)).not.toThrow();
  });

  it("registers a listener and posts ready when embedded", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const postMessage = vi.fn();
    const win = {
      self: 1,
      top: 2, // embedded
      parent: { postMessage },
      addEventListener,
      removeEventListener,
    } as never;
    const dispose = attachHostBridge(fakeApi(), win);
    expect(addEventListener).toHaveBeenCalledWith("message", expect.any(Function));
    expect(postMessage).toHaveBeenCalledWith({ command: "ready" }, "*");
    dispose();
    expect(removeEventListener).toHaveBeenCalled();
  });
});
