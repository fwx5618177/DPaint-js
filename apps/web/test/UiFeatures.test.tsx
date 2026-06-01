import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";

describe("Grid + rulers overlays", () => {
  it("toggle on and off", async () => {
    const user = userEvent.setup();
    render(<App />);
    const grid = screen.getByTestId("menu-grid");
    expect(grid).toHaveAttribute("aria-pressed", "false");
    await user.click(grid);
    expect(screen.getByTestId("menu-grid")).toHaveAttribute("aria-pressed", "true");

    const rulers = screen.getByTestId("menu-rulers");
    await user.click(rulers);
    expect(screen.getByTestId("menu-rulers")).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Palette editing", () => {
  it("edits a palette colour and reflects it on the swatch", () => {
    render(<App />);
    const edit = screen.getByTestId("palette-edit-0") as HTMLInputElement;
    fireEvent.input(edit, { target: { value: "#abcdef" } });
    expect(screen.getByTestId("palette-color-0")).toHaveStyle({
      background: "rgb(171, 205, 239)",
    });
  });

  it("adds and removes palette colours", async () => {
    const user = userEvent.setup();
    render(<App />);
    const grid = screen.getByTestId("palette-grid");
    const initial = grid.querySelectorAll('[data-testid^="palette-color-"]').length;
    await user.click(screen.getByTestId("palette-add"));
    expect(grid.querySelectorAll('[data-testid^="palette-color-"]').length).toBe(initial + 1);
    await user.click(screen.getByTestId("palette-remove"));
    expect(grid.querySelectorAll('[data-testid^="palette-color-"]').length).toBe(initial);
  });
});
