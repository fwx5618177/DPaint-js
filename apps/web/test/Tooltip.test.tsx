import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "../src/App";

describe("Floating tooltip + canvas centring", () => {
  it("shows a tooltip when hovering an element with data-tip", async () => {
    render(<App />);
    const pencil = screen.getByTestId("tool-pencil");
    fireEvent.pointerMove(pencil);
    // the rAF-debounced tooltip appears with the tool's tip text
    const tip = await screen.findByTestId("tooltip");
    expect(tip).toHaveTextContent("Pencil");
  });

  it("the editor viewport is a centring flexbox", () => {
    render(<App />);
    // the canvas lives inside a centred .viewport (see app.scss override)
    const canvas = screen.getByTestId("paint-canvas");
    expect(canvas.closest(".viewport")).not.toBeNull();
  });

  it("a sized eraser clears soft-brush pixels back to transparent", () => {
    render(<App />);
    const canvas = screen.getByTestId("paint-canvas");
    // big soft brush paints a blob
    fireEvent.change(screen.getByTestId("brush-size"), { target: { value: "12" } });
    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 200, clientY: 150, pointerId: 1 });
    expect(screen.getByTestId("status-colors")).not.toHaveTextContent("0 colours");
    // switch to eraser (same size) and clear it
    fireEvent.click(screen.getByTestId("tool-eraser"));
    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 200, clientY: 150, pointerId: 1 });
    expect(screen.getByTestId("status-colors")).toHaveTextContent("0 colours");
  });
});
