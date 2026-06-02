import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "../src/App";

describe("Effects panel", () => {
  it("applies a brightness effect to painted content", () => {
    render(<App />);
    const canvas = screen.getByTestId("paint-canvas");
    // paint a dark grey pixel
    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 0, clientY: 0, pointerId: 1 });

    expect(screen.getByTestId("effects-panel")).toBeInTheDocument();
    // brightness is the default selection
    expect((screen.getByTestId("effect-select") as HTMLSelectElement).value).toBe("brightness");
    fireEvent.click(screen.getByTestId("effect-apply"));
    // an undoable step was recorded
    expect(screen.getByTestId("menu-undo")).toBeEnabled();
  });

  it("switches effects and applies one without error", () => {
    render(<App />);
    const select = screen.getByTestId("effect-select");
    fireEvent.change(select, { target: { value: "sepia" } });
    expect((screen.getByTestId("effect-select") as HTMLSelectElement).value).toBe("sepia");
    fireEvent.click(screen.getByTestId("effect-apply"));
    expect(screen.getByTestId("app")).toBeInTheDocument();
  });
});
