import { describe, it, expect } from "vitest";
import { render, act } from "@testing-library/react";
import { COMMAND } from "@dpaint/runtime";
import { encodePNG, encodePSD, AdfDisk } from "@dpaint/codecs";
import { EditorProvider, useEditor, type EditorApi } from "../src/state/EditorContext";

function Harness({ apiRef }: { apiRef: { current: EditorApi | null } }) {
  apiRef.current = useEditor();
  return null;
}

describe("File ops: import layer + save ADF", () => {
  it("fits oversized PSD images below 100% on load", async () => {
    const apiRef: { current: EditorApi | null } = { current: null };
    render(
      <EditorProvider width={8} height={8}>
        <Harness apiRef={apiRef} />
      </EditorProvider>,
    );

    const width = 2000;
    const height = 1000;
    const psd = encodePSD({ width, height, data: new Uint8Array(width * height * 4).fill(180) });
    await act(async () => {
      await apiRef.current!.loadImageBytes(psd, "large.psd");
    });

    expect(apiRef.current!.doc.width).toBe(width);
    expect(apiRef.current!.doc.height).toBe(height);
    expect(apiRef.current!.zoom).toBeLessThan(1);
  });

  it("can zoom out below 100%", () => {
    const apiRef: { current: EditorApi | null } = { current: null };
    render(
      <EditorProvider width={8} height={8}>
        <Harness apiRef={apiRef} />
      </EditorProvider>,
    );

    act(() => {
      apiRef.current!.setZoom(1);
    });
    act(() => {
      apiRef.current!.bus.trigger(COMMAND.ZOOMOUT);
    });

    expect(apiRef.current!.zoom).toBe(0.5);
  });

  it("zooms large oversized views out aggressively", async () => {
    const apiRef: { current: EditorApi | null } = { current: null };
    render(
      <EditorProvider width={8} height={8}>
        <Harness apiRef={apiRef} />
      </EditorProvider>,
    );

    const width = 2000;
    const height = 1000;
    const psd = encodePSD({ width, height, data: new Uint8Array(width * height * 4).fill(180) });
    await act(async () => {
      await apiRef.current!.loadImageBytes(psd, "large.psd");
    });
    act(() => {
      apiRef.current!.setZoom(8);
    });
    act(() => {
      apiRef.current!.bus.trigger(COMMAND.ZOOMOUT);
    });

    expect(apiRef.current!.zoom).toBe(4);
  });

  it("fits oversized project loads", async () => {
    const apiRef: { current: EditorApi | null } = { current: null };
    render(
      <EditorProvider width={8} height={8}>
        <Harness apiRef={apiRef} />
      </EditorProvider>,
    );

    const width = 2000;
    const height = 1000;
    const psd = encodePSD({ width, height, data: new Uint8Array(width * height * 4).fill(180) });
    await act(async () => {
      await apiRef.current!.loadImageBytes(psd, "large.psd");
    });
    const project = apiRef.current!.serialize();
    act(() => {
      apiRef.current!.setZoom(8);
    });
    act(() => {
      apiRef.current!.loadProject(project);
    });

    expect(apiRef.current!.zoom).toBeLessThan(1);
  });

  it("imports an image as a new layer", async () => {
    const apiRef: { current: EditorApi | null } = { current: null };
    render(
      <EditorProvider width={8} height={8}>
        <Harness apiRef={apiRef} />
      </EditorProvider>,
    );
    const api = apiRef.current!;
    expect(api.doc.layers).toHaveLength(1);

    const png = await encodePNG({ width: 4, height: 4, data: new Uint8Array(4 * 4 * 4).fill(120) });
    await act(async () => {
      await api.importLayer(png, "picture.png");
    });
    expect(apiRef.current!.doc.layers.length).toBe(2);
    // imported pixel landed at 0,0
    expect(apiRef.current!.doc.getPixel(0, 0)).toEqual([120, 120, 120, 120]);
  });

  it("saves the image to a readable ADF disk", () => {
    const apiRef: { current: EditorApi | null } = { current: null };
    render(
      <EditorProvider width={8} height={8}>
        <Harness apiRef={apiRef} />
      </EditorProvider>,
    );
    const adf = apiRef.current!.saveToADF();
    const disk = new AdfDisk(adf);
    const entries = disk.list();
    expect(entries.map((e) => e.name)).toContain("PICTURE.iff");
    // the stored file is a non-empty IFF
    const file = entries.find((e) => e.name === "PICTURE.iff")!;
    expect(disk.readFile(file.sector).length).toBeGreaterThan(0);
  });
});
