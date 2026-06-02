/**
 * ADF (Amiga Disk File) reader — lists the root directory and extracts files
 * from OFS/FFS floppy images. Read-only port of the legacy reader; uses the
 * shared big-endian {@link BinaryStream}.
 */
import { BinaryStream } from "@dpaint/primitives";

const SECTOR = 512;

export type AdfEntryType = "FILE" | "DIR";

export interface AdfEntry {
  name: string;
  type: AdfEntryType;
  size: number;
  sector: number;
}

export interface DecodedADF {
  label: string;
  ffs: boolean;
  entries: AdfEntry[];
}

interface HeaderBlock {
  type: number;
  name: string;
  size: number;
  firstDataBlock: number;
  pointers: number[];
  linkedSector: number;
  secondaryType: number;
  dataBlockExtension: number;
}

export class AdfDisk {
  private readonly file: BinaryStream;
  readonly sectorCount: number;
  readonly rootSector: number;
  readonly ffs: boolean;

  constructor(bytes: Uint8Array) {
    this.file = new BinaryStream(new Uint8Array(bytes).buffer, true);
    if (this.file.readString(3, 0) !== "DOS") throw new Error("Not an ADF (missing DOS signature)");
    const typeByte = this.file.readUbyte();
    this.ffs = typeByte % 2 === 1;
    this.sectorCount = Math.floor(bytes.length / SECTOR);
    this.rootSector = Math.floor(this.sectorCount / 2);
    if (this.readLongAt(this.rootSector * SECTOR) !== 2) {
      throw new Error("ADF root block is not a header block");
    }
  }

  private readLongAt(offset: number): number {
    return this.file.readUint(offset);
  }

  private readName(sector: number): string {
    const base = sector * SECTOR;
    const len = this.file.dataView.getUint8(base + SECTOR - 80);
    return this.file.readString(len, base + SECTOR - 80 + 1);
  }

  /** Disk volume label (root block name). */
  get label(): string {
    return this.readName(this.rootSector);
  }

  private readHeaderBlock(sector: number): HeaderBlock {
    const base = sector * SECTOR;
    const type = this.readLongAt(base);
    this.file.readUint(); // headerKey
    this.file.readUint(); // dataBlockCount / unused
    this.file.readUint(); // dataSize / hash size
    const firstDataBlock = this.file.readUint();
    this.file.readUint(); // checksum
    const pointers: number[] = [];
    for (let i = 0; i < 72; i++) pointers.push(this.file.readUint() || 0);

    const size = this.readLongAt(base + SECTOR - 188);
    const linkedSector = this.readLongAt(base + SECTOR - 16);
    this.file.readUint(); // parent
    const dataBlockExtension = this.file.readUint();
    const secondaryType = this.file.readUint(); // -3 (0xFFFFFFFD) = FILE
    const name = this.readName(sector);

    return { type, name, size, firstDataBlock, pointers, linkedSector, secondaryType, dataBlockExtension };
  }

  private entryType(secondaryType: number): AdfEntryType {
    // 0xFFFFFFFD == -3 marks a file
    return secondaryType === 0xfffffffd ? "FILE" : "DIR";
  }

  /** List the root directory (files + folders). */
  list(): AdfEntry[] {
    const root = this.readHeaderBlock(this.rootSector);
    const entries: AdfEntry[] = [];
    const seen = new Set<number>();
    const queue = root.pointers.filter((p) => p > 0 && p < this.sectorCount);

    while (queue.length) {
      const sector = queue.shift()!;
      if (seen.has(sector)) continue;
      seen.add(sector);
      const block = this.readHeaderBlock(sector);
      entries.push({
        name: block.name,
        type: this.entryType(block.secondaryType),
        size: block.size,
        sector,
      });
      if (block.linkedSector > 0 && block.linkedSector < this.sectorCount) {
        queue.push(block.linkedSector);
      }
    }
    return entries;
  }

  /** Read a file's bytes by its header-block sector. */
  readFile(sector: number): Uint8Array {
    const header = this.readHeaderBlock(sector);
    const content = new Uint8Array(header.size);
    let index = 0;

    if (this.ffs) {
      // FFS: pointers list (reversed) + extension blocks; raw 512-byte data blocks
      let pointers = header.pointers.filter((p) => p > 0).reverse();
      let ext = header.dataBlockExtension;
      let guard = 0;
      while (ext > 0 && ext < this.sectorCount && guard++ < 4096) {
        const block = this.readHeaderBlock(ext);
        pointers = pointers.concat(block.pointers.filter((p) => p > 0).reverse());
        ext = block.dataBlockExtension;
      }
      let remaining = header.size;
      for (const ds of pointers) {
        const take = Math.min(remaining, SECTOR);
        const base = ds * SECTOR;
        for (let i = 0; i < take; i++) content[index++] = this.file.dataView.getUint8(base + i);
        remaining -= take;
      }
    } else {
      // OFS: follow the linked list of data blocks (24-byte header each)
      let next = header.firstDataBlock;
      let guard = 0;
      while (next > 0 && next < this.sectorCount && guard++ < 65536) {
        const base = next * SECTOR;
        const dataSize = this.readLongAt(base + 12);
        const nextBlock = this.readLongAt(base + 16);
        for (let i = 0; i < dataSize && index < content.length; i++) {
          content[index++] = this.file.dataView.getUint8(base + 24 + i);
        }
        next = nextBlock;
      }
    }
    return content;
  }
}

/** Detect, then list the root directory of an ADF image. */
export function decodeADF(bytes: Uint8Array): DecodedADF {
  const disk = new AdfDisk(bytes);
  return { label: disk.label, ffs: disk.ffs, entries: disk.list() };
}

const DD_SECTORS = 1760; // standard 880 KB double-density Amiga floppy
const OFS_DATA = SECTOR - 24; // payload bytes per OFS data block

/**
 * Write a minimal but valid OFS ADF (880 KB) containing the given files in the
 * root directory. Round-trips through {@link AdfDisk} (the reader this module
 * also provides). Intended for "save image to disk", not full AmigaDOS fidelity
 * (no bitmap/checksum validation, single-level root only).
 */
export function encodeADF(files: { name: string; bytes: Uint8Array }[], label = "DPAINT"): Uint8Array {
  const buf = new Uint8Array(DD_SECTORS * SECTOR);
  const view = new DataView(buf.buffer);
  const setLong = (off: number, val: number) => view.setUint32(off, val >>> 0);
  const setName = (sector: number, name: string) => {
    const o = sector * SECTOR + SECTOR - 80;
    const clipped = name.slice(0, 30);
    buf[o] = clipped.length;
    for (let i = 0; i < clipped.length; i++) buf[o + 1 + i] = clipped.charCodeAt(i);
  };

  // boot block: "DOS" + 0 (OFS)
  buf[0] = 0x44; // D
  buf[1] = 0x4f; // O
  buf[2] = 0x53; // S
  buf[3] = 0x00;

  const root = Math.floor(DD_SECTORS / 2); // 880
  setLong(root * SECTOR, 2); // header type
  setName(root, label);

  let next = root + 1; // allocate file/data sectors after the root
  files.forEach((file, i) => {
    const hdr = next++;
    setLong(root * SECTOR + 24 + i * 4, hdr); // root hash slot -> file header

    const dataSectors: number[] = [];
    const blockCount = Math.max(1, Math.ceil(file.bytes.length / OFS_DATA));
    for (let b = 0; b < blockCount; b++) dataSectors.push(next++);

    // file header block
    setLong(hdr * SECTOR + 0, 2); // header type
    setLong(hdr * SECTOR + 16, dataSectors[0] ?? 0); // firstDataBlock
    setLong(hdr * SECTOR + SECTOR - 188, file.bytes.length); // size
    setLong(hdr * SECTOR + SECTOR - 16, 0); // linkedSector
    setLong(hdr * SECTOR + SECTOR - 4, 0xfffffffd); // secondaryType FILE
    setName(hdr, file.name);

    // OFS data blocks (24-byte header each, chained)
    let written = 0;
    for (let b = 0; b < blockCount; b++) {
      const ds = dataSectors[b]!;
      const base = ds * SECTOR;
      const take = Math.min(OFS_DATA, file.bytes.length - written);
      setLong(base + 0, 8); // data block type
      setLong(base + 4, hdr); // header sector
      setLong(base + 8, b + 1); // sequence number
      setLong(base + 12, take); // data size
      setLong(base + 16, b + 1 < blockCount ? dataSectors[b + 1]! : 0); // next block
      buf.set(file.bytes.subarray(written, written + take), base + 24);
      written += take;
    }
  });

  return buf;
}

const ADF = { AdfDisk, decodeADF, encodeADF };
export default ADF;
