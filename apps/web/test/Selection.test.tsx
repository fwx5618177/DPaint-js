import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";

describe("Selection + clipboard", () => {
  it("exposes copy/cut/paste; paste is disabled until something is copied", () => {
    render(<App />);
    expect(screen.getByTestId("menu-copy")).toBeInTheDocument();
    expect(screen.getByTestId("menu-cut")).toBeInTheDocument();
    expect(screen.getByTestId("menu-paste")).toBeDisabled();
  });

  it("has a select tool selectable by keyboard", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.keyboard("s");
    expect(screen.getByTestId("tool-select")).toHaveAttribute("aria-pressed", "true");
  });

  it("copy enables paste, and paste applies as an undoable step", async () => {
    const user = userEvent.setup();
    render(<App />);

    // draw a pixel so there is content to copy
    const canvas = screen.getByTestId("paint-canvas");
    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 0, clientY: 0, pointerId: 1 });

    await user.click(screen.getByTestId("menu-copy"));
    expect(screen.getByTestId("menu-paste")).toBeEnabled();

    await user.click(screen.getByTestId("menu-paste"));
    expect(screen.getByTestId("menu-undo")).toBeEnabled();
  });

  it("cut clears content and fills the clipboard", async () => {
    const user = userEvent.setup();
    render(<App />);
    const canvas = screen.getByTestId("paint-canvas");
    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
    expect(screen.getByTestId("status-colors")).toHaveTextContent("1 colours");

    await user.click(screen.getByTestId("menu-cut"));
    // whole-image cut clears everything
    expect(screen.getByTestId("status-colors")).toHaveTextContent("0 colours");
    expect(screen.getByTestId("menu-paste")).toBeEnabled();
  });
});
