import { describe, it, expect } from "vitest";
import { render, act } from "@testing-library/react";
import { EditorProvider, useEditor, type EditorApi } from "../src/state/EditorContext";

function Harness({ apiRef }: { apiRef: { current: EditorApi | null } }) {
  apiRef.current = useEditor();
  return null;
}

describe("Free transform of selection", () => {
  it("scales the selection content (2x makes a single pixel block bigger)", () => {
    const apiRef: { current: EditorApi | null } = { current: null };
    render(
      <EditorProvider width={16} height={16}>
        <Harness apiRef={apiRef} />
      </EditorProvider>,
    );
    const api = apiRef.current!;
    act(() => {
      // a 2x2 opaque block at top-left
      api.doc.setPixel(0, 0, [255, 0, 0]);
      api.doc.setPixel(1, 0, [255, 0, 0]);
      api.doc.setPixel(0, 1, [255, 0, 0]);
      api.doc.setPixel(1, 1, [255, 0, 0]);
      api.doc.selection = { x: 0, y: 0, width: 4, height: 4 };
      api.transformSelection(2, 0);
    });
    // after a 2x scale the painted content spreads further than the original 2px
    const doc = apiRef.current!.doc;
    let maxX = -1;
    const comp = doc.composite();
    for (let y = 0; y < doc.height; y++) {
      for (let x = 0; x < doc.width; x++) {
        if (comp[(y * doc.width + x) * 4 + 3]! > 0 && x > maxX) maxX = x;
      }
    }
    expect(maxX).toBeGreaterThan(1);
  });

  it("rotating 90° does not throw and keeps content", () => {
    const apiRef: { current: EditorApi | null } = { current: null };
    render(
      <EditorProvider width={16} height={16}>
        <Harness apiRef={apiRef} />
      </EditorProvider>,
    );
    const api = apiRef.current!;
    act(() => {
      api.doc.setPixel(8, 4, [0, 255, 0]);
      api.doc.selection = { x: 4, y: 0, width: 8, height: 8 };
      api.transformSelection(1, 90);
    });
    expect(apiRef.current!.doc.colorCount()).toBeGreaterThan(0);
  });
});
