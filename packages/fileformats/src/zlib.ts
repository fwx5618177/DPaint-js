/**
 * Thin zlib (RFC 1950 deflate) helpers built on the platform
 * `CompressionStream` / `DecompressionStream` APIs (available in modern
 * browsers and Node 18+). Used by the PNG codec for IDAT (de)compression —
 * this replaces the vendored minified `zlib.js` from the legacy build.
 */

async function collectStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

interface ByteTransform {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<BufferSource>;
}

function pump(data: Uint8Array, transform: ByteTransform): Promise<Uint8Array> {
  const writer = transform.writable.getWriter();
  void writer.write(data as unknown as BufferSource);
  void writer.close();
  return collectStream(transform.readable);
}

/** zlib-compress (deflate with zlib header + adler32). */
export function deflate(data: Uint8Array): Promise<Uint8Array> {
  return pump(data, new CompressionStream("deflate"));
}

/** zlib-decompress a deflate stream (with zlib header). */
export function inflate(data: Uint8Array): Promise<Uint8Array> {
  return pump(data, new DecompressionStream("deflate"));
}
