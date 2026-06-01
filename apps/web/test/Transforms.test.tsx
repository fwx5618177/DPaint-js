import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";

describe("Image transforms & effects menu", () => {
  it("exposes flip / invert / greyscale controls", () => {
    render(<App />);
    expect(screen.getByTestId("menu-fliph")).toBeInTheDocument();
    expect(screen.getByTestId("menu-flipv")).toBeInTheDocument();
    expect(screen.getByTestId("menu-invert")).toBeInTheDocument();
    expect(screen.getByTestId("menu-grayscale")).toBeInTheDocument();
  });

  it("exposes pixel-effect controls that run as undoable steps", async () => {
    const user = userEvent.setup();
    render(<App />);
    for (const id of ["menu-posterize", "menu-threshold", "menu-blur"]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    await user.click(screen.getByTestId("menu-posterize"));
    await user.click(screen.getByTestId("menu-threshold"));
    await user.click(screen.getByTestId("menu-blur"));
    expect(screen.getByTestId("menu-undo")).toBeEnabled();
  });

  it("exposes colour-depth + alchemy filters that run undoably", async () => {
    const user = userEvent.setup();
    render(<App />);
    for (const id of [
      "menu-depth-12",
      "menu-depth-9",
      "menu-offset",
      "menu-smooth",
      "menu-sharpen",
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    await user.click(screen.getByTestId("menu-offset"));
    await user.click(screen.getByTestId("menu-smooth"));
    await user.click(screen.getByTestId("menu-sharpen"));
    await user.click(screen.getByTestId("menu-depth-12"));
    expect(screen.getByTestId("menu-undo")).toBeEnabled();
  });

  it("a flip creates an undoable checkpoint", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByTestId("menu-undo")).toBeDisabled();
    await user.click(screen.getByTestId("menu-fliph"));
    expect(screen.getByTestId("menu-undo")).toBeEnabled();
    await user.click(screen.getByTestId("menu-undo"));
    expect(screen.getByTestId("menu-undo")).toBeDisabled();
  });

  it("invert and greyscale run and are undoable", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId("menu-invert"));
    await user.click(screen.getByTestId("menu-grayscale"));
    // two effect checkpoints recorded -> undo twice returns to the start
    expect(screen.getByTestId("menu-undo")).toBeEnabled();
    await user.click(screen.getByTestId("menu-undo"));
    await user.click(screen.getByTestId("menu-undo"));
    expect(screen.getByTestId("menu-undo")).toBeDisabled();
  });
});
