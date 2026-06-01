import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
