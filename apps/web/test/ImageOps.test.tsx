import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import App from "../src/App";
import { EditorProvider, useEditor, type EditorApi } from "../src/state/EditorContext";

afterEach(() => vi.restoreAllMocks());

/** Capture the editor api so a test can drive it imperatively. */
function Harness({ apiRef }: { apiRef: { current: EditorApi | null } }) {
  apiRef.current = useEditor();
  return null;
}

describe("Image ops: crop / trim", () => {
  it("crops the document to the active selection", () => {
    const apiRef: { current: EditorApi | null } = { current: null };
    render(
      <EditorProvider width={16} height={16}>
        <Harness apiRef={apiRef} />
      </EditorProvider>,
    );
    const api = apiRef.current!;
    act(() => {
      api.doc.selection = { x: 4, y: 4, width: 6, height: 5 };
      api.crop();
    });
    expect(apiRef.current!.doc.width).toBe(6);
    expect(apiRef.current!.doc.height).toBe(5);
  });

  it("trims transparent margins to content", () => {
    const apiRef: { current: EditorApi | null } = { current: null };
    render(
      <EditorProvider width={16} height={16}>
        <Harness apiRef={apiRef} />
      </EditorProvider>,
    );
    const api = apiRef.current!;
    act(() => {
      api.doc.setPixel(3, 3, [255, 0, 0]);
      api.doc.setPixel(9, 7, [0, 255, 0]);
      api.trim();
    });
    expect(apiRef.current!.doc.width).toBe(7); // x 3..9
    expect(apiRef.current!.doc.height).toBe(5); // y 3..7
  });
});

describe("Image info", () => {
  it("shows image info via alert", () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    render(<App />);
    fireEvent.click(screen.getByTestId("menu-info"));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(String(alert.mock.calls[0]![0])).toMatch(/64 × 48 px/);
  });
});
