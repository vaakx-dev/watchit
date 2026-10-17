import { open, unlink } from 'node:fs/promises';
import type { Transport } from './transport.ts';

const CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const TIMEOUT_MS = 15_000;
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function matches_type(bytes: Buffer, content_type: string): boolean {
  switch (content_type) {
    case 'image/jpeg': return bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    case 'image/png': return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case 'image/gif': return ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6));
    case 'image/webp': return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    case 'image/avif': {
      if (bytes.toString('ascii', 4, 8) !== 'ftyp') return false;
      const box_size = Math.min(bytes.readUInt32BE(0), bytes.length);
      for (let offset = 8; offset + 4 <= box_size; offset += 4) {
        if (offset === 12) continue;
        if (['avif', 'avis'].includes(bytes.toString('ascii', offset, offset + 4))) return true;
      }
      return false;
    }
    default: return false;
  }
}

export async function download_image(source: string, temporary: string, request: Transport, limit: number, shutdown?: AbortSignal): Promise<{ bytes: number; content_type: string }> {
  const controller = new AbortController();
  const signal = shutdown ? AbortSignal.any([controller.signal, shutdown]) : controller.signal;
  const timeout = setTimeout(() => controller.abort(new Error('Image request timed out')), TIMEOUT_MS);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let file: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const response = await request(source, signal);
    reader = response.body?.getReader();
    signal.throwIfAborted();
    const content_type = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    if (!content_type || !CONTENT_TYPES.has(content_type)) throw new Error('Unsupported image content type');
    const declared_size = Number(response.headers.get('content-length'));
    if (declared_size > limit) throw new Error('Image exceeds the size limit');
    if (!reader) throw new Error('Image response has no body');
    file = await open(temporary, 'wx');
    let bytes = 0;
    let prefix = Buffer.alloc(0);
    while (true) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) break;
      timeout.refresh();
      bytes += chunk.value.byteLength;
      if (bytes > limit) throw new Error('Image exceeds the size limit');
      if (prefix.length < 64) prefix = Buffer.concat([prefix, Buffer.from(chunk.value.subarray(0, 64 - prefix.length))]);
      await file.writeFile(chunk.value);
    }
    if (!matches_type(prefix, content_type)) throw new Error('Image body does not match its raster content type');
    return { bytes, content_type };
  } catch (error) {
    controller.abort();
    await reader?.cancel().catch(() => {});
    throw error;
  } finally {
    clearTimeout(timeout);
    reader?.releaseLock();
    await file?.close();
  }
}

export async function remove_file(path: string): Promise<void> {
  try { await unlink(path); } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
}
