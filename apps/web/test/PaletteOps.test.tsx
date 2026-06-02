import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "../src/App";

describe("Palette presets + modes", () => {
  it("applies a preset, reduces, and toggles EHB", () => {
    render(<App />);
    const countSwatches = () =>
      screen.getByTestId("palette-grid").querySelectorAll('[data-testid^="palette-color-"]').length;

    fireEvent.click(screen.getByTestId("palette-preset-gameboy"));
    expect(countSwatches()).toBe(4);

    fireEvent.click(screen.getByTestId("palette-preset-ega"));
    expect(countSwatches()).toBe(16);

    // EHB expands to the Amiga 64-slot model (16 base + half-bright bank)
    fireEvent.click(screen.getByTestId("palette-ehb"));
    const expanded = countSwatches();
    expect(expanded).toBeGreaterThan(16);
    expect(screen.getByTestId("palette-ehb")).toHaveAttribute("aria-pressed", "true");
    // toggle off restores exactly the 16-colour base
    fireEvent.click(screen.getByTestId("palette-ehb"));
    expect(countSwatches()).toBe(16);
  });

  it("edits colour-cycle range bounds and speed", () => {
    render(<App />);
    const low = screen.getByTestId("cycle-low") as HTMLInputElement;
    fireEvent.change(low, { target: { value: "2" } });
    expect((screen.getByTestId("cycle-low") as HTMLInputElement).value).toBe("2");

    const speed = screen.getByTestId("cycle-speed") as HTMLInputElement;
    fireEvent.change(speed, { target: { value: "200" } });
    expect((screen.getByTestId("cycle-speed") as HTMLInputElement).value).toBe("200");

    // cycle toggle flips its pressed state
    fireEvent.click(screen.getByTestId("cycle-toggle"));
    expect(screen.getByTestId("cycle-toggle")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByTestId("cycle-toggle"));
  });
});
