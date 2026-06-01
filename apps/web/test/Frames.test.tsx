import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";

describe("Frames timeline", () => {
  it("starts with a single frame", () => {
    render(<App />);
    expect(screen.getByTestId("frame-indicator")).toHaveTextContent("1/1");
    expect(screen.getByTestId("frame-delete")).toBeDisabled();
  });

  it("adds and deletes frames", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId("frame-add"));
    expect(screen.getByTestId("frame-indicator")).toHaveTextContent("2/2");
    await user.click(screen.getByTestId("frame-duplicate"));
    expect(screen.getByTestId("frame-indicator")).toHaveTextContent("3/3");
    await user.click(screen.getByTestId("frame-delete"));
    expect(screen.getByTestId("frame-indicator")).toHaveTextContent("2/2");
  });

  it("switches the active frame by clicking a cell", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId("frame-add")); // now 2 frames, active 2
    await user.click(screen.getByTestId("frame-cell-0"));
    expect(screen.getByTestId("frame-indicator")).toHaveTextContent("1/2");
    expect(screen.getByTestId("frame-cell-0")).toHaveClass("active");
  });
});
