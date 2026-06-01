import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BinaryStream } from "@dpaint/primitives";
import App from "../src/App";

/** Build a tiny raw 8-bit RGB PSD. */
function buildPsd(width: number, height: number): Uint8Array {
  const n = width * height;
  const total = 26 + 4 + 4 + 4 + 2 + n * 3;
  const f = new BinaryStream(new ArrayBuffer(total), true);
  f.writeString("8BPS");
  f.writeWord(1);
  f.fill(0, 6);
  f.writeWord(3);
  f.writeUint(height);
  f.writeUint(width);
  f.writeWord(8);
  f.writeWord(3);
  f.writeUint(0);
  f.writeUint(0);
  f.writeUint(0);
  f.writeWord(0);
  for (let c = 0; c < 3; c++) for (let i = 0; i < n; i++) f.writeUbyte(c === 0 ? 200 : 0);
  return new Uint8Array(f.buffer);
}

describe("PSD import", () => {
  it("loads a PSD file into a document of matching size", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByTestId("status-size")).toHaveTextContent("64×48");

    const psd = buildPsd(9, 7);
    const file = new File([psd as unknown as BlobPart], "art.psd", {
      type: "application/octet-stream",
    });
    await user.upload(screen.getByTestId("file-input") as HTMLInputElement, file);

    await waitFor(() => {
      expect(screen.getByTestId("status-size")).toHaveTextContent("9×7");
    });
    expect(screen.getByTestId("status-colors")).toHaveTextContent("1 colours");
  });
});
