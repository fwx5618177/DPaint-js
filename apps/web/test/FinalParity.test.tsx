import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "../src/App";

describe("Final parity features", () => {
  it("expands and steps the palette, stores multiple palettes", () => {
    render(<App />);
    const count = () =>
      screen.getByTestId("palette-grid").querySelectorAll('[data-testid^="palette-color-"]').length;
    // store the current palette
    fireEvent.click(screen.getByTestId("palette-add-set"));
    expect(screen.getByTestId("palette-set-indicator")).toHaveTextContent("1/1");
    // switch to a different preset, store it, then navigate
    fireEvent.click(screen.getByTestId("palette-preset-gameboy"));
    fireEvent.click(screen.getByTestId("palette-add-set"));
    expect(screen.getByTestId("palette-set-indicator")).toHaveTextContent("2/2");
    fireEvent.click(screen.getByTestId("palette-prev"));
    expect(count()).toBeGreaterThan(0);

    // expand + step + 24bit run without error
    fireEvent.click(screen.getByTestId("palette-expand"));
    fireEvent.click(screen.getByTestId("palette-cycle-step"));
    fireEvent.click(screen.getByTestId("palette-depth-24"));
    expect(screen.getByTestId("app")).toBeInTheDocument();
  });

  it("toggles brush dither + invert", () => {
    render(<App />);
    const dither = screen.getByTestId("brush-dither");
    expect(dither).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(dither);
    expect(screen.getByTestId("brush-dither")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByTestId("brush-invert"));
    expect(screen.getByTestId("brush-invert")).toHaveAttribute("aria-pressed", "true");
  });

  it("copies selection to a new layer via the menu", () => {
    render(<App />);
    const canvas = screen.getByTestId("paint-canvas");
    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
    expect(screen.getByTestId("layer-row-0")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("menu-to-layer"));
    expect(screen.getByTestId("layer-row-1")).toBeInTheDocument();
  });

  it("picks the layer under the cursor with the layerpick tool", () => {
    render(<App />);
    const canvas = screen.getByTestId("paint-canvas");
    // paint on layer 0
    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
    // add a layer, then pick the layer at the painted pixel -> should select layer 0
    fireEvent.click(screen.getByTestId("layer-add"));
    fireEvent.click(screen.getByTestId("menu-item-Select Layer"));
    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
    expect(screen.getByTestId("layer-row-0")).toHaveClass("active");
  });
});
