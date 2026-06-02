import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "../src/App";

describe("Palette lock + colour mask", () => {
  it("locking the palette blocks preset changes", () => {
    render(<App />);
    const count = () =>
      screen.getByTestId("palette-grid").querySelectorAll('[data-testid^="palette-color-"]').length;
    // EGA preset -> 16 colours
    fireEvent.click(screen.getByTestId("palette-preset-ega"));
    expect(count()).toBe(16);
    // lock, then try gameboy (4) -> blocked, stays 16
    fireEvent.click(screen.getByTestId("palette-lock"));
    expect(screen.getByTestId("palette-lock")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByTestId("palette-preset-gameboy"));
    expect(count()).toBe(16);
    // unlock, change works again
    fireEvent.click(screen.getByTestId("palette-lock"));
    fireEvent.click(screen.getByTestId("palette-preset-gameboy"));
    expect(count()).toBe(4);
  });

  it("toggles the colour-mask stencil", () => {
    render(<App />);
    const btn = screen.getByTestId("palette-colormask");
    expect(btn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(btn);
    expect(screen.getByTestId("palette-colormask")).toHaveAttribute("aria-pressed", "true");
  });
});
