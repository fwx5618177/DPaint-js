/**
 * Palette file readers/writers: Adobe Color Table (.act) and JASC Paint Shop
 * Pro palette (.pal / .gpl-ish text). Colours are [r,g,b] triplets, 0-255.
 */
export type PaletteColor = [number, number, number];

/** Encode a palette as a 768-byte Adobe Color Table (.act), padded to 256. */
export function encodeACT(palette: PaletteColor[]): Uint8Array {
  const out = new Uint8Array(768);
  for (let i = 0; i < Math.min(256, palette.length); i++) {
    const c = palette[i]!;
    out[i * 3] = c[0] & 0xff;
    out[i * 3 + 1] = c[1] & 0xff;
    out[i * 3 + 2] = c[2] & 0xff;
  }
  return out;
}

/** Decode an Adobe Color Table (.act): 256 RGB triplets (768 bytes). */
export function decodeACT(bytes: Uint8Array): PaletteColor[] {
  const count = Math.floor(bytes.length / 3);
  const palette: PaletteColor[] = [];
  for (let i = 0; i < Math.min(256, count); i++) {
    palette.push([bytes[i * 3]!, bytes[i * 3 + 1]!, bytes[i * 3 + 2]!]);
  }
  return palette;
}

/** Encode a palette as a JASC-PAL 0100 text palette. */
export function encodeJASC(palette: PaletteColor[]): Uint8Array {
  const lines = ["JASC-PAL", "0100", String(palette.length)];
  for (const c of palette) lines.push(`${c[0]} ${c[1]} ${c[2]}`);
  return new TextEncoder().encode(lines.join("\n") + "\n");
}

/** Decode a JASC-PAL or whitespace-separated "r g b" text palette. */
export function decodeJASC(bytes: Uint8Array): PaletteColor[] {
  const text = new TextDecoder().decode(bytes);
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const palette: PaletteColor[] = [];
  let start = 0;
  if (lines[0] === "JASC-PAL") start = 3; // skip header, version, count
  for (let i = start; i < lines.length; i++) {
    const m = lines[i]!.match(/^(\d+)\s+(\d+)\s+(\d+)/);
    if (m) palette.push([Number(m[1]), Number(m[2]), Number(m[3])]);
  }
  return palette;
}

/** Detect and decode a palette file by content/extension. */
export function decodePaletteFile(bytes: Uint8Array, name = ""): PaletteColor[] {
  const lower = name.toLowerCase();
  const looksText =
    lower.endsWith(".pal") ||
    lower.endsWith(".gpl") ||
    (bytes.length >= 8 && new TextDecoder().decode(bytes.slice(0, 8)) === "JASC-PAL");
  if (looksText) {
    const pal = decodeJASC(bytes);
    if (pal.length) return pal;
  }
  // default: raw Adobe Color Table
  return decodeACT(bytes);
}
