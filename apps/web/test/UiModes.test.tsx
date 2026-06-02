import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "../src/App";

describe("UI modes", () => {
  beforeEach(() => localStorage.clear());

  it("toggles the side panel", () => {
    render(<App />);
    expect(screen.getByTestId("sidepanel")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("menu-sidepanel"));
    expect(screen.queryByTestId("sidepanel")).toBeNull();
  });

  it("enters and exits presentation mode (hiding the menu)", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("menu-presentation"));
    expect(screen.getByTestId("app")).toHaveAttribute("data-presentation", "true");
    // menu is hidden; exit via the floating button
    expect(screen.queryByTestId("menu-presentation")).toBeNull();
    fireEvent.click(screen.getByTestId("presentation-exit"));
    expect(screen.getByTestId("app")).toHaveAttribute("data-presentation", "false");
  });

  it("toggles split-screen (two canvases)", () => {
    render(<App />);
    expect(screen.getByTestId("tool-split")).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByTestId("tool-split"));
    expect(screen.getByTestId("tool-split")).toHaveAttribute("aria-pressed", "true");
  });

  it("opens About and Preferences dialogs", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("menu-about"));
    expect(screen.getByTestId("about-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("about-close"));
    expect(screen.queryByTestId("about-dialog")).toBeNull();

    fireEvent.click(screen.getByTestId("menu-preferences"));
    expect(screen.getByTestId("preferences-dialog")).toBeInTheDocument();
  });

  it("persists a preference change to localStorage", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("menu-preferences"));
    const checkbox = screen.getByTestId("pref-useMultiPalettes") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(JSON.parse(localStorage.getItem("dp_settings")!).useMultiPalettes).toBe(true);
  });
});
