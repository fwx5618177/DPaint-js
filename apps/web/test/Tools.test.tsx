import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";

describe("New tools", () => {
  it("eraser clears painted pixels", async () => {
    const user = userEvent.setup();
    render(<App />);
    const canvas = screen.getByTestId("paint-canvas");

    // pencil (default) paints one pixel
    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
    expect(screen.getByTestId("status-colors")).toHaveTextContent("1 colours");

    // eraser removes it
    await user.click(screen.getByTestId("tool-eraser"));
    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
    expect(screen.getByTestId("status-colors")).toHaveTextContent("0 colours");
  });

  it("arc draws after two clicks (chord then waypoint)", async () => {
    const user = userEvent.setup();
    render(<App />);
    const canvas = screen.getByTestId("paint-canvas");
    await user.click(screen.getByTestId("tool-arc"));

    // first drag: chord endpoints
    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 80, clientY: 0, pointerId: 1 });
    // nothing drawn yet
    expect(screen.getByTestId("status-colors")).toHaveTextContent("0 colours");

    // second click: waypoint -> commit
    fireEvent.pointerDown(canvas, { clientX: 40, clientY: 80, pointerId: 1 });
    expect(screen.getByTestId("status-colors")).not.toHaveTextContent("0 colours");
  });

  it("magic-wand selects, enabling a crop", async () => {
    const user = userEvent.setup();
    render(<App />);
    const canvas = screen.getByTestId("paint-canvas");
    // paint a couple of pixels
    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 0, clientY: 0, pointerId: 1 });

    await user.click(screen.getByTestId("tool-wandselect"));
    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
    // a selection now exists -> crop reduces the document; no throw
    await user.click(screen.getByTestId("menu-crop"));
    expect(screen.getByTestId("app")).toBeInTheDocument();
  });
});

describe("Selection menu", () => {
  it("exposes invert / by-colour / alpha / not-palette / layer selection", () => {
    render(<App />);
    expect(screen.getByTestId("menu-select-invert")).toBeInTheDocument();
    expect(screen.getByTestId("menu-select-color")).toBeInTheDocument();
    expect(screen.getByTestId("menu-select-alpha")).toBeInTheDocument();
    expect(screen.getByTestId("menu-select-notpalette")).toBeInTheDocument();
    expect(screen.getByTestId("menu-select-layer")).toBeInTheDocument();
  });

  it("invert selection runs without error", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("menu-select-invert"));
    expect(screen.getByTestId("app")).toBeInTheDocument();
  });
});
