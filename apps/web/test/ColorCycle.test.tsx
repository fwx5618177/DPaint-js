import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import App from "../src/App";

function drawDot() {
  const canvas = screen.getByTestId("paint-canvas");
  fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
  fireEvent.pointerUp(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
}

describe("Colour cycling", () => {
  afterEach(() => vi.useRealTimers());

  it("exposes a Cycle toggle that is off by default", () => {
    render(<App />);
    const btn = screen.getByTestId("cycle-toggle");
    expect(btn).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles on, animates without crashing, and toggles back off", () => {
    vi.useFakeTimers();
    render(<App />);
    drawDot();

    const btn = screen.getByTestId("cycle-toggle");
    act(() => {
      btn.click();
    });
    expect(btn).toHaveAttribute("aria-pressed", "true");

    // advance several animation frames
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId("cycle-toggle")).toHaveAttribute("aria-pressed", "true");

    act(() => {
      screen.getByTestId("cycle-toggle").click();
    });
    expect(screen.getByTestId("cycle-toggle")).toHaveAttribute("aria-pressed", "false");
  });
});
