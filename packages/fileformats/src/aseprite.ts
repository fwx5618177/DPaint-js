/**
 * Aseprite (.ase/.aseprite) reader — 32-bit RGBA sprites.
 * Spec: https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md
 *
 * Reads the first frame's layers + cels (raw or zlib-compressed) and returns the
 * normal-blend composite as RGBA. Ported from the legacy reader; DOM-free and
 * uses the shared zlib {@link inflate}. (Exotic blend modes fall back to normal.)
 */
import { BinaryStream } from "@dpaint/util";
import { inflate } from "./zlib.js";

export interface AsepriteLayer {
  name: string;
  visible: boolean;
  opacity: number; // 0..100
  data: Uint8ClampedArray; // width*height*4
}

export interface DecodedAseprite {
  width: number;
  height: number;
  layers: AsepriteLayer[];
  data: Uint8ClampedArray; // composite
}

function readString(file: BinaryStream): string {
  const length = file.readWord();
  if (!length) return "";
  const bytes = file.readUBytes(length);
  return new TextDecoder("utf-8").decode(bytes);
}

/** Alpha-over `src` (at sx,sy, sized sw×sh) onto `dst` (w×h), scaled by `factor`. */
function drawOver(
  dst: Uint8ClampedArray,
  w: number,
  h: number,
  src: Uint8Array | Uint8ClampedArray,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  factor: number,
): void {
  for (let y = 0; y < sh; y++) {
    const dy = sy + y;
    if (dy < 0 || dy >= h) continue;
    for (let x = 0; x < sw; x++) {
      const dx = sx + x;
      if (dx < 0 || dx >= w) continue;
      const so = (y * sw + x) * 4;
      const sa = (src[so + 3]! / 255) * factor;
      if (sa <= 0) continue;
      const dofs = (dy * w + dx) * 4;
      const da = dst[dofs + 3]! / 255;
      const outA = sa + da * (1 - sa);
      if (outA <= 0) continue;
      for (let c = 0; c < 3; c++) {
        dst[dofs + c] = (src[so + c]! * sa + dst[dofs + c]! * da * (1 - sa)) / outA;
      }
      dst[dofs + 3] = outA * 255;
    }
  }
}

interface WorkingLayer {
  index: number;
  type: number;
  name: string;
  visible: boolean;
  opacity: number;
  data: Uint8ClampedArray;
}

/** Decode an Aseprite file's first frame to RGBA. */
export async function decodeAseprite(bytes: Uint8Array): Promise<DecodedAseprite> {
  const file = new BinaryStream(new Uint8Array(bytes).buffer, false); // little-endian
  file.readUint(); // file size
  if (file.readWord() !== 0xa5e0) throw new Error("Not an Aseprite file");

  const frameCount = file.readWord();
  const width = file.readWord();
  const height = file.readWord();
  const depth = file.readWord();
  file.readUint(); // flags
  file.readWord(); // speed
  file.jump(8);
  file.readUbyte(); // transparent index
  file.jump(3);
  file.readWord(); // colour count
  file.readUbyte(); // pixel width
  file.readUbyte(); // pixel height
  file.readShort();
  file.readShort();
  file.readWord();
  file.readWord();
  file.jump(84);

  if (!width || !height) throw new Error("Invalid Aseprite dimensions");
  if (depth !== 32) throw new Error("Aseprite reader supports only 32-bit RGBA sprites");

  const layers: WorkingLayer[] = [];
  const layerByIndex: WorkingLayer[] = [];
  const frames = Math.max(1, frameCount);

  for (let frameIndex = 0; frameIndex < frames && file.index < file.length - 15; frameIndex++) {
    const frameStart = file.index;
    const frameBytes = file.readUint();
    if (file.readWord() !== 0xf1fa) throw new Error("Bad Aseprite frame magic");
    const oldChunkCount = file.readWord();
    file.readWord(); // frame duration
    file.jump(2);
    const newChunkCount = file.readUint();
    const chunkCount = newChunkCount || oldChunkCount;
    const frameEnd = frameStart + frameBytes;

    for (let c = 0; c < chunkCount && file.index < frameEnd; c++) {
      const chunkStart = file.index;
      const chunkSize = file.readUint();
      const chunkType = file.readWord();
      const chunkEnd = chunkStart + chunkSize;
      if (chunkSize < 6 || chunkEnd > file.length) throw new Error("Bad Aseprite chunk");

      if (frameIndex === 0) {
        if (chunkType === 0x2004) {
          const layer = readLayerChunk(file, layers.length, width, height);
          layers.push(layer);
          layerByIndex[layer.index] = layer;
        } else if (chunkType === 0x2005) {
          await readCelChunk(file, layerByIndex, width, height, chunkEnd);
        }
      }
      file.goto(chunkEnd);
    }
    file.goto(frameEnd);
  }

  const outLayers: AsepriteLayer[] = layers
    .filter((l) => l.type === 0)
    .map((l) => ({ name: l.name, visible: l.visible, opacity: l.opacity, data: l.data }));

  const composite = new Uint8ClampedArray(width * height * 4);
  for (const l of outLayers) {
    if (!l.visible) continue;
    drawOver(composite, width, height, l.data, 0, 0, width, height, l.opacity / 100);
  }

  return { width, height, layers: outLayers, data: composite };
}

function readLayerChunk(file: BinaryStream, index: number, w: number, h: number): WorkingLayer {
  const flags = file.readWord();
  const layerType = file.readWord();
  file.readWord(); // child level
  file.readWord(); // default width
  file.readWord(); // default height
  file.readWord(); // blend mode
  const opacity = file.readUbyte();
  file.jump(3);
  const name = readString(file) || `Layer ${index + 1}`;
  if (layerType === 2) file.jump(4);
  return {
    index,
    type: layerType,
    name,
    visible: !!(flags & 1),
    opacity: Math.round((opacity / 255) * 100),
    data: new Uint8ClampedArray(w * h * 4),
  };
}

async function readCelChunk(
  file: BinaryStream,
  layerByIndex: WorkingLayer[],
  w: number,
  h: number,
  chunkEnd: number,
): Promise<void> {
  const layerIndex = file.readWord();
  const x = file.readShort();
  const y = file.readShort();
  const opacity = file.readUbyte();
  const celType = file.readWord();
  file.readShort(); // z-index
  file.jump(5);

  const layer = layerByIndex[layerIndex];
  if (!layer || layer.type !== 0) return;

  const cw = file.readWord();
  const ch = file.readWord();
  let pixels: Uint8Array;
  if (celType === 0) {
    pixels = file.readUBytes(cw * ch * 4);
  } else if (celType === 2) {
    const compressed = file.readUBytes(Math.max(0, chunkEnd - file.index));
    pixels = await inflate(compressed);
    if (pixels.length !== cw * ch * 4) return;
  } else {
    return;
  }
  drawOver(layer.data, w, h, pixels, x, y, cw, ch, opacity / 255);
}

const Aseprite = { decodeAseprite };
export default Aseprite;
