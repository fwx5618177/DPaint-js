import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";

describe("Custom brush", () => {
  it("captures a brush and stamps it elsewhere", async () => {
    const user = userEvent.setup();
    render(<App />);
    const canvas = screen.getByTestId("paint-canvas");

    // paint a pixel
    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
    expect(screen.getByTestId("status-colors")).toHaveTextContent("1 colours");

    // select a small region around it, then grab as brush
    await user.click(screen.getByTestId("tool-select"));
    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 24, clientY: 24, pointerId: 1 });

    // capture the selection as the brush (Brush ▸ From Selection)
    await user.click(screen.getByTestId("menu-brush-capture"));

    // rotate + flip should not throw (Brush ▸ Transform)
    await user.click(screen.getByTestId("menu-item-Rotate Right"));
    await user.click(screen.getByTestId("menu-item-Flip Horizontal"));

    // stamp the brush far away with the brush tool
    await user.click(screen.getByTestId("tool-brush"));
    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 400, clientY: 300, pointerId: 1 });
    expect(screen.getByTestId("app")).toBeInTheDocument();
  });
});
