/**
 * Amiga icon (`.info`) reader — classic planar DiskObject icons (magic 0xE310).
 *
 * Reads the DiskObject + Gadget header, then the first (and optional second)
 * planar Image, mapping pixels through the standard Workbench palette. Ported
 * from the legacy reader; DOM-free, returns RGBA.
 *
 * Modern "DualPNG" icons begin with a PNG signature and are handled by the PNG
 * decoder instead; glow/NewIcon (IFF FORM ICON) variants are not covered here.
 */
import { BinaryStream, type ColorArray } from "@dpaint/primitives";

export interface AmigaIconImage {
  width: number;
  height: number;
  depth: number;
  data: Uint8ClampedArray; // RGBA
}

export interface DecodedAmigaIcon {
  width: number;
  height: number;
  /** first icon image (normal state) */
  data: Uint8ClampedArray;
  images: AmigaIconImage[];
}

/** Standard Workbench 1.3 icon palette (indices 0–3). */
const WB_PALETTE: ColorArray[] = [
  [85, 170, 255],
  [255, 255, 255],
  [0, 0, 0],
  [255, 136, 0],
];

function readImage(file: BinaryStream): AmigaIconImage | null {
  file.readWord(); // leftEdge
  file.readWord(); // topEdge
  const width = file.readWord();
  const height = file.readWord();
  const depth = file.readWord();
  const hasImageData = file.readUint();
  file.readUbyte(); // planePick
  file.readUbyte(); // planeOnOff
  file.readUint(); // nextImage

  if (!hasImageData || depth >= 9 || width <= 0 || height <= 0) return null;

  const lineWidth = ((width + 15) >> 4) << 1; // bytes per plane row
  const indices = new Uint8Array(width * height);
  for (let plane = 0; plane < depth; plane++) {
    for (let y = 0; y < height; y++) {
      for (let b = 0; b < lineWidth; b++) {
        const val = file.readUbyte();
        for (let i = 7; i >= 0; i--) {
          const x = b * 8 + (7 - i);
          if (x >= width) continue;
          const bit = val & (1 << i) ? 1 : 0;
          indices[y * width + x]! |= bit << plane;
        }
      }
    }
  }

  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < indices.length; i++) {
    const c = WB_PALETTE[indices[i]!] ?? [0, 0, 0];
    data[i * 4] = c[0]!;
    data[i * 4 + 1] = c[1]!;
    data[i * 4 + 2] = c[2]!;
    data[i * 4 + 3] = 255;
  }
  return { width, height, depth, data };
}

/** Decode a classic Amiga `.info` icon. */
export function decodeAmigaIcon(bytes: Uint8Array): DecodedAmigaIcon {
  const file = new BinaryStream(new Uint8Array(bytes).buffer, true); // big-endian
  if (file.readWord(0) !== 0xe310) throw new Error("Not a classic Amiga icon");

  file.goto(2);
  file.readWord(); // version
  file.readUint(); // nextGadget
  file.readWord(); // leftEdge
  file.readWord(); // topEdge
  file.readWord(); // width
  file.readWord(); // height
  file.readWord(); // flags
  file.readWord(); // activation
  file.readWord(); // gadgetType
  const gadgetRender = file.readUint();
  const selectRender = file.readUint();
  file.readUint(); // gadgetText
  file.readUint(); // mutualExclude
  file.readUint(); // specialInfo
  file.readWord(); // gadgetID
  file.readUint(); // userData
  file.readUbyte(); // type
  file.readUbyte(); // padding
  file.readUint(); // hasDefaultTool
  file.readUint(); // hasToolTypes
  file.readUint(); // currentX
  file.readUint(); // currentY
  const hasDrawerData = file.readUint();
  file.readUint(); // hasToolWindow
  file.readUint(); // stackSize

  let offset = 78;
  if (hasDrawerData) offset += 56;
  file.goto(offset);

  const images: AmigaIconImage[] = [];
  if (gadgetRender) {
    const first = readImage(file);
    if (first) images.push(first);
  }
  if (selectRender) {
    const second = readImage(file);
    if (second) images.push(second);
  }

  if (images.length === 0) throw new Error("Amiga icon has no image data");
  const main = images[0]!;
  return { width: main.width, height: main.height, data: main.data, images };
}

const AmigaIcon = { decodeAmigaIcon };
export default AmigaIcon;
