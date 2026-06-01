import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { encodeGIF } from "@dpaint/fileformats";
import type { ColorArray } from "@dpaint/util";
import App from "../src/App";

const PALETTE: ColorArray[] = [
  [0, 0, 0],
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
];

describe("GIF import", () => {
  it("loads a GIF file into a new document of matching size", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByTestId("status-size")).toHaveTextContent("64×48");

    const w = 10;
    const h = 8;
    const pixels = Array.from({ length: w * h }, (_, i) => i % 4);
    const gif = encodeGIF({ width: w, height: h, pixels, palette: PALETTE });
    const file = new File([gif as unknown as BlobPart], "art.gif", { type: "image/gif" });

    await user.upload(screen.getByTestId("file-input") as HTMLInputElement, file);

    await waitFor(() => {
      expect(screen.getByTestId("status-size")).toHaveTextContent("10×8");
    });
    // four palette colours used in the pattern
    expect(screen.getByTestId("status-colors")).toHaveTextContent("4 colours");
  });
});
