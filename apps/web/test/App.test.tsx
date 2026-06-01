import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";

function setup() {
  return { user: userEvent.setup(), ...render(<App />) };
}

describe("App shell", () => {
  it("renders the major regions", () => {
    setup();
    expect(screen.getByTestId("menubar")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("palette")).toBeInTheDocument();
    expect(screen.getByTestId("paint-canvas")).toBeInTheDocument();
    expect(screen.getByTestId("layer-panel")).toBeInTheDocument();
    expect(screen.getByTestId("statusbar")).toBeInTheDocument();
  });

  it("shows initial document dimensions and one layer", () => {
    setup();
    expect(screen.getByTestId("status-size")).toHaveTextContent("64×48");
    expect(screen.getByTestId("status-layers")).toHaveTextContent("1 layer(s)");
  });
});

describe("Tool selection", () => {
  it("defaults to pencil and switches on click", async () => {
    const { user } = setup();
    expect(screen.getByTestId("tool-pencil")).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByTestId("tool-fill"));
    expect(screen.getByTestId("tool-fill")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("tool-pencil")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("status-tool")).toHaveTextContent("Fill");
  });

  it("selects tools via keyboard shortcut", async () => {
    const { user } = setup();
    await user.keyboard("l");
    expect(screen.getByTestId("tool-line")).toHaveAttribute("aria-pressed", "true");
    await user.keyboard("r");
    expect(screen.getByTestId("tool-rect")).toHaveAttribute("aria-pressed", "true");
    await user.keyboard("e");
    expect(screen.getByTestId("tool-ellipse")).toHaveAttribute("aria-pressed", "true");
  });

  it("exposes the full tool set including ellipse, gradient, spray and smudge", () => {
    setup();
    expect(within(screen.getByTestId("toolbar")).getAllByRole("button")).toHaveLength(13);
    expect(screen.getByTestId("tool-ellipse")).toBeInTheDocument();
    expect(screen.getByTestId("tool-fillellipse")).toBeInTheDocument();
    expect(screen.getByTestId("tool-gradient")).toBeInTheDocument();
    expect(screen.getByTestId("tool-spray")).toBeInTheDocument();
    expect(screen.getByTestId("tool-smudge")).toBeInTheDocument();
  });
});

describe("Palette", () => {
  it("renders 16 palette colours", () => {
    setup();
    const grid = screen.getByTestId("palette-grid");
    expect(within(grid).getAllByRole("button")).toHaveLength(16);
  });

  it("sets the foreground colour when a swatch is clicked", async () => {
    const { user } = setup();
    const fg = screen.getByTestId("swatch-foreground");
    await user.click(screen.getByTestId("palette-color-2")); // [136,0,0]
    expect(fg).toHaveStyle({ background: "rgb(136, 0, 0)" });
  });

  it("swaps foreground and background colours", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("palette-color-2")); // fg -> dark red
    const fgBefore = screen.getByTestId("swatch-foreground").getAttribute("style");
    const bgBefore = screen.getByTestId("swatch-background").getAttribute("style");
    await user.click(screen.getByTestId("swap-colors"));
    expect(screen.getByTestId("swatch-foreground").getAttribute("style")).toBe(bgBefore);
    expect(screen.getByTestId("swatch-background").getAttribute("style")).toBe(fgBefore);
  });
});

describe("Menu / zoom commands via EventBus", () => {
  it("zooms in and out", async () => {
    const { user } = setup();
    expect(screen.getByTestId("zoom-label")).toHaveTextContent("8×");
    await user.click(screen.getByTestId("menu-zoomin"));
    expect(screen.getByTestId("zoom-label")).toHaveTextContent("9×");
    await user.click(screen.getByTestId("menu-zoomout"));
    await user.click(screen.getByTestId("menu-zoomout"));
    expect(screen.getByTestId("zoom-label")).toHaveTextContent("7×");
  });

  it("adds a layer through the menu (bus command)", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("menu-newlayer"));
    expect(screen.getByTestId("status-layers")).toHaveTextContent("2 layer(s)");
  });

  it("scales the image up and down", async () => {
    const { user } = setup();
    expect(screen.getByTestId("status-size")).toHaveTextContent("64×48");
    await user.click(screen.getByTestId("menu-scale-up"));
    expect(screen.getByTestId("status-size")).toHaveTextContent("128×96");
    await user.click(screen.getByTestId("menu-scale-down"));
    expect(screen.getByTestId("status-size")).toHaveTextContent("64×48");
  });
});

describe("Layer panel", () => {
  it("adds and removes layers", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("layer-add"));
    await user.click(screen.getByTestId("layer-add"));
    expect(screen.getByTestId("status-layers")).toHaveTextContent("3 layer(s)");
    await user.click(screen.getByTestId("layer-remove-2"));
    expect(screen.getByTestId("status-layers")).toHaveTextContent("2 layer(s)");
  });

  it("toggles layer visibility", async () => {
    const { user } = setup();
    const toggle = screen.getByTestId("layer-visibility-0");
    expect(toggle).toHaveTextContent("👁");
    await user.click(toggle);
    expect(screen.getByTestId("layer-visibility-0")).toHaveTextContent("—");
  });
});
