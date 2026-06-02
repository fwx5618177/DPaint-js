import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "../src/App";

describe("Layer panel operations", () => {
  it("adds, duplicates, reorders, merges and flattens layers", () => {
    render(<App />);
    // start with one layer
    expect(screen.getByTestId("layer-row-0")).toBeTruthy();

    fireEvent.click(screen.getByTestId("layer-add"));
    expect(screen.getByTestId("layer-row-1")).toBeTruthy();

    // duplicate layer 1 -> now 3 layers
    fireEvent.click(screen.getByTestId("layer-duplicate-1"));
    expect(screen.getByTestId("layer-row-2")).toBeTruthy();

    // move layer 0 up
    fireEvent.click(screen.getByTestId("layer-up-0"));
    expect(screen.getByTestId("layer-row-2")).toBeTruthy();

    // merge top layer down -> back to 2 layers (row-2 gone)
    fireEvent.click(screen.getByTestId("layer-merge-2"));
    expect(screen.queryByTestId("layer-row-2")).toBeNull();

    // flatten -> single layer
    fireEvent.click(screen.getByTestId("layer-flatten"));
    expect(screen.queryByTestId("layer-row-1")).toBeNull();
    expect(screen.getByTestId("layer-row-0")).toBeTruthy();
  });
});
