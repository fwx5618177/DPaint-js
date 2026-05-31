/**
 * Pure, dependency-light file-format detection.
 *
 * Replicates the magic-byte / extension checks the original parsers used in
 * their individual `detect()` methods, without needing to instantiate the full
 * (canvas-bound) parsers. Returns a stable format tag.
 */

export type FileFormat =
  | "PNG"
  | "GIF"
  | "ILBM"
  | "PBM"
  | "ANIM"
  | "IFF"
  | "PSD"
  | "ASEPRITE"
  | "DEGAS"
  | "NEO"
  | "ICON"
  | "UNKNOWN";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function toBytes(data: ArrayBuffer | Uint8Array | ArrayLike<number>): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return Uint8Array.from(data as ArrayLike<number>);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let s = "";
  for (let i = 0; i < length; i++) {
    const c = bytes[offset + i];
    if (c === undefined) break;
    s += String.fromCharCode(c);
  }
  return s;
}

function u16be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function u16le(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/**
 * Detect the image format of `data`. `name` (optional) supplies the file name
 * so the extension-keyed Atari/Amiga formats can be recognised.
 */
export function detectFormat(
  data: ArrayBuffer | Uint8Array | ArrayLike<number>,
  name = "",
): FileFormat {
  const bytes = toBytes(data);
  const ext = extensionOf(name);

  // --- magic-byte formats (extension independent) ---
  if (bytes.length >= 8 && PNG_SIGNATURE.every((b, i) => bytes[i] === b)) {
    return "PNG";
  }

  if (ascii(bytes, 0, 3) === "GIF") {
    const version = ascii(bytes, 3, 3);
    if (version === "87a" || version === "89a") return "GIF";
  }

  if (ascii(bytes, 0, 4) === "FORM") {
    const format = ascii(bytes, 8, 4);
    if (format === "ILBM") return "ILBM";
    if (format === "PBM ") return "PBM";
    if (format === "ANIM") return "ANIM";
    return "IFF";
  }

  if (ascii(bytes, 0, 4) === "8BPS" && u16be(bytes, 4) === 1) {
    return "PSD";
  }

  if (bytes.length >= 128 && u16le(bytes, 4) === 0xa5e0) {
    return "ASEPRITE";
  }

  // Amiga icon: 0xE310 magic word (big-endian) at offset 0.
  if (u16be(bytes, 0) === 0xe310 && (ext === "info" || ext === "")) {
    return "ICON";
  }

  // --- extension-keyed Atari ST formats ---
  if (ext === "pi1" || ext === "pi2" || ext === "pi3") {
    if (bytes.length >= 34) {
      const res = u16be(bytes, 0);
      if (res === 0 || res === 1 || res === 2) return "DEGAS";
    }
  }

  if (ext === "neo") {
    if (bytes.length >= 128 + 32000) {
      const flag = u16be(bytes, 0);
      const res = u16be(bytes, 2);
      if (flag === 0 && (res === 0 || res === 1 || res === 2)) return "NEO";
    }
  }

  return "UNKNOWN";
}

const FileDetector = { detectFormat };
export default FileDetector;
