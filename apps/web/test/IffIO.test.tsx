import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { decodeILBM } from "@dpaint/fileformats";
import App from "../src/App";

const here = dirname(fileURLToPath(import.meta.url));
// reuse the fixtures bundled with the fileformats package
const fixture = resolve(
  here,
  "../../../packages/fileformats/test/fixtures/sham-16x4-ham6.ilbm",
);

describe("IFF/ILBM import", () => {
  it("loads an ILBM file into a document of matching size", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByTestId("status-size")).toHaveTextContent("64×48");

    const bytes = new Uint8Array(readFileSync(fixture));
    const file = new File([bytes as unknown as BlobPart], "art.ilbm", {
      type: "application/octet-stream",
    });

    await user.upload(screen.getByTestId("file-input") as HTMLInputElement, file);

    await waitFor(() => {
      expect(screen.getByTestId("status-size")).toHaveTextContent("16×4");
    });
  });
});

describe("IFF/ILBM export", () => {
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

  it("exports a decodable ILBM of the document size", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId("menu-export-iff"));
    expect(created).toHaveLength(1);
    const bytes = new Uint8Array(await created[0]!.arrayBuffer());
    const decoded = decodeILBM(bytes);
    expect(decoded.width).toBe(64);
    expect(decoded.height).toBe(48);
  });
});
