/**
 * ADF (Amiga Disk File) reader — lists the root directory and extracts files
 * from OFS/FFS floppy images. Read-only port of the legacy reader; uses the
 * shared big-endian {@link BinaryStream}.
 */
import { BinaryStream } from "@dpaint/util";

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

const ADF = { AdfDisk, decodeADF };
export default ADF;
