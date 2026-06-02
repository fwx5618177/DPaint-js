import { describe, it, expect } from "vitest";
import { render, act } from "@testing-library/react";
import { EditorProvider, useEditor, type EditorApi } from "../src/state/EditorContext";

function u32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}
function u16(n: number): number[] {
  return [(n >>> 8) & 0xff, n & 0xff];
}
const fourcc = (s: string) => [...s].map((c) => c.charCodeAt(0));
function chunk(name: string, data: number[]): number[] {
  const body = [...fourcc(name), ...u32(data.length), ...data];
  if (data.length & 1) body.push(0);
  return body;
}
function form(type: string, chunks: number[]): number[] {
  const inner = [...fourcc(type), ...chunks];
  return [...fourcc("FORM"), ...u32(inner.length), ...inner];
}

function buildAnim(): Uint8Array {
  const bmhd = chunk("BMHD", [
    ...u16(8), ...u16(2), ...u16(0), ...u16(0), 1, 0, 0, 0, ...u16(0),
    ...u16(0), 11, 11, ...u16(8), ...u16(2),
  ]);
  const cmap = chunk("CMAP", [0, 0, 0, 255, 255, 255]);
  const body = chunk("BODY", [0xff, 0x00, 0x00, 0x00]);
  const frame0 = form("ILBM", [...bmhd, ...cmap, ...body]);
  const anhd = chunk("ANHD", [
    5, 0, ...u16(8), ...u16(2), ...u16(0), ...u16(0),
    ...u32(0), ...u32(0), 0, 0, 0, 0,
  ]);
  const dlta = chunk("DLTA", [
    ...u32(32), ...u32(0), ...u32(0), ...u32(0), ...u32(0), ...u32(0), ...u32(0), ...u32(0),
    0x02, 0x01, 0x81, 0xff, 0x00,
  ]);
  const frame1 = form("ILBM", [...anhd, ...dlta]);
  return new Uint8Array(form("ANIM", [...frame0, ...frame1]));
}

function Harness({ apiRef }: { apiRef: { current: EditorApi | null } }) {
  apiRef.current = useEditor();
  return null;
}

describe("Loading an IFF ANIM", () => {
  it("creates a multi-frame document", async () => {
    const apiRef: { current: EditorApi | null } = { current: null };
    render(
      <EditorProvider width={4} height={4}>
        <Harness apiRef={apiRef} />
      </EditorProvider>,
    );
    await act(async () => {
      await apiRef.current!.loadImageBytes(buildAnim(), "movie.anim");
    });
    const doc = apiRef.current!.doc;
    expect(doc.frameCount).toBe(2);
    expect(doc.width).toBe(8);
    expect(doc.height).toBe(2);
  });
});
