/**
 * GIF codec. Decodes 87a/89a GIFs to RGBA (rendering each frame onto the
 * logical screen, honouring the transparent-colour index) and encodes a single
 * indexed frame with a global colour table. Ported from the legacy GIF reader;
 * uses the shared {@link BinaryStream} and {@link LZW} codec.
 */
import { BinaryStream, type ColorArray } from "@dpaint/util";
import LZW from "./lzw.js";

export interface GifFrame {
  left: number;
  top: number;
  width: number;
  height: number;
  /** RGBA buffer of the full logical screen, width*height*4. */
  data: Uint8ClampedArray;
}

export interface DecodedGIF {
  width: number;
  height: number;
  palette: ColorArray[];
  frames: GifFrame[];
}

export interface GifEncodeInput {
  width: number;
  height: number;
  /** Palette index per pixel, width*height. */
  pixels: ArrayLike<number>;
  palette: ColorArray[];
  /** Optional transparent palette index. */
  transparentIndex?: number;
}

function readPalette(file: BinaryStream, count: number): ColorArray[] {
  const palette: ColorArray[] = [];
  for (let i = 0; i < count; i++) {
    palette.push([file.readUbyte(), file.readUbyte(), file.readUbyte()]);
  }
  return palette;
}

/** Decode a GIF byte stream into RGBA frames. */
export function decodeGIF(bytes: Uint8Array): DecodedGIF {
  // copy into a fresh, exact-size ArrayBuffer (avoids offset/SharedArrayBuffer issues)
  const file = new BinaryStream(new Uint8Array(bytes).buffer, false);
  const id = file.readString(3, 0);
  if (id !== "GIF") throw new Error("Not a GIF file");
  file.goto(3);
  const version = file.readString(3);
  if (version !== "87a" && version !== "89a") throw new Error("Unsupported GIF version");

  const width = file.readWord();
  const height = file.readWord();
  const packed = file.readUbyte();
  const gctFlag = (packed & 0b10000000) !== 0;
  const gctSize = packed & 0b00000111;
  const gctColorCount = 1 << (gctSize + 1);
  file.readUbyte(); // background colour index
  file.readUbyte(); // pixel aspect ratio

  let globalPalette: ColorArray[] = [];
  if (gctFlag) globalPalette = readPalette(file, gctColorCount);

  const frames: GifFrame[] = [];
  let transparentIndex = -1;
  let hasTransparency = false;

  const skipSubBlocks = () => {
    let size: number;
    do {
      size = file.readUbyte();
      file.jump(size);
    } while (size > 0 && !file.isEOF());
  };

  let guard = 0;
  for (;;) {
    if (file.isEOF() || guard++ > 100000) break;
    const blockId = file.readUbyte();
    if (blockId === 0x3b) break; // trailer

    if (blockId === 0x21) {
      // extension
      const label = file.readUbyte();
      if (label === 0xf9) {
        file.readUbyte(); // block size (4)
        const gce = file.readUbyte();
        hasTransparency = (gce & 0b00000001) !== 0;
        file.readWord(); // delay time
        const ti = file.readUbyte();
        transparentIndex = hasTransparency ? ti : -1;
        file.readUbyte(); // terminator
      } else {
        skipSubBlocks();
      }
    } else if (blockId === 0x2c) {
      // image descriptor
      const left = file.readWord();
      const top = file.readWord();
      const fw = file.readWord();
      const fh = file.readWord();
      const ipacked = file.readUbyte();
      const lctFlag = (ipacked & 0b10000000) !== 0;
      const lctSize = ipacked & 0b00000111;
      let palette = globalPalette;
      if (lctFlag) palette = readPalette(file, 1 << (lctSize + 1));

      const minCodeSize = file.readUbyte();
      const lzwData: number[] = [];
      let size: number;
      do {
        size = file.readUbyte();
        for (let i = 0; i < size; i++) lzwData.push(file.readUbyte());
      } while (size > 0);

      const indexed = LZW.decode(lzwData, minCodeSize, fw * fh);
      const data = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < fh; y++) {
        for (let x = 0; x < fw; x++) {
          const idx = indexed[y * fw + x]!;
          const px = left + x;
          const py = top + y;
          if (px >= width || py >= height) continue;
          const o = (py * width + px) * 4;
          const color = palette[idx] ?? [0, 0, 0];
          data[o] = color[0]!;
          data[o + 1] = color[1]!;
          data[o + 2] = color[2]!;
          data[o + 3] = transparentIndex === idx ? 0 : 255;
        }
      }
      frames.push({ left, top, width: fw, height: fh, data });
    } else {
      break; // unknown block, stop
    }
  }

  return { width, height, palette: globalPalette, frames };
}

function colorDepthFor(paletteLength: number): number {
  let depth = 1;
  while (1 << depth < paletteLength) depth++;
  return depth;
}

/** Encode a single indexed frame as a GIF89a byte stream. */
export function encodeGIF(input: GifEncodeInput): Uint8Array {
  const { width, height, pixels, palette } = input;
  const depth = colorDepthFor(palette.length);
  const gctSize = depth - 1;
  const colorCount = 1 << depth;
  const lzw = LZW.encode(pixels, width, height, depth);

  const size = 6 + 7 + colorCount * 3 + 10 + lzw.length + 1;
  const file = new BinaryStream(new ArrayBuffer(size), false);

  file.writeString("GIF89a");
  file.writeWord(width);
  file.writeWord(height);
  file.writeUbyte(0x80 | 0x70 | gctSize); // GCT flag, colour res 7, GCT size
  file.writeUbyte(0); // background colour index
  file.writeUbyte(0); // aspect ratio

  for (let i = 0; i < colorCount; i++) {
    const c = palette[i] ?? [0, 0, 0];
    file.writeUbyte(c[0]!);
    file.writeUbyte(c[1]!);
    file.writeUbyte(c[2]!);
  }

  file.writeUbyte(0x2c); // image separator
  file.writeWord(0); // left
  file.writeWord(0); // top
  file.writeWord(width);
  file.writeWord(height);
  file.writeUbyte(0); // no local colour table

  file.writeByteArray(lzw);
  file.writeUbyte(0x3b); // trailer

  return new Uint8Array(file.buffer);
}

const GIF = { decodeGIF, encodeGIF };
export default GIF;
