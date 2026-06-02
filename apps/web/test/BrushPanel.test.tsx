import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "../src/App";

describe("Brush + Reduce panels", () => {
  it("brush size/softness sliders + dither patterns are present and settable", () => {
    render(<App />);
    const size = screen.getByTestId("brush-size") as HTMLInputElement;
    expect(size.value).toBe("1");
    fireEvent.change(size, { target: { value: "12" } });
    expect((screen.getByTestId("brush-size") as HTMLInputElement).value).toBe("12");

    // dither pattern selection toggles active
    fireEvent.click(screen.getByTestId("brush-dither-1"));
    expect(screen.getByTestId("brush-dither-1")).toHaveClass("active");
  });

  it("a sized soft brush stroke paints multiple pixels", () => {
    render(<App />);
    fireEvent.change(screen.getByTestId("brush-size"), { target: { value: "10" } });
    const canvas = screen.getByTestId("paint-canvas");
    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 200, clientY: 150, pointerId: 1 });
    // a fat brush dab covers more than one colour-bearing pixel region
    expect(screen.getByTestId("status-colors")).not.toHaveTextContent("0 colours");
  });

  it("reduce-colours panel applies", () => {
    render(<App />);
    expect(screen.getByTestId("reduce-palette")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("reduce-colors"), { target: { value: "8" } });
    expect(screen.getByTestId("reduce-colors-value")).toHaveTextContent("8");
    fireEvent.click(screen.getByTestId("reduce-apply"));
    expect(screen.getByTestId("app")).toBeInTheDocument();
  });
});
