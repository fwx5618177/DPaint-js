import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { encodePNG } from "@dpaint/codecs";
import App from "../src/App";

const SECTOR = 512;

/**
 * Build a minimal OFS ADF holding `files` (each small enough to fit in one
 * 488-byte OFS data block). Root at sector 4; headers/data follow.
 */
function buildOfsAdf(files: { name: string; bytes: Uint8Array }[]): Uint8Array {
  // AdfDisk derives rootSector = floor(sectorCount/2); size the disk so the
  // root lands just past the boot block with room for <hdr,data> per file after.
  const root = 1 + files.length * 2;
  const sectorCount = 2 + files.length * 4; // => floor(sectorCount/2) === root
  const buf = new Uint8Array(sectorCount * SECTOR);
  const view = new DataView(buf.buffer);
  const setLong = (offset: number, value: number) => view.setUint32(offset, value >>> 0);
  const setName = (sector: number, name: string) => {
    const o = sector * SECTOR + SECTOR - 80;
    buf[o] = name.length;
    for (let i = 0; i < name.length; i++) buf[o + 1 + i] = name.charCodeAt(i);
  };

  buf[0] = 0x44; // D
  buf[1] = 0x4f; // O
  buf[2] = 0x53; // S
  buf[3] = 0x00; // OFS

  setLong(root * SECTOR, 2); // header type
  setName(root, "DISK");

  let sector = root + 1;
  files.forEach((file, i) => {
    const hdr = sector++;
    const data = sector++;
    setLong(root * SECTOR + 24 + i * 4, hdr); // distinct hash slot per file

    setLong(hdr * SECTOR + 0, 2); // header type
    setLong(hdr * SECTOR + 16, data); // firstDataBlock
    setLong(hdr * SECTOR + SECTOR - 188, file.bytes.length); // size
    setLong(hdr * SECTOR + SECTOR - 16, 0); // linkedSector
    setLong(hdr * SECTOR + SECTOR - 4, 0xfffffffd); // secondaryType FILE
    setName(hdr, file.name);

    const db = data * SECTOR;
    setLong(db + 0, 8); // data block type
    setLong(db + 4, hdr); // header sector
    setLong(db + 8, 1); // block number
    setLong(db + 12, file.bytes.length); // data size
    setLong(db + 16, 0); // next data block
    buf.set(file.bytes, db + 24);
  });

  return buf;
}

function adfFile(bytes: Uint8Array): File {
  return new File([bytes as unknown as BlobPart], "disk.adf", { type: "application/octet-stream" });
}

async function tinyPng(): Promise<Uint8Array> {
  const data = new Uint8Array(2 * 2 * 4).fill(200);
  return encodePNG({ width: 2, height: 2, data });
}

describe("ADF file browser", () => {
  it("lists multiple images and opens the picked one", async () => {
    const png = await tinyPng();
    expect(png.length).toBeLessThan(488); // fits one OFS data block
    const adf = buildOfsAdf([
      { name: "ALPHA.png", bytes: png },
      { name: "BETA.png", bytes: png },
    ]);

    render(<App />);
    const input = screen.getByTestId("file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [adfFile(adf)] } });

    const browser = await screen.findByTestId("file-browser");
    expect(browser).toBeTruthy();
    expect(screen.getByTestId("file-browser-entry-ALPHA.png")).toBeTruthy();
    expect(screen.getByTestId("file-browser-entry-BETA.png")).toBeTruthy();

    fireEvent.click(screen.getByTestId("file-browser-entry-BETA.png"));

    // After opening, the browser closes and the doc is the 2x2 image.
    await waitFor(() => {
      expect(screen.queryByTestId("file-browser")).toBeNull();
    });
  });

  it("opens a single-image disk directly without a picker", async () => {
    const png = await tinyPng();
    const adf = buildOfsAdf([{ name: "ONLY.png", bytes: png }]);

    render(<App />);
    const input = screen.getByTestId("file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [adfFile(adf)] } });

    // No picker should ever appear for a single image.
    await waitFor(() => {
      const stage = screen.getByTestId("app");
      expect(stage).toBeTruthy();
    });
    expect(screen.queryByTestId("file-browser")).toBeNull();
  });

  it("cancels the picker", async () => {
    const png = await tinyPng();
    const adf = buildOfsAdf([
      { name: "ALPHA.png", bytes: png },
      { name: "BETA.png", bytes: png },
    ]);

    render(<App />);
    const input = screen.getByTestId("file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [adfFile(adf)] } });

    await screen.findByTestId("file-browser");
    fireEvent.click(screen.getByTestId("file-browser-cancel"));
    await waitFor(() => {
      expect(screen.queryByTestId("file-browser")).toBeNull();
    });
  });
});
