import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { download_image } from './download.ts';
import { image_url } from './urls.ts';
import { create_transport } from './transport.ts';

const SOURCE = 'https://episodes.metahub.space/tt0903747/1/1/w780.jpg';
const THUMB = 'https://image.tmdb.org/t/p/w780/ydlY3iPfeOAvu8gVqrxPoMvzNCn.jpg';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
let directory: string;
let temporary: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'streamit-download-'));
  temporary = join(directory, 'image.tmp');
});
afterEach(async () => {
  vi.useRealTimers();
  await rm(directory, { recursive: true, force: true });
});

function raster(): Response {
  return new Response(PNG, { headers: { 'Content-Type': 'image/png' } });
}

function redirect(location: string, status = 302): Response {
  return new Response(null, { status, headers: { Location: location } });
}

describe('image downloads', () => {
  it('accepts IMDb poster URLs supplied by Cinemeta search', async () => {
    const source = 'https://m.media-amazon.com/images/M/MV5BYjgxZjg0MzEtYzQxMi00ZGRkLThkMzYtNzY0MDBmYjU0MjI0XkEyXkFqcGc@._V1_SX250.jpg';
    const fetch_image = vi.fn<typeof fetch>().mockResolvedValue(raster());
    expect(image_url(source)).toBe(source);
    await download_image(source, temporary, create_transport(fetch_image), 1024);
    expect(await readFile(temporary)).toEqual(PNG);
    expect(() => image_url('https://m.media-amazon.com/private/poster.jpg')).toThrow(RangeError);
    expect(() => image_url('https://m.media-amazon.com/images/M/example.svg')).toThrow(RangeError);
  });

  it('follows bounded approved redirects, including root and file relative locations', async () => {
    const fetch_image = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(redirect(THUMB, 301))
      .mockResolvedValueOnce(redirect('/t/p/w780/second.jpg', 307))
      .mockResolvedValueOnce(redirect('third.jpg', 308))
      .mockResolvedValueOnce(raster());
    expect(await download_image(SOURCE, temporary, create_transport(fetch_image), 1024)).toEqual({ bytes: PNG.length, content_type: 'image/png' });
    expect(await readFile(temporary)).toEqual(PNG);
    expect(fetch_image.mock.calls.map(call => call[0])).toEqual([
      SOURCE, THUMB, 'https://image.tmdb.org/t/p/w780/second.jpg', 'https://image.tmdb.org/t/p/w780/third.jpg',
    ]);
    for (const [, options] of fetch_image.mock.calls) {
      expect(options).toMatchObject({ redirect: 'manual', credentials: 'omit' });
      expect(Object.keys(options!.headers!)).toEqual(['Accept', 'User-Agent']);
    }
  });

  it.each([
    'https://evil.example/image.png',
    'https://images.metahub.space.evil.example/poster/small/1.png',
    'https://images.metahub.space/images/1.png',
    'https://episodes.metahub.space/wikipedia/en/1.png',
    'https://images.metahub.space:443/t/p/w780/1.png',
    'https://user:password@images.metahub.space/t/p/w780/1.png',
    'http://images.metahub.space/t/p/w780/1.png',
    'https:////images.metahub.space/t/p/w780/1.png',
    '//evil.example/image.png',
    '/t/p/w780/a/../1.png',
    '/t/p/w780/%2e%2e/private/1.png',
    '/t/p/w780/%2Fprivate.png',
    '/t/p/w780/%5cprivate.png',
    '/t/p/w780/%252e%252e/1.png',
    '/t/p/w780/a\\..\\1.png',
    '/t/p/w780/1.png#fragment',
    '/t/p/w780/1.png#',
    '../1.png',
  ])('blocks an unsafe redirect before a second request: %s', async location => {
    const fetch_image = vi.fn<typeof fetch>().mockResolvedValueOnce(redirect(location));
    await expect(download_image(SOURCE, temporary, create_transport(fetch_image), 1024)).rejects.toThrow('unsafe redirect');
    expect(fetch_image).toHaveBeenCalledTimes(1);
  });

  it('stops redirect loops and cancels each unused response body', async () => {
    const cancel = vi.fn();
    const fetch_image = vi.fn<typeof fetch>(async () => new Response(new ReadableStream({ cancel }), {
      status: 302, headers: { Location: THUMB },
    }));
    await expect(download_image(SOURCE, temporary, create_transport(fetch_image), 1024)).rejects.toThrow('redirect limit');
    expect(fetch_image).toHaveBeenCalledTimes(4);
    expect(cancel).toHaveBeenCalledTimes(4);
  });

  it('revalidates stored sources before the first request', async () => {
    const fetch_image = vi.fn<typeof fetch>();
    await expect(download_image('https://evil.example/image.png', temporary, create_transport(fetch_image), 1024)).rejects.toThrow(RangeError);
    expect(fetch_image).not.toHaveBeenCalled();
  });

  it('rejects a fetch implementation that silently followed a redirect', async () => {
    const response = raster();
    Object.defineProperties(response, { redirected: { value: true }, url: { value: THUMB } });
    const fetch_image = vi.fn<typeof fetch>().mockResolvedValue(response);
    await expect(download_image(SOURCE, temporary, create_transport(fetch_image), 1024)).rejects.toThrow('Image origin');
    expect(response.body?.locked).toBe(false);
  });

  it('checks raster signatures across streamed chunks and permits exactly the byte limit', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let offset = 0; offset < PNG.length; offset += 3) controller.enqueue(PNG.subarray(offset, offset + 3));
        controller.close();
      },
    });
    const fetch_image = vi.fn<typeof fetch>().mockResolvedValue(new Response(stream, { headers: { 'Content-Type': 'IMAGE/PNG; charset=binary' } }));
    expect(await download_image(SOURCE, temporary, create_transport(fetch_image), PNG.length)).toEqual({ bytes: PNG.length, content_type: 'image/png' });
    expect(await readFile(temporary)).toEqual(PNG);
  });

  it('follows the metahub redirect to live.metahub.space for the same artwork paths only', async () => {
    const poster = 'https://images.metahub.space/poster/small/tt0133093/img';
    const live = 'https://live.metahub.space/poster/small/tt0133093/img';
    const fetch_image = vi.fn<typeof fetch>().mockResolvedValueOnce(redirect(live, 307)).mockResolvedValueOnce(raster());
    await download_image(poster, temporary, create_transport(fetch_image), 1024);
    expect(fetch_image.mock.calls.map(call => call[0])).toEqual([poster, live]);
    expect(image_url('https://live.metahub.space/background/medium/tt0133093/img')).toBe('https://live.metahub.space/background/medium/tt0133093/img');
    for (const path of ['logo/medium/tt0133093/img', 'poster/large/tt0133093/img', 'poster/small/tt0133093/img/../x']) {
      expect(() => image_url(`https://live.metahub.space/${path}`)).toThrow(RangeError);
    }
  });

  it.each([
    { type: 'image/svg+xml', bytes: Buffer.from('<svg/>'), message: 'Unsupported' },
    { type: 'text/html', bytes: PNG, message: 'Unsupported' },
    { type: 'image/jpeg', bytes: PNG, message: 'does not match' },
    { type: 'image/avif', bytes: Buffer.from([0, 0, 0, 8]), message: 'does not match' },
    { type: 'image/png', bytes: Buffer.alloc(0), message: 'does not match' },
    { type: 'image/png', bytes: Buffer.concat([PNG, Buffer.from([0])]), message: 'size limit' },
  ])('rejects invalid raster data: $type, $message', async ({ type, bytes, message }) => {
    const fetch_image = vi.fn<typeof fetch>().mockResolvedValue(new Response(bytes, { headers: { 'Content-Type': type } }));
    await expect(download_image(SOURCE, temporary, create_transport(fetch_image), PNG.length)).rejects.toThrow(message);
  });

  it('aborts a stalled request at the timeout', async () => {
    vi.useFakeTimers();
    const fetch_image = vi.fn<typeof fetch>((_url, options) => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener('abort', () => reject(options!.signal!.reason), { once: true });
    }));
    const operation = expect(download_image(SOURCE, temporary, create_transport(fetch_image), 1024)).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(15_000);
    await operation;
    expect(fetch_image.mock.calls[0]![1]!.signal!.aborted).toBe(true);
  });

  it('supports shutdown cancellation without changing the image contract', async () => {
    const shutdown = new AbortController();
    const fetch_image = vi.fn<typeof fetch>((_url, options) => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener('abort', () => reject(options!.signal!.reason), { once: true });
    }));
    const operation = expect(download_image(SOURCE, temporary, create_transport(fetch_image), 1024, shutdown.signal)).rejects.toThrow('Shutdown');
    shutdown.abort(new Error('Shutdown'));
    await operation;
    await expect(download_image(SOURCE, temporary, create_transport(fetch_image), 1024, shutdown.signal)).rejects.toThrow('Shutdown');
    expect(fetch_image).toHaveBeenCalledTimes(1);
  });
});

describe('image URLs', () => {
  it.each([
    'https://images.metahub.space/poster/small/',
    'https://images.metahub.space/poster/small/./1.png',
    'https://images.metahub.space/poster/small/%00/1.png',
    'https://images.metahub.space/poster/small/%/1.png',
    'https://images.metahub.space/poster/small/%255c/1.png',
    'https://images.metahub.space:443/poster/small/1.png',
    'https://images.metahub.space./poster/small/1.png',
    ' https://images.metahub.space/poster/small/1.png',
    'https://127.0.0.1/images/1.png',
  ])('rejects unapproved or ambiguous sources: %s', source => {
    expect(() => image_url(source)).toThrow(RangeError);
  });
});
