/**
 * GIF-flavour LZW (variable-width) codec.
 *
 * - `encode` adapted from jsgif's LZWEncoder (MIT, © Kevin Kwok).
 * - `decode` adapted from gifuct-js (MIT, © Matt Way).
 *
 * `encode` returns the full GIF image-data section: a leading minimum-code-size
 * byte, followed by length-prefixed sub-blocks and a terminating zero byte.
 * `decode` takes the concatenated code bytes (sub-block lengths already
 * stripped) plus the minimum code size and expected pixel count.
 */

const MASKS = [
  0x0000, 0x0001, 0x0003, 0x0007, 0x000f, 0x001f, 0x003f, 0x007f, 0x00ff, 0x01ff, 0x03ff, 0x07ff,
  0x0fff, 0x1fff, 0x3fff, 0x7fff, 0xffff,
];

/** LZW-compress indexed pixels into a GIF image-data section. */
export function encode(
  pixels: ArrayLike<number>,
  imgWidth: number,
  imgHeight: number,
  colorDepth: number,
): number[] {
  const EOF = -1;
  const BITS = 12;
  const HSIZE = 5003;
  const maxbits = BITS;
  const maxmaxcode = 1 << BITS;
  const htab: number[] = [];
  const codetab: number[] = [];
  const accum: number[] = [];

  let n_bits = 0;
  let maxcode = 0;
  let free_ent = 0;
  let clear_flg = false;
  let g_init_bits = 0;
  let ClearCode = 0;
  let EOFCode = 0;
  let cur_accum = 0;
  let cur_bits = 0;
  let a_count = 0;
  let remaining = imgWidth * imgHeight;
  let curPixel = 0;

  const MAXCODE = (n: number) => (1 << n) - 1;

  const nextPixel = (): number => {
    if (remaining === 0) return EOF;
    --remaining;
    return pixels[curPixel++]! & 0xff;
  };

  const out: number[] = [];
  const initCodeSize = Math.max(2, colorDepth);
  out.push(initCodeSize);

  const flush_char = () => {
    if (a_count > 0) {
      out.push(a_count);
      for (let i = 0; i < a_count; i++) out.push(accum[i]!);
      a_count = 0;
    }
  };

  const char_out = (c: number) => {
    accum[a_count++] = c;
    if (a_count >= 254) flush_char();
  };

  const cl_hash = (hsize: number) => {
    for (let i = 0; i < hsize; ++i) htab[i] = -1;
  };

  const output = (code: number) => {
    cur_accum &= MASKS[cur_bits]!;
    if (cur_bits > 0) cur_accum |= code << cur_bits;
    else cur_accum = code;
    cur_bits += n_bits;

    while (cur_bits >= 8) {
      char_out(cur_accum & 0xff);
      cur_accum >>= 8;
      cur_bits -= 8;
    }

    if (free_ent > maxcode || clear_flg) {
      if (clear_flg) {
        maxcode = MAXCODE((n_bits = g_init_bits));
        clear_flg = false;
      } else {
        ++n_bits;
        maxcode = n_bits === maxbits ? maxmaxcode : MAXCODE(n_bits);
      }
    }

    if (code === EOFCode) {
      while (cur_bits > 0) {
        char_out(cur_accum & 0xff);
        cur_accum >>= 8;
        cur_bits -= 8;
      }
      flush_char();
    }
  };

  const cl_block = () => {
    cl_hash(HSIZE);
    free_ent = ClearCode + 2;
    clear_flg = true;
    output(ClearCode);
  };

  const compress = (init_bits: number) => {
    g_init_bits = init_bits;
    clear_flg = false;
    n_bits = g_init_bits;
    maxcode = MAXCODE(n_bits);
    ClearCode = 1 << (init_bits - 1);
    EOFCode = ClearCode + 1;
    free_ent = ClearCode + 2;
    a_count = 0;

    let ent = nextPixel();

    let hshift = 0;
    for (let fcode = HSIZE; fcode < 65536; fcode *= 2) ++hshift;
    hshift = 8 - hshift;

    const hsize_reg = HSIZE;
    cl_hash(hsize_reg);
    output(ClearCode);

    let c: number;
    outer_loop: while ((c = nextPixel()) !== EOF) {
      const fcode = (c << maxbits) + ent;
      let i = (c << hshift) ^ ent;

      if (htab[i] === fcode) {
        ent = codetab[i]!;
        continue;
      } else if (htab[i]! >= 0) {
        let disp = hsize_reg - i;
        if (i === 0) disp = 1;
        do {
          if ((i -= disp) < 0) i += hsize_reg;
          if (htab[i] === fcode) {
            ent = codetab[i]!;
            continue outer_loop;
          }
        } while (htab[i]! >= 0);
      }

      output(ent);
      ent = c;
      if (free_ent < maxmaxcode) {
        codetab[i] = free_ent++;
        htab[i] = fcode;
      } else {
        cl_block();
      }
    }

    output(ent);
    output(EOFCode);
  };

  compress(initCodeSize + 1);
  out.push(0); // block terminator
  return out;
}

/** LZW-decompress GIF image data into indexed pixels. */
export function decode(data: ArrayLike<number>, minCodeSize: number, pixelCount: number): number[] {
  const MAX_STACK_SIZE = 4096;
  const nullCode = -1;
  const npix = pixelCount;

  const dstPixels = new Array<number>(pixelCount);
  const prefix = new Array<number>(MAX_STACK_SIZE);
  const suffix = new Array<number>(MAX_STACK_SIZE);
  const pixelStack = new Array<number>(MAX_STACK_SIZE + 1);

  const data_size = minCodeSize;
  const clear = 1 << data_size;
  const end_of_information = clear + 1;
  let available = clear + 2;
  let old_code = nullCode;
  let code_size = data_size + 1;
  let code_mask = (1 << code_size) - 1;
  let code: number;

  for (code = 0; code < clear; code++) {
    prefix[code] = 0;
    suffix[code] = code;
  }

  let datum = 0;
  let bits = 0;
  let first = 0;
  let top = 0;
  let pi = 0;
  let bi = 0;
  let in_code: number;
  let i: number;

  for (i = 0; i < npix; ) {
    if (top === 0) {
      if (bits < code_size) {
        datum += (data[bi]! ?? 0) << bits;
        bits += 8;
        bi++;
        continue;
      }
      code = datum & code_mask;
      datum >>= code_size;
      bits -= code_size;
      if (code > available || code === end_of_information) break;
      if (code === clear) {
        code_size = data_size + 1;
        code_mask = (1 << code_size) - 1;
        available = clear + 2;
        old_code = nullCode;
        continue;
      }
      if (old_code === nullCode) {
        pixelStack[top++] = suffix[code]!;
        old_code = code;
        first = code;
        continue;
      }
      in_code = code;
      if (code === available) {
        pixelStack[top++] = first;
        code = old_code;
      }
      while (code > clear) {
        pixelStack[top++] = suffix[code]!;
        code = prefix[code]!;
      }

      first = suffix[code]! & 0xff;
      pixelStack[top++] = first;

      if (available < MAX_STACK_SIZE) {
        prefix[available] = old_code;
        suffix[available] = first;
        available++;
        if ((available & code_mask) === 0 && available < MAX_STACK_SIZE) {
          code_size++;
          code_mask += available;
        }
      }
      old_code = in_code;
    }
    top--;
    dstPixels[pi++] = pixelStack[top]!;
    i++;
  }

  for (i = pi; i < npix; i++) dstPixels[i] = 0;
  return dstPixels;
}

const LZW = { encode, decode };
export default LZW;
