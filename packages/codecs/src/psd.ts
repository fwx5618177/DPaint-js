/**
 * Photoshop PSD reader — decodes the merged composite image (the flattened
 * preview every PSD stores) to RGBA. Supports 8-bit grayscale (mode 1) and RGB
 * (mode 3), raw or RLE/PackBits compression. Layer data is skipped.
 */
import { BinaryStream } from "@dpaint/primitives";
import { decodeLine, type ByteSource } from "./byteRun1.js";

export interface DecodedPSD {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export function decodePSD(bytes: Uint8Array): DecodedPSD {
  const file = new BinaryStream(new Uint8Array(bytes).buffer, true); // PSD is big-endian
  if (file.readString(4, 0) !== "8BPS") throw new Error("Not a PSD file");
  if (file.readWord() !== 1) throw new Error("Unsupported PSD version");
  file.jump(6); // reserved

  const channels = file.readWord();
  const height = file.readUint();
  const width = file.readUint();
  const depth = file.readWord();
  const mode = file.readWord();
  if (depth !== 8) throw new Error(`Unsupported PSD depth: ${depth}`);
  if (mode !== 1 && mode !== 3) throw new Error(`Unsupported PSD colour mode: ${mode}`);

  file.jump(file.readUint()); // colour-mode data
  file.jump(file.readUint()); // image resources
  file.jump(file.readUint()); // layer & mask info

  const compression = file.readWord();
  const channelData: Uint8Array[] = [];

  if (compression === 1) {
    // RLE: all per-row byte counts first, then the packed rows.
    const rowLengths: number[][] = [];
    for (let c = 0; c < channels; c++) {
      const lens: number[] = [];
      for (let y = 0; y < height; y++) lens.push(file.readWord());
      rowLengths.push(lens);
    }
    const source: ByteSource = {
      dataView: file.dataView,
      index: file.index,
      goto(v: number) {
        this.index = v;
      },
    };
    let pos = file.index;
    for (let c = 0; c < channels; c++) {
      const channel = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) {
        const rowLen = rowLengths[c]![y]!;
        const decoded = decodeLine(source, pos, width, pos + rowLen, false).line;
        channel.set(decoded, y * width);
        pos += rowLen;
      }
      channelData.push(channel);
    }
  } else {
    // raw: channels × (width*height) bytes
    let pos = file.index;
    for (let c = 0; c < channels; c++) {
      const channel = new Uint8Array(width * height);
      for (let i = 0; i < width * height; i++) channel[i] = file.dataView.getUint8(pos++);
      channelData.push(channel);
    }
  }

  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    if (mode === 1) {
      const v = channelData[0]![i]!;
      out[o] = v;
      out[o + 1] = v;
      out[o + 2] = v;
      out[o + 3] = channels >= 2 ? channelData[1]![i]! : 255;
    } else {
      out[o] = channelData[0]![i]!;
      out[o + 1] = channelData[1]![i]!;
      out[o + 2] = channelData[2]![i]!;
      out[o + 3] = channels >= 4 ? channelData[3]![i]! : 255;
    }
  }

  return { width, height, data: out };
}

export interface PsdEncodeInput {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray; // RGBA
}

/**
 * Encode an RGBA image as an 8-bit RGB(A) PSD (mode 3, 4 channels, raw
 * compression). Round-trips with {@link decodePSD}.
 */
export function encodePSD(input: PsdEncodeInput): Uint8Array {
  const { width, height, data } = input;
  const channels = 4;
  const n = width * height;
  const total = 26 + 4 + 4 + 4 + 2 + n * channels;
  const f = new BinaryStream(new ArrayBuffer(total), true);

  f.writeString("8BPS");
  f.writeWord(1); // version
  f.fill(0, 6); // reserved
  f.writeWord(channels);
  f.writeUint(height);
  f.writeUint(width);
  f.writeWord(8); // depth
  f.writeWord(3); // mode: RGB
  f.writeUint(0); // colour-mode data
  f.writeUint(0); // image resources
  f.writeUint(0); // layer & mask info
  f.writeWord(0); // compression: raw

  // planar channels: R, G, B, A
  for (let c = 0; c < channels; c++) {
    for (let i = 0; i < n; i++) f.writeUbyte(data[i * 4 + c]!);
  }
  return new Uint8Array(f.buffer);
}

const PSD = { decodePSD, encodePSD };
export default PSD;
