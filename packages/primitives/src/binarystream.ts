/**
 * BinaryStream — a cursor-based reader/writer over an ArrayBuffer.
 * Ported from the original DPaint.js util (MIT, © Steffest).
 *
 * Endianness defaults to little-endian; pass `bigEndian = true` to flip it.
 * Method names and aliases match the original so the file-format parsers port
 * over unchanged.
 */
export class BinaryStream {
  index = 0;
  /** Note: original property name kept (typo and all) for behaviour parity. */
  litteEndian: boolean;
  buffer: ArrayBuffer;
  dataView: DataView;
  length: number;

  constructor(arrayBuffer: ArrayBuffer, bigEndian?: boolean) {
    this.litteEndian = !bigEndian;
    this.buffer = arrayBuffer;
    this.dataView = new DataView(arrayBuffer);
    this.length = arrayBuffer.byteLength;
  }

  private setIndex(value?: number): void {
    let v = value === 0 ? value : (value ?? this.index);
    if (v < 0) v = 0;
    if (v >= this.length) v = this.length - 1;
    this.index = v;
  }

  goto(value: number): void {
    this.setIndex(value);
  }

  jump(value: number): void {
    this.goto(this.index + value);
  }

  readByte(position?: number): number {
    this.setIndex(position);
    const b = this.dataView.getInt8(this.index);
    this.index++;
    return b;
  }

  writeByte(value: number, position?: number): void {
    this.setIndex(position);
    this.dataView.setInt8(this.index, value);
    this.index++;
  }

  readUbyte(position?: number): number {
    this.setIndex(position);
    const b = this.dataView.getUint8(this.index);
    this.index++;
    return b;
  }

  writeUbyte(value: number, position?: number): void {
    this.setIndex(position);
    this.dataView.setUint8(this.index, value);
    this.index++;
  }

  readUint(position?: number): number {
    this.setIndex(position);
    const i = this.dataView.getUint32(this.index, this.litteEndian);
    this.index += 4;
    return i;
  }

  /**
   * Reads an unsigned 16-bit word. NOTE: the original used `this.littleEndian`
   * (a typo for `litteEndian`), so this method always read big-endian. That
   * quirky behaviour is preserved intentionally for format compatibility.
   */
  readUWord(position?: number): number {
    this.setIndex(position);
    const i = this.dataView.getUint16(this.index, false);
    this.index += 2;
    return i;
  }

  writeUint(value: number, position?: number): void {
    this.setIndex(position);
    this.dataView.setUint32(this.index, value, this.litteEndian);
    this.index += 4;
  }

  // Aliases kept for parser compatibility.
  readLong(position?: number): number {
    return this.readUint(position);
  }
  readDWord(position?: number): number {
    return this.readUint(position);
  }
  writeLong(value: number, position?: number): void {
    this.writeUint(value, position);
  }
  writeDWord(value: number, position?: number): void {
    this.writeUint(value, position);
  }

  readUBytes(len: number, position?: number, buffer?: Uint8Array): Uint8Array {
    this.setIndex(position);
    if (!buffer) buffer = new Uint8Array(len);
    const i = this.index;
    for (let offset = 0; offset < len; offset++) buffer[offset] = this.dataView.getUint8(i + offset);
    this.index += len;
    return buffer;
  }

  readBytes(len: number, position?: number, buffer?: Int8Array): Int8Array {
    this.setIndex(position);
    if (!buffer) buffer = new Int8Array(len);
    const i = this.index;
    for (let offset = 0; offset < len; offset++) buffer[offset] = this.dataView.getInt8(i + offset);
    this.index += len;
    return buffer;
  }

  readString(len: number, position?: number): string {
    this.setIndex(position);
    let i = this.index;
    const src = this.dataView;
    let text = "";
    if ((len += i) > this.length) len = this.length;
    for (; i < len; ++i) {
      const c = src.getUint8(i);
      if (c == 0) break;
      text += String.fromCharCode(c);
    }
    this.index = len;
    return text;
  }

  writeString(value: string, position?: number): void {
    this.setIndex(position);
    const src = this.dataView;
    const len = value.length;
    for (let i = 0; i < len; i++) src.setUint8(this.index + i, value.charCodeAt(i));
    this.index += len;
  }

  writeStringSection(value?: string, max?: number, paddValue?: number, position?: number): void {
    this.setIndex(position);
    max = max || 1;
    value = value || "";
    paddValue = paddValue || 0;
    const len = value.length;
    if (len > max) value = value.substr(0, max);
    this.writeString(value);
    this.fill(paddValue, max - len);
  }

  /** same as readUshort (uses the stream endianness, unlike readUWord) */
  readWord(position?: number): number {
    this.setIndex(position);
    const w = this.dataView.getUint16(this.index, this.litteEndian);
    this.index += 2;
    return w;
  }

  writeWord(value: number, position?: number): void {
    this.setIndex(position);
    this.dataView.setUint16(this.index, value, this.litteEndian);
    this.index += 2;
  }

  readShort(position?: number): number {
    this.setIndex(position);
    const w = this.dataView.getInt16(this.index, this.litteEndian);
    this.index += 2;
    return w;
  }

  readBits(count: number, bitPosition: number, position?: number): number {
    const pos = position === 0 ? position : (position ?? this.index);
    const bytePosition = pos + (bitPosition >> 3);
    this.setIndex(bytePosition);
    bitPosition = bitPosition - ((bitPosition >> 3) << 3);

    let bits = byte2Bits(this.dataView.getUint8(this.index));
    if (bitPosition + count > 8 && this.index < this.length - 1) {
      bits = bits.concat(byte2Bits(this.dataView.getUint8(this.index + 1)));
    }
    return bits2Int(bits.slice(bitPosition, bitPosition + count));
  }

  writeBits(bits: number[], position?: number): void {
    this.setIndex(position);
    if (bits.length > 8) {
      let bts: number[] = [];
      let bindex = 0;
      const write = () => {
        if (bts.length) {
          this.dataView.setUint8(this.index, bits2Int(bts));
          this.index++;
          bts = [];
        }
      };
      while (bts.length < 8 && bindex < bits.length) {
        bts.push(bits[bindex]!);
        bindex++;
        if (bts.length >= 8) write();
      }
      write();
    } else {
      this.dataView.setUint8(this.index, bits2Int(bits));
      this.index++;
    }
  }

  writeByteArray(array: ArrayLike<number>, position?: number): void {
    this.setIndex(position);
    for (let i = 0; i < array.length; i++) {
      this.dataView.setUint8(this.index, array[i]!);
      this.index++;
    }
  }

  clear(length?: number): void {
    this.fill(0, length);
  }

  fill(value?: number, length?: number): void {
    value = value || 0;
    length = length || 0;
    for (let i = 0; i < length; i++) this.writeByte(value);
  }

  isEOF(margin?: number): boolean {
    margin = margin || 0;
    return this.index >= this.length - margin;
  }
}

function byte2Bits(b: number): number[] {
  return [
    (b >> 7) & 1,
    (b >> 6) & 1,
    (b >> 5) & 1,
    (b >> 4) & 1,
    (b >> 3) & 1,
    (b >> 2) & 1,
    (b >> 1) & 1,
    b & 1,
  ];
}

function bits2Int(bits: number[]): number {
  let v = 0;
  const len = bits.length - 1;
  for (let i = 0; i <= len; i++) v += bits[i]! << (len - i);
  return v;
}

/** Factory matching the original default export signature. */
export default function createBinaryStream(arrayBuffer: ArrayBuffer, bigEndian?: boolean): BinaryStream {
  return new BinaryStream(arrayBuffer, bigEndian);
}
