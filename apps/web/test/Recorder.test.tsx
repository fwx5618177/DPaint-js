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

describe("Session recorder", () => {
  let created: Blob[] = [];
  beforeEach(() => {
    created = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      created.push(b);
      return "blob:mock";
    }) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("records edits as frames and exports an animated GIF", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByTestId("menu-export-rec")).toBeDisabled();

    await user.click(screen.getByTestId("menu-record"));
    expect(screen.getByTestId("menu-record")).toHaveAttribute("aria-pressed", "true");

    drawDot(); // frame
    drawDot(); // frame
    await user.click(screen.getByTestId("menu-record")); // stop

    expect(screen.getByTestId("menu-export-rec")).toBeEnabled();
    await user.click(screen.getByTestId("menu-export-rec"));
    expect(created).toHaveLength(1);
    const bytes = new Uint8Array(await created[0]!.arrayBuffer());
    const decoded = decodeGIF(bytes);
    expect(decoded.frames.length).toBeGreaterThanOrEqual(2);
  });
});
