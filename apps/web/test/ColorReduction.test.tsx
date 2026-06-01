import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { decodeGIF } from "@dpaint/codecs";
import App from "../src/App";

function drawDot() {
  const canvas = screen.getByTestId("paint-canvas");
  fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
  fireEvent.pointerUp(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
}

describe("Colour-reduction menu", () => {
  it("exposes palette/dither/GIF controls", () => {
    render(<App />);
    expect(screen.getByTestId("menu-palette-from-image")).toBeInTheDocument();
    expect(screen.getByTestId("menu-dither")).toBeInTheDocument();
    expect(screen.getByTestId("menu-export-gif")).toBeInTheDocument();
  });

  it("palette-from-image and dither run as undoable steps", async () => {
    const user = userEvent.setup();
    render(<App />);
    drawDot();
    await user.click(screen.getByTestId("menu-palette-from-image"));
    await user.click(screen.getByTestId("menu-dither"));
    expect(screen.getByTestId("menu-undo")).toBeEnabled();
  });
});

describe("GIF export", () => {
  let created: Blob[] = [];
  beforeEach(() => {
    created = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return "blob:mock";
    }) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("exports a decodable GIF of the document size", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId("menu-export-gif"));
    expect(created).toHaveLength(1);
    expect(created[0]!.type).toBe("image/gif");
    const bytes = new Uint8Array(await created[0]!.arrayBuffer());
    const decoded = decodeGIF(bytes);
    expect(decoded.width).toBe(64);
    expect(decoded.height).toBe(48);
  });
});
