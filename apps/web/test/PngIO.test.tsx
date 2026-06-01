import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { encodePNG, decodePNG } from "@dpaint/codecs";
import App from "../src/App";

describe("PNG export", () => {
  let created: Blob[] = [];
  beforeEach(() => {
    created = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return "blob:mock";
    }) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("exports the document as a decodable PNG of the right size", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId("menu-export-png"));
    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]!.type).toBe("image/png");
    const bytes = new Uint8Array(await created[0]!.arrayBuffer());
    const decoded = await decodePNG(bytes);
    expect(decoded.width).toBe(64);
    expect(decoded.height).toBe(48);
  });
});

describe("PNG import", () => {
  it("loads a PNG file into a new document of matching size", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByTestId("status-size")).toHaveTextContent("64×48");

    // craft a 12x9 PNG
    const w = 12;
    const h = 9;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 200;
      data[i + 3] = 255;
    }
    const png = await encodePNG({ width: w, height: h, data });
    const file = new File([png as unknown as BlobPart], "art.png", { type: "image/png" });

    await user.upload(screen.getByTestId("file-input") as HTMLInputElement, file);

    await waitFor(() => {
      expect(screen.getByTestId("status-size")).toHaveTextContent("12×9");
    });
    // the imported solid colour counts as one colour
    expect(screen.getByTestId("status-colors")).toHaveTextContent("1 colours");
  });
});
