import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";

/**
 * Draw a single pixel by issuing a pointer down/up on the canvas. jsdom's
 * getBoundingClientRect returns zeros, so the stroke lands at document (0,0).
 */
function drawDot() {
  const canvas = screen.getByTestId("paint-canvas");
  fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
  fireEvent.pointerUp(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
}

describe("Undo / redo", () => {
  it("undo and redo are disabled on a fresh document", () => {
    render(<App />);
    expect(screen.getByTestId("menu-undo")).toBeDisabled();
    expect(screen.getByTestId("menu-redo")).toBeDisabled();
  });

  it("a drawing stroke becomes an undoable checkpoint", () => {
    render(<App />);
    expect(screen.getByTestId("status-colors")).toHaveTextContent("0 colours");
    drawDot();
    expect(screen.getByTestId("status-colors")).toHaveTextContent("1 colours");
    expect(screen.getByTestId("menu-undo")).toBeEnabled();
  });

  it("undo reverts the stroke and redo re-applies it", async () => {
    const user = userEvent.setup();
    render(<App />);
    drawDot();
    expect(screen.getByTestId("status-colors")).toHaveTextContent("1 colours");

    await user.click(screen.getByTestId("menu-undo"));
    expect(screen.getByTestId("status-colors")).toHaveTextContent("0 colours");
    expect(screen.getByTestId("menu-redo")).toBeEnabled();

    await user.click(screen.getByTestId("menu-redo"));
    expect(screen.getByTestId("status-colors")).toHaveTextContent("1 colours");
  });

  it("adding a layer is undoable", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId("layer-add"));
    expect(screen.getByTestId("status-layers")).toHaveTextContent("2 layer(s)");
    await user.click(screen.getByTestId("menu-undo"));
    expect(screen.getByTestId("status-layers")).toHaveTextContent("1 layer(s)");
  });

  it("undoes via Ctrl+Z keyboard shortcut", async () => {
    const user = userEvent.setup();
    render(<App />);
    drawDot();
    expect(screen.getByTestId("status-colors")).toHaveTextContent("1 colours");
    await user.keyboard("{Control>}z{/Control}");
    expect(screen.getByTestId("status-colors")).toHaveTextContent("0 colours");
  });
});
