import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";

// In the legacy-styled UI undo/redo are icon `<div>`s that use a `.disabled`
// class rather than the HTML `disabled` attribute.
const undoDisabled = () => expect(screen.getByTestId("menu-undo")).toHaveClass("disabled");
const undoEnabled = () => expect(screen.getByTestId("menu-undo")).not.toHaveClass("disabled");

describe("Image transforms & effects menu", () => {
  it("exposes flip / invert / greyscale controls", () => {
    render(<App />);
    expect(screen.getByTestId("menu-fliph")).toBeInTheDocument();
    expect(screen.getByTestId("menu-flipv")).toBeInTheDocument();
    expect(screen.getByTestId("menu-invert")).toBeInTheDocument();
    expect(screen.getByTestId("menu-grayscale")).toBeInTheDocument();
  });

  it("rotates 90° (swapping dimensions), resamples and mattes", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByTestId("status-size")).toHaveTextContent("64×48");
    await user.click(screen.getByTestId("menu-rotate-right"));
    expect(screen.getByTestId("status-size")).toHaveTextContent("48×64");
    await user.click(screen.getByTestId("menu-rotate-left"));
    expect(screen.getByTestId("status-size")).toHaveTextContent("64×48");
    await user.click(screen.getByTestId("menu-resample"));
    expect(screen.getByTestId("status-size")).toHaveTextContent("32×24");
    await user.click(screen.getByTestId("menu-matte"));
    undoEnabled();
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
    undoEnabled();
  });

  it("exposes colour-depth + alchemy filters that run undoably", async () => {
    const user = userEvent.setup();
    render(<App />);
    for (const id of ["menu-12bit", "menu-9bit", "menu-offset", "menu-smooth", "menu-sharpen"]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    await user.click(screen.getByTestId("menu-offset"));
    await user.click(screen.getByTestId("menu-smooth"));
    await user.click(screen.getByTestId("menu-sharpen"));
    await user.click(screen.getByTestId("menu-12bit"));
    undoEnabled();
  });

  it("a flip creates an undoable checkpoint", async () => {
    const user = userEvent.setup();
    render(<App />);
    undoDisabled();
    await user.click(screen.getByTestId("menu-fliph"));
    undoEnabled();
    await user.click(screen.getByTestId("menu-undo"));
    undoDisabled();
  });

  it("invert and greyscale run and are undoable", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId("menu-invert"));
    await user.click(screen.getByTestId("menu-grayscale"));
    undoEnabled();
    await user.click(screen.getByTestId("menu-undo"));
    await user.click(screen.getByTestId("menu-undo"));
    undoDisabled();
  });
});
