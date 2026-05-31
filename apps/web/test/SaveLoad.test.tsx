import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { ImageDocument } from "../src/model/ImageDocument";
import { serializeToString } from "../src/model/serialization";

describe("Save project", () => {
  let created: Blob[] = [];
  beforeEach(() => {
    created = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return "blob:mock";
    }) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    // jsdom anchors don't navigate; stub click to a no-op
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("creates a JSON blob with the dpaintjs project payload", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId("menu-save"));
    expect(created).toHaveLength(1);
    const text = await created[0]!.text();
    const parsed = JSON.parse(text);
    expect(parsed.format).toBe("dpaintjs");
    expect(parsed.width).toBe(64);
    expect(parsed.height).toBe(48);
  });
});

describe("Load project", () => {
  it("replaces the document from an uploaded project file", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByTestId("status-size")).toHaveTextContent("64×48");

    // build a distinct 10x6 project with two layers
    const doc = new ImageDocument({ width: 10, height: 6 });
    doc.addLayer("Imported");
    const json = serializeToString(doc);
    const file = new File([json], "project.dpaint.json", { type: "application/json" });

    const input = screen.getByTestId("file-input") as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByTestId("status-size")).toHaveTextContent("10×6");
    });
    expect(screen.getByTestId("status-layers")).toHaveTextContent("2 layer(s)");
  });
});
