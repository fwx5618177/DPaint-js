import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "../src/App";

afterEach(() => {
  delete (window as unknown as { getUaeContent?: unknown }).getUaeContent;
});

describe("Canvas right-click", () => {
  it("does not open an edit context menu on the drawing canvas", () => {
    render(<App />);
    const canvas = screen.getByTestId("paint-canvas");
    fireEvent.contextMenu(canvas, { clientX: 30, clientY: 40 });
    expect(screen.queryByTestId("context-menu")).toBeNull();
  });

  it("paints with the background colour on right-button pointer input", () => {
    render(<App />);
    const canvas = screen.getByTestId("paint-canvas");
    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, button: 2, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 0, clientY: 0, button: 2, pointerId: 1 });
    expect(screen.getByTestId("status-colors")).toHaveTextContent("1 colours");
    expect(screen.queryByTestId("context-menu")).toBeNull();
  });
});

describe("Amiga UAE preview", () => {
  it("opens the preview and exposes getUaeContent returning an ADF", async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("menu-deluxe"));
    expect(screen.getByTestId("uae-preview")).toBeInTheDocument();
    expect(screen.getByTestId("uae-frame")).toBeInTheDocument();

    const getUaeContent = (window as unknown as { getUaeContent?: () => Promise<ArrayBuffer> })
      .getUaeContent;
    expect(typeof getUaeContent).toBe("function");
    const buffer = await getUaeContent!();
    // standard 880 KB Amiga floppy
    expect(buffer.byteLength).toBe(1760 * 512);

    fireEvent.click(screen.getByTestId("uae-close"));
    expect(screen.queryByTestId("uae-preview")).toBeNull();
  });
});
