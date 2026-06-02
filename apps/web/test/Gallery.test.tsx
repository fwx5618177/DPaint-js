import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { encodePNG } from "@dpaint/codecs";
import App from "../src/App";

async function tinyPng(): Promise<Uint8Array> {
  const data = new Uint8Array(2 * 2 * 4).fill(180);
  return encodePNG({ width: 2, height: 2, data });
}

describe("Gallery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens, lists artwork from gallery.json, and loads a picked piece", async () => {
    const png = await tinyPng();
    const manifest = [
      { title: "Classics", description: "A section" },
      { url: "art/mona.png", title: "Mona", artist: "Leo", year: 1503, image: "art/mona-thumb.png" },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("gallery.json")) {
        return new Response(JSON.stringify(manifest), { status: 200 });
      }
      return new Response(png as unknown as BodyInit, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByTestId("menu-gallery"));

    // section + one artwork item
    const item = await screen.findByTestId("gallery-item-1");
    expect(item).toBeTruthy();
    expect(screen.getByText("Mona")).toBeTruthy();
    expect(screen.getByText("A section")).toBeTruthy();

    fireEvent.click(item);

    // After opening, the gallery closes and the artwork URL was fetched.
    await waitFor(() => {
      expect(screen.queryByTestId("gallery")).toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("art/mona.png"));
  });

  it("shows a fallback message when gallery.json is unavailable", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByTestId("menu-gallery"));

    expect(await screen.findByText("No gallery available.")).toBeTruthy();
  });

  it("toggles closed via the close button", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByTestId("menu-gallery"));
    await screen.findByTestId("gallery");
    fireEvent.click(screen.getByTestId("gallery-close"));
    await waitFor(() => {
      expect(screen.queryByTestId("gallery")).toBeNull();
    });
  });
});
