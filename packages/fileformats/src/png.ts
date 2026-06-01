/**
 * PNG codec — encode RGBA images to PNG and decode common PNG variants back to
 * RGBA. A clean-room TypeScript reimplementation that uses the platform zlib
 * helpers in {@link ./zlib} instead of the vendored minified library.
 *
 * Encoding: 8-bit truecolour-with-alpha (colour type 6), filter "None".
 * Decoding: 8-bit colour types 0 (grey), 2 (RGB), 3 (palette) and 6 (RGBA),
 * with all five scanline filters. Interlaced PNGs are not supported.
 */
import { CRC32 } from "@dpaint/util";
import { deflate, inflate } from "./zlib.js";

export interface RasterImage {
  width: number;
  height: number;
  /** RGBA pixel buffer, width*height*4. */
  data: Uint8Array | Uint8ClampedArray;
}

export interface DecodedPNG {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function u32be(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function chunkTypeBytes(type: string): number[] {
  return [type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)];
}

function writeChunk(out: number[], type: string, data: number[] | Uint8Array): void {
  out.push(...u32be(data.length));
  const typeBytes = chunkTypeBytes(type);
  const body = [...typeBytes, ...Array.from(data)];
  out.push(...body);
  out.push(...u32be(CRC32.get(body)));
}

/** Encode an RGBA image to a PNG byte stream. */
export async function encodePNG(image: RasterImage): Promise<Uint8Array> {
  const { width, height } = image;
  const src = image.data;

  // raw = per scanline: filter byte (0 = None) followed by the RGBA row
  const stride = width * 4;
  const raw = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const rawRow = y * (stride + 1);
    raw[rawRow] = 0; // filter: None
    raw.set(src.subarray(y * stride, y * stride + stride), rawRow + 1);
  }

  const compressed = await deflate(raw);

  const out: number[] = [...SIGNATURE];
  writeChunk(out, "IHDR", [
    ...u32be(width),
    ...u32be(height),
    8, // bit depth
    6, // colour type: truecolour + alpha
    0, // compression
    0, // filter
    0, // interlace
  ]);
  writeChunk(out, "IDAT", compressed);
  writeChunk(out, "IEND", []);
  return new Uint8Array(out);
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

interface Chunk {
  type: string;
  data: Uint8Array;
}

function readChunks(bytes: Uint8Array): Chunk[] {
  const chunks: Chunk[] = [];
  let i = SIGNATURE.length;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (i + 8 <= bytes.length) {
    const length = view.getUint32(i);
    i += 4;
    const type = String.fromCharCode(bytes[i]!, bytes[i + 1]!, bytes[i + 2]!, bytes[i + 3]!);
    i += 4;
    const data = bytes.subarray(i, i + length);
    i += length;
    i += 4; // skip CRC
    chunks.push({ type, data });
    if (type === "IEND") break;
  }
  return chunks;
}

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** Decode a PNG byte stream into an RGBA image. */
export async function decodePNG(bytes: Uint8Array): Promise<DecodedPNG> {
  for (let i = 0; i < SIGNATURE.length; i++) {
    if (bytes[i] !== SIGNATURE[i]) throw new Error("Not a PNG file");
  }
  const chunks = readChunks(bytes);
  const ihdr = chunks.find((c) => c.type === "IHDR");
  if (!ihdr) throw new Error("PNG missing IHDR");

  const ih = new DataView(ihdr.data.buffer, ihdr.data.byteOffset, ihdr.data.byteLength);
  const width = ih.getUint32(0);
  const height = ih.getUint32(4);
  const bitDepth = ihdr.data[8]!;
  const colorType = ihdr.data[9]!;
  const interlace = ihdr.data[12]!;
  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth: ${bitDepth}`);
  if (interlace !== 0) throw new Error("Interlaced PNG is not supported");
  const channels = CHANNELS[colorType];
  if (!channels) throw new Error(`Unsupported PNG colour type: ${colorType}`);

  const palette = chunks.find((c) => c.type === "PLTE")?.data;
  const trns = chunks.find((c) => c.type === "tRNS")?.data;

  const idatTotal = chunks.filter((c) => c.type === "IDAT").reduce((n, c) => n + c.data.length, 0);
  const idat = new Uint8Array(idatTotal);
  {
    let o = 0;
    for (const c of chunks) {
      if (c.type === "IDAT") {
        idat.set(c.data, o);
        o += c.data.length;
      }
    }
  }

  const raw = await inflate(idat);

  // Unfilter scanlines in place.
  const bpp = channels; // bytes per pixel (8-bit)
  const stride = width * channels;
  const pixels = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const rawRow = y * (stride + 1) + 1;
    const outRow = y * stride;
    for (let x = 0; x < stride; x++) {
      const rawVal = raw[rawRow + x]!;
      const a = x >= bpp ? pixels[outRow + x - bpp]! : 0;
      const b = y > 0 ? pixels[outRow - stride + x]! : 0;
      const c = y > 0 && x >= bpp ? pixels[outRow - stride + x - bpp]! : 0;
      let value: number;
      switch (filter) {
        case 0:
          value = rawVal;
          break;
        case 1:
          value = rawVal + a;
          break;
        case 2:
          value = rawVal + b;
          break;
        case 3:
          value = rawVal + ((a + b) >> 1);
          break;
        case 4:
          value = rawVal + paeth(a, b, c);
          break;
        default:
          throw new Error(`Unsupported PNG filter: ${filter}`);
      }
      pixels[outRow + x] = value & 0xff;
    }
  }

  // Expand to RGBA.
  const out = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const di = p * 4;
    if (colorType === 6) {
      const si = p * 4;
      out[di] = pixels[si]!;
      out[di + 1] = pixels[si + 1]!;
      out[di + 2] = pixels[si + 2]!;
      out[di + 3] = pixels[si + 3]!;
    } else if (colorType === 2) {
      const si = p * 3;
      out[di] = pixels[si]!;
      out[di + 1] = pixels[si + 1]!;
      out[di + 2] = pixels[si + 2]!;
      out[di + 3] = 255;
    } else if (colorType === 0) {
      const v = pixels[p]!;
      out[di] = v;
      out[di + 1] = v;
      out[di + 2] = v;
      out[di + 3] = 255;
    } else if (colorType === 4) {
      const si = p * 2;
      const v = pixels[si]!;
      out[di] = v;
      out[di + 1] = v;
      out[di + 2] = v;
      out[di + 3] = pixels[si + 1]!;
    } else {
      // colour type 3: palette index
      const idx = pixels[p]!;
      out[di] = palette ? palette[idx * 3]! : 0;
      out[di + 1] = palette ? palette[idx * 3 + 1]! : 0;
      out[di + 2] = palette ? palette[idx * 3 + 2]! : 0;
      out[di + 3] = trns && idx < trns.length ? trns[idx]! : 255;
    }
  }

  return { width, height, data: out };
}

const PNG = { encodePNG, decodePNG };
export default PNG;
