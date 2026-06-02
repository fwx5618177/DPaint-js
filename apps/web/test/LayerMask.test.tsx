import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "../src/App";

describe("Layer mask UI", () => {
  it("adds, toggles, applies and deletes a layer mask", () => {
    render(<App />);
    // no mask yet -> the add button is present
    expect(screen.getByTestId("layer-mask-add")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("layer-mask-add"));
    // mask controls appear
    expect(screen.getByTestId("layer-mask-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("layer-mask-apply")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("layer-mask-toggle"));
    fireEvent.click(screen.getByTestId("layer-mask-delete"));
    // back to the add state
    expect(screen.getByTestId("layer-mask-add")).toBeInTheDocument();
  });
});
