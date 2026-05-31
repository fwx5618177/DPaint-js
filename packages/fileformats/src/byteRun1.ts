/**
 * ByteRun1 / PackBits codec for Amiga ILBM BODY chunks.
 *
 * Decoder ported from the original DPaint.js implementation. Supports standard
 * ByteRun1 (where a control byte of 0x80 is a no-op) plus the legacy
 * `0x80 <byte>` variant some encoders use to express a 129-byte run
 * (`repeat128`). An encoder is added for symmetric round-trip testing.
 */

/** Minimal random-access byte source (satisfied by BinaryStream). */
export interface ByteSource {
  dataView: DataView;
  index: number;
  goto(value: number): void;
}

export interface DecodeResult {
  line: Uint8Array;
  index: number;
  valid: boolean;
  extendedRuns: number;
}

export interface ValidateResult {
  valid: boolean;
  index: number;
}

export function decodeLine(
  file: ByteSource,
  start: number,
  lineWidth: number,
  bodyEnd: number,
  repeat128?: boolean,
): DecodeResult {
  const line = new Uint8Array(lineWidth);
  let readIndex = start;
  let writeIndex = 0;
  let valid = true;
  let extendedRuns = 0;

  const readByte = (): number => {
    if (readIndex >= bodyEnd) {
      valid = false;
      return 0;
    }
    return file.dataView.getUint8(readIndex++);
  };

  while (valid && writeIndex < lineWidth) {
    const control = readByte();
    if (!valid) break;

    if (control === 128) {
      if (!repeat128) continue;
      const value = readByte();
      if (!valid) break;
      if (writeIndex + 129 > lineWidth) {
        valid = false;
        break;
      }
      line.fill(value, writeIndex, writeIndex + 129);
      writeIndex += 129;
      extendedRuns++;
    } else if (control > 128) {
      const value = readByte();
      if (!valid) break;
      const count = 257 - control;
      if (writeIndex + count > lineWidth) {
        valid = false;
        break;
      }
      line.fill(value, writeIndex, writeIndex + count);
      writeIndex += count;
    } else {
      const count = control + 1;
      if (writeIndex + count > lineWidth) {
        valid = false;
        break;
      }
      for (let k = 0; k < count; k++) line[writeIndex++] = readByte();
    }
  }

  valid = valid && writeIndex === lineWidth;
  return { line, index: readIndex, valid, extendedRuns };
}

export function validateLine(
  file: ByteSource,
  start: number,
  lineWidth: number,
  bodyEnd: number,
  repeat128?: boolean,
): ValidateResult {
  let readIndex = start;
  let count = 0;

  const readByte = (): number | undefined => {
    if (readIndex >= bodyEnd) return undefined;
    return file.dataView.getUint8(readIndex++);
  };

  while (count < lineWidth) {
    const control = readByte();
    if (control === undefined) return { valid: false, index: readIndex };

    if (control === 128) {
      if (!repeat128) continue;
      if (readByte() === undefined) return { valid: false, index: readIndex };
      count += 129;
    } else if (control > 128) {
      if (readByte() === undefined) return { valid: false, index: readIndex };
      count += 257 - control;
    } else {
      for (let k = 0; k <= control; k++) {
        if (readByte() === undefined) return { valid: false, index: readIndex };
      }
      count += control + 1;
    }

    if (count > lineWidth) return { valid: false, index: readIndex };
  }

  return { valid: count === lineWidth, index: readIndex };
}

export function validateBody(
  file: ByteSource,
  lineWidth: number,
  bodyStart: number,
  bodyEnd: number,
  lineCount: number,
  repeat128?: boolean,
): boolean {
  let readIndex = bodyStart;
  for (let i = 0; i < lineCount; i++) {
    const result = validateLine(file, readIndex, lineWidth, bodyEnd, repeat128);
    if (!result.valid) return false;
    readIndex = result.index;
  }
  return readIndex === bodyEnd;
}

export function usesRepeat128(
  file: ByteSource,
  lineWidth: number,
  bodyStart: number,
  bodyEnd: number,
  lineCount: number,
): boolean {
  return (
    !validateBody(file, lineWidth, bodyStart, bodyEnd, lineCount, false) &&
    validateBody(file, lineWidth, bodyStart, bodyEnd, lineCount, true)
  );
}

export function readLine(
  file: ByteSource,
  lineWidth: number,
  bodyEnd: number,
  repeat128?: boolean,
): DecodeResult {
  const result = decodeLine(file, file.index, lineWidth, bodyEnd, repeat128);
  file.goto(result.index);
  return result;
}

/**
 * Standard PackBits/ByteRun1 encoder (produces output the decoder above reads
 * back). Emits literal runs (control 0..127) and repeat runs (control 129..255).
 */
export function encodeLine(input: ArrayLike<number>): Uint8Array {
  const out: number[] = [];
  const n = input.length;
  let i = 0;
  while (i < n) {
    // detect a run of identical bytes (length 2..128)
    let runLen = 1;
    while (i + runLen < n && input[i + runLen] === input[i] && runLen < 128) runLen++;
    if (runLen >= 2) {
      out.push(257 - runLen, input[i]!);
      i += runLen;
      continue;
    }
    // otherwise gather a literal run up to 128 bytes
    const literalStart = i;
    let litLen = 0;
    while (i < n && litLen < 128) {
      const next = i + 1 < n && input[i + 1] === input[i];
      const nextNext = i + 2 < n && input[i + 2] === input[i + 1];
      if (next && nextNext) break; // a run of >=3 is better encoded separately
      i++;
      litLen++;
    }
    out.push(litLen - 1);
    for (let k = 0; k < litLen; k++) out.push(input[literalStart + k]!);
  }
  return new Uint8Array(out);
}

const ByteRun1 = {
  decodeLine,
  validateLine,
  validateBody,
  usesRepeat128,
  readLine,
  encodeLine,
};

export default ByteRun1;
