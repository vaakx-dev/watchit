import { mkdtemp, mkdir, readFile, readdir, rm, truncate, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { create_store } from '../storage/index.ts';
import { image_path } from '../storage/paths.ts';
import type { Store } from '../storage/types.ts';
import { image_ttl } from './cache.ts';
import { create_images } from './index.ts';

const SOURCE = 'https://images.metahub.space/poster/small/tt0133093/img';
const WEBP = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAABQAQCdASoBAAEAAcAsJaQABHQAAORAAAA=', 'base64');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
let directory: string;
let store: Store;

function response(): Response {
  return new Response(WEBP, { headers: { 'Content-Type': 'image/webp' } });
}

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'streamit-images-'));
  store = create_store(directory);
});
afterEach(async () => {
  vi.restoreAllMocks();
  store.close();
  await rm(directory, { recursive: true, force: true });
});

describe('image cache', () => {
  it('cancels and drains downloads before storage can close', async () => {
    const fetch_image = vi.fn<typeof fetch>(async (_url, options) => new Promise<Response>((_resolve, reject) => {
      options!.signal!.addEventListener('abort', () => reject(options!.signal!.reason), { once: true });
    }));
    const images = create_images(store, { fetch: fetch_image });
    const key = images.register(SOURCE).split('/').at(-1)!;
    const operation = images.get(key);
    const rejected = expect(operation).rejects.toThrow();
    await vi.waitFor(() => expect(fetch_image).toHaveBeenCalledTimes(1));
    await images.stop();
    await rejected;
    expect(store.image_get(key)?.fetched_at).toBeNull();
    expect(await readdir(join(directory, 'images'))).toEqual([]);
    await expect(images.get(key)).rejects.toThrow();
    expect(() => images.register(SOURCE)).toThrow();
  });

  it('bounds downloads and promotes a queued background image for a visible request', async () => {
    let active = 0;
    let maximum = 0;
    const started: string[] = [];
    const releases = new Map<string, () => void>();
    const fetch_image = vi.fn<typeof fetch>(async url => {
      const source = String(url);
      started.push(source);
      active++;
      maximum = Math.max(maximum, active);
      await new Promise<void>(resolve => { releases.set(source, resolve); });
      active--;
      return response();
    });
    const images = create_images(store, { fetch: fetch_image });
    const visible = Array.from({ length: 6 }, (_, index) => images.register(`${SOURCE}?visible-${index}`).split('/').at(-1)!);
    const operations = visible.map(key => images.get(key));
    await vi.waitFor(() => expect(fetch_image).toHaveBeenCalledTimes(6));
    const background_source = `${SOURCE}?background`;
    const background = images.register(background_source).split('/').at(-1)!;
    const queued = images.get(background, 'background');
    expect(fetch_image).toHaveBeenCalledTimes(6);
    expect(images.get(background, 'visible')).toBe(queued);
    releases.get(started[0]!)!();
    await vi.waitFor(() => expect(fetch_image).toHaveBeenCalledTimes(7));
    expect(started[6]).toBe(background_source);
    for (const release of releases.values()) release();
    await Promise.all([...operations, queued]);
    expect(maximum).toBe(6);
    await images.stop();
  });

  it('limits background downloads to two and reserves capacity for visible images', async () => {
    let released = false;
    const started: string[] = [];
    const releases = new Map<string, () => void>();
    const fetch_image = vi.fn<typeof fetch>(async url => {
      const source = String(url);
      started.push(source);
      if (!released) await new Promise<void>(resolve => { releases.set(source, resolve); });
      return response();
    });
    const images = create_images(store, { fetch: fetch_image });
    const backgrounds = Array.from({ length: 3 }, (_, index) => images.register(`${SOURCE}?background-${index}`).split('/').at(-1)!);
    const operations = backgrounds.map(key => images.get(key, 'background'));
    await vi.waitFor(() => expect(fetch_image).toHaveBeenCalledTimes(2));
    const visible_source = `${SOURCE}?visible`;
    const visible = images.register(visible_source).split('/').at(-1)!;
    const operation = images.get(visible);
    await vi.waitFor(() => expect(fetch_image).toHaveBeenCalledTimes(3));
    expect(started[2]).toBe(visible_source);
    released = true;
    for (const release of releases.values()) release();
    await Promise.all([...operations, operation]);
    await images.stop();
  });

  it('rejects queued downloads during shutdown', async () => {
    const fetch_image = vi.fn<typeof fetch>(async (_url, options) => new Promise<Response>((_resolve, reject) => {
      options!.signal!.addEventListener('abort', () => reject(options!.signal!.reason), { once: true });
    }));
    const images = create_images(store, { fetch: fetch_image });
    const keys = Array.from({ length: 7 }, (_, index) => images.register(`${SOURCE}?queued-${index}`).split('/').at(-1)!);
    const active = Promise.allSettled(keys.slice(0, 6).map(key => images.get(key)));
    await vi.waitFor(() => expect(fetch_image).toHaveBeenCalledTimes(6));
    const queued = Promise.allSettled([images.get(keys[6]!, 'background')]);
    await images.stop();
    expect((await queued)[0]).toMatchObject({ status: 'rejected' });
    expect((await active).every(result => result.status === 'rejected')).toBe(true);
    expect(fetch_image).toHaveBeenCalledTimes(6);
  });

  it('uses SQLite accounting instead of listing the cache when a commit fits the budget', async () => {
    const bytes = vi.spyOn(store, 'image_bytes');
    const lru = vi.spyOn(store, 'image_lru');
    const list = vi.spyOn(store, 'image_list');
    const images = create_images(store, { fetch: vi.fn<typeof fetch>(async () => response()) });
    const key = images.register(SOURCE).split('/').at(-1)!;
    await images.get(key);
    expect(bytes).toHaveBeenCalledTimes(1);
    expect(lru).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
    await images.stop();
  });

  it.each([
    SOURCE,
    'https://images.metahub.space/background/medium/tt0133093/img',
    'https://episodes.metahub.space/tt0903747/1/1/w780.jpg',
    'https://image.tmdb.org/t/p/w780/ydlY3iPfeOAvu8gVqrxPoMvzNCn.jpg',
  ])('downloads approved artwork to a local hash URL: %s', async source => {
    const fetch_image = vi.fn<typeof fetch>(async () => response());
    const images = create_images(store, { fetch: fetch_image });
    const url = images.register(source);
    expect(url).toMatch(/^\/api\/images\/[a-f0-9]{64}$/);
    const key = url.split('/').at(-1)!;
    const image = await images.get(key);
    expect(await readFile(image.path)).toEqual(WEBP);
    expect(fetch_image).toHaveBeenCalledExactlyOnceWith(source, expect.objectContaining({ credentials: 'omit', redirect: 'manual' }));
    expect(Object.keys(fetch_image.mock.calls[0]![1]!.headers!)).toEqual(['Accept', 'User-Agent']);
    expect(store.image_get(key)?.source_url).toBe(source);
  });

  it('registers stable Cinemeta descriptors without fetching, then deduplicates and serves fresh bytes', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const fetch_image = vi.fn<typeof fetch>(async () => { await gate; return response(); });
    const images = create_images(store, { fetch: fetch_image });
    const url = images.register(SOURCE);
    const key = url.split('/').at(-1)!;
    expect(images.register(SOURCE)).toBe(url);
    expect(fetch_image).not.toHaveBeenCalled();
    expect(store.status().image_count).toBe(0);
    const first = images.get(key);
    const second = images.get(key);
    expect(first).toBe(second);
    release();
    const [image] = await Promise.all([first, second]);
    expect(await readFile(image.path)).toEqual(WEBP);
    expect(image).toMatchObject({ content_type: 'image/webp', stale: false });
    clock.mockReturnValue(2000);
    await images.get(key);
    expect(fetch_image).toHaveBeenCalledTimes(1);
    expect(fetch_image.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' });
    expect(store.image_get(key)).toMatchObject({ fetched_at: 1000, accessed_at: 1000 });
    expect(store.status()).toMatchObject({ image_count: 1, image_bytes: WEBP.length });
  });

  it('records views at most hourly and leaves background downloads unviewed', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(DAY);
    const images = create_images(store, { fetch: vi.fn<typeof fetch>(async () => response()) });
    const key = images.register(SOURCE).split('/').at(-1)!;
    await images.get(key, 'background');
    expect(store.image_get(key)).toMatchObject({ fetched_at: DAY, accessed_at: 0 });
    clock.mockReturnValue(DAY + 1000);
    await images.get(key, 'background');
    expect(store.image_get(key)?.accessed_at).toBe(0);
    await images.get(key);
    expect(store.image_get(key)?.accessed_at).toBe(DAY + 1000);
    clock.mockReturnValue(DAY + 1000 + HOUR - 1);
    await images.get(key);
    expect(store.image_get(key)?.accessed_at).toBe(DAY + 1000);
    clock.mockReturnValue(DAY + 1000 + HOUR);
    await images.get(key);
    expect(store.image_get(key)?.accessed_at).toBe(DAY + 1000 + HOUR);
    await images.stop();
  });

  it('uses fetch age for TTL and enforces the stale hard cutoff on origin failure', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    store.settings_update({ images_days: 0.25, max_stale_days: 1 });
    const fetch_image = vi.fn<typeof fetch>().mockResolvedValueOnce(response()).mockRejectedValue(new Error('Origin offline'));
    const images = create_images(store, { fetch: fetch_image });
    const key = images.register(SOURCE).split('/').at(-1)!;
    await images.get(key);
    const ttl = image_ttl(key, 0.25);
    expect(ttl).toBeGreaterThan(0.2 * DAY);
    expect(ttl).toBeLessThanOrEqual(0.25 * DAY);
    clock.mockReturnValue(1000 + ttl - 1);
    expect((await images.get(key)).stale).toBe(false);
    clock.mockReturnValue(1000 + ttl);
    expect((await images.get(key)).stale).toBe(true);
    expect(store.image_get(key)?.fetched_at).toBe(1000);
    clock.mockReturnValue(1000 + ttl + DAY);
    expect((await images.get(key)).stale).toBe(true);
    clock.mockReturnValue(1001 + ttl + DAY);
    await expect(images.get(key)).rejects.toThrow('Origin offline');
    expect(fetch_image).toHaveBeenCalledTimes(4);
    expect((await readdir(join(directory, 'images'))).filter(name => name.endsWith('.tmp'))).toEqual([]);
  });

  it('shares origin pauses across keys while serving fresh and permitted stale bytes', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    store.settings_update({ images_days: 1, max_stale_days: 1 });
    const fetch_image = vi.fn<typeof fetch>(async () => response());
    const images = create_images(store, { fetch: fetch_image });
    const first = images.register(SOURCE).split('/').at(-1)!;
    const second = images.register(`${SOURCE}?second`).split('/').at(-1)!;
    const fresh = images.register(`${SOURCE}?fresh`).split('/').at(-1)!;
    const missing = images.register(`${SOURCE}?missing`).split('/').at(-1)!;
    await images.get(first);
    await images.get(second);
    clock.mockReturnValue(1000 + DAY);
    await images.get(fresh);
    fetch_image.mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '120' } }));
    const paused = { status: 429, retry_at: 1000 + DAY + 120000 };
    expect(await images.get(first)).toMatchObject({ stale: true, error: paused });
    expect(await images.get(second)).toMatchObject({ stale: true, error: paused });
    expect(await images.get(fresh)).toMatchObject({ stale: false });
    await expect(images.get(missing)).rejects.toMatchObject(paused);
    expect(fetch_image).toHaveBeenCalledTimes(4);
    store.settings_update({ max_stale_days: 0 });
    await expect(images.get(second)).rejects.toMatchObject(paused);
    expect(fetch_image).toHaveBeenCalledTimes(4);
    clock.mockReturnValue(1000 + DAY + 120000);
    expect(await images.get(second)).toMatchObject({ stale: false });
    expect(fetch_image).toHaveBeenCalledTimes(5);
    await images.stop();
  });

  it('does not serve stale bytes when stale fallback is disabled', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    store.settings_update({ images_days: 0.25, max_stale_days: 0 });
    const fetch_image = vi.fn<typeof fetch>().mockResolvedValueOnce(response()).mockRejectedValue(new Error('Origin offline'));
    const images = create_images(store, { fetch: fetch_image });
    const key = images.register(SOURCE).split('/').at(-1)!;
    await images.get(key);
    clock.mockReturnValue(1000 + 0.25 * DAY);
    await expect(images.get(key)).rejects.toThrow('Origin offline');
    expect(store.image_get(key)?.fetched_at).toBe(1000);
  });

  it('clears missing file accounting on a failed refetch and retains sources after reopening', async () => {
    const fetch_image = vi.fn<typeof fetch>(async () => response());
    let images = create_images(store, { fetch: fetch_image });
    const key = images.register(SOURCE).split('/').at(-1)!;
    const image = await images.get(key);
    await unlink(image.path);
    fetch_image.mockRejectedValueOnce(new Error('Origin offline'));
    await expect(images.get(key)).rejects.toThrow('Origin offline');
    expect(store.image_get(key)).toMatchObject({ bytes: 0, fetched_at: null });
    expect(store.image_bytes()).toBe(0);
    await images.stop();
    store.close();
    store = create_store(directory);
    images = create_images(store, { fetch: fetch_image });
    await images.get(key);
    expect(fetch_image).toHaveBeenCalledTimes(3);
    expect(store.status().image_count).toBe(1);
    await images.stop();
  });

  it('evicts least recently accessed bytes but retains descriptors for later refetch', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(10_000);
    store.settings_update({ image_limit_mb: 16 });
    const fetch_image = vi.fn<typeof fetch>(async () => response());
    const images = create_images(store, { fetch: fetch_image });
    const oldest = images.register(`${SOURCE}?oldest`).split('/').at(-1)!;
    const newest = images.register(`${SOURCE}?newest`).split('/').at(-1)!;
    const current = images.register(SOURCE).split('/').at(-1)!;
    await mkdir(join(directory, 'images'));
    for (const [index, key] of [oldest, newest].entries()) {
      await writeFile(image_path(directory, key), WEBP);
      await truncate(image_path(directory, key), 8 * 1024 * 1024);
      store.image_put({ ...store.image_get(key)!, content_type: 'image/webp', bytes: 8 * 1024 * 1024, fetched_at: 1000 - index, accessed_at: 1000 + index });
    }
    await images.get(current);
    expect(store.image_get(oldest)).toMatchObject({ source_url: `${SOURCE}?oldest`, bytes: 0, fetched_at: null, content_type: null });
    expect(store.image_get(newest)?.bytes).toBe(8 * 1024 * 1024);
    expect(store.status().image_count).toBe(2);
    clock.mockReturnValue(20_000);
    await images.get(oldest);
    expect(store.image_get(oldest)?.bytes).toBe(WEBP.length);
    expect(fetch_image).toHaveBeenCalledTimes(2);
  });

  it('keeps background downloads within the budget and evicts visible overflow down to 90%', async () => {
    store.settings_update({ image_limit_mb: 16 });
    const images = create_images(store, { fetch: vi.fn<typeof fetch>(async () => response()) });
    const keys = Array.from({ length: 16 }, (_, index) => images.register(`${SOURCE}?${index}`).split('/').at(-1)!);
    await mkdir(join(directory, 'images'));
    for (const [index, key] of keys.entries()) {
      await writeFile(image_path(directory, key), WEBP);
      await truncate(image_path(directory, key), 1024 * 1024);
      store.image_put({ ...store.image_get(key)!, content_type: 'image/webp', bytes: 1024 * 1024, fetched_at: Date.now(), accessed_at: index });
    }
    const current = images.register(SOURCE).split('/').at(-1)!;
    expect(images.full()).toBe(true);
    await expect(images.get(current, 'background')).rejects.toThrow('Image cache is full');
    expect(store.image_bytes()).toBe(16 * 1024 * 1024);
    await images.get(current);
    expect(keys.map(key => store.image_get(key)!.bytes > 0)).toEqual([false, false, ...Array.from({ length: 14 }, () => true)]);
    expect(store.image_bytes()).toBe(14 * 1024 * 1024 + WEBP.length);
    expect(images.full()).toBe(false);
    await images.stop();
  });

  it('accounts for replacement bytes when enforcing a reduced cache budget', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(DAY);
    store.settings_update({ image_limit_mb: 32, images_days: 0.25 });
    const images = create_images(store, { fetch: vi.fn<typeof fetch>(async () => response()) });
    const keys = ['oldest', 'middle', 'replacement'].map(name => images.register(`${SOURCE}?${name}`).split('/').at(-1)!);
    await mkdir(join(directory, 'images'));
    for (const [index, key] of keys.entries()) {
      await writeFile(image_path(directory, key), WEBP);
      await truncate(image_path(directory, key), 8 * 1024 * 1024);
      store.image_put({ ...store.image_get(key)!, content_type: 'image/webp', bytes: 8 * 1024 * 1024, fetched_at: 1000, accessed_at: index });
    }
    store.settings_update({ image_limit_mb: 16 });
    expect(store.image_bytes()).toBe(24 * 1024 * 1024);
    await images.get(keys[2]!);
    expect(store.image_get(keys[0]!)?.bytes).toBe(0);
    expect(store.image_get(keys[1]!)?.bytes).toBe(8 * 1024 * 1024);
    expect(store.image_get(keys[2]!)?.bytes).toBe(WEBP.length);
    expect(store.image_bytes()).toBe(8 * 1024 * 1024 + WEBP.length);
    await images.stop();
  });

  it('re-encodes downloads to WebP within display bounds and records the stored size', async () => {
    const jpeg = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#468' } }).jpeg().toBuffer();
    const images = create_images(store, { fetch: vi.fn<typeof fetch>(async () => new Response(jpeg, { headers: { 'Content-Type': 'image/jpeg' } })) });
    const key = images.register(SOURCE).split('/').at(-1)!;
    const image = await images.get(key);
    const stored = await readFile(image.path);
    expect(image.content_type).toBe('image/webp');
    expect(await sharp(stored).metadata()).toMatchObject({ format: 'webp', width: 1620, height: 1080 });
    expect(store.image_get(key)).toMatchObject({ content_type: 'image/webp', bytes: stored.length });
    expect(store.image_bytes()).toBe(stored.length);
    await images.stop();
  });

  it('recompresses cached images in the background without changing their version', async () => {
    store.settings_update({ image_limit_mb: 16 });
    const jpeg = await sharp({ create: { width: 300, height: 450, channels: 3, background: '#000', noise: { type: 'gaussian', mean: 128, sigma: 40 } } }).jpeg({ quality: 95 }).toBuffer();
    const images = create_images(store, { fetch: vi.fn<typeof fetch>() });
    const [cached, missing] = ['cached', 'missing'].map(name => images.register(`${SOURCE}?${name}`).split('/').at(-1)!);
    await mkdir(join(directory, 'images'));
    await writeFile(image_path(directory, cached!), jpeg);
    const missing_bytes = Math.ceil(16 * 1024 * 1024 * 0.9) - jpeg.length;
    store.image_put({ ...store.image_get(cached!)!, content_type: 'image/jpeg', bytes: jpeg.length, fetched_at: 1000, accessed_at: 2000 });
    store.image_put({ ...store.image_get(missing!)!, content_type: 'image/jpeg', bytes: missing_bytes, fetched_at: 1000, accessed_at: 2000 });
    expect(images.full()).toBe(true);
    images.recompress();
    await vi.waitFor(() => expect(store.image_get(cached!)?.content_type).toBe('image/webp'));
    const stored = await readFile(image_path(directory, cached!));
    expect(stored.length).toBeLessThan(jpeg.length);
    expect(store.image_get(cached!)).toMatchObject({ bytes: stored.length, fetched_at: 1000, accessed_at: 2000 });
    expect(store.image_get(missing!)).toMatchObject({ content_type: 'image/jpeg', bytes: missing_bytes });
    expect(images.full()).toBe(false);
    expect(await readdir(join(directory, 'images'))).toEqual([cached]);
    await images.stop();
  });

  it('rejects off-host URLs, credentials, fragments, ports, and invalid API keys before fetching', async () => {
    const fetch_image = vi.fn<typeof fetch>();
    const images = create_images(store, { fetch: fetch_image });
    for (const url of [
      SOURCE.replace('https:', 'http:'), SOURCE.replace('images.metahub.space', 'evil.example'),
      SOURCE.replace('images.metahub.space', 'images.metahub.space.evil.example'),
      SOURCE.replace('https://', 'https://user:pass@'), `${SOURCE}#fragment`, `${SOURCE}#`,
      SOURCE.replace('.space/', '.space:444/'), SOURCE.replace('.space/', '.space:443/'),
      SOURCE.replace('/poster/', '/poster/a/../'), SOURCE.replace('/poster/', '/poster/%2e%2e/poster/'),
      SOURCE.replace('/poster/', '/poster/%252f/'), SOURCE.replace('/poster/', '/poster/%5c/'),
      SOURCE.replace('/poster/', '/private/'), 'https://127.0.0.1/image.png', 'not a URL',
    ]) {
      expect(() => images.register(url)).toThrow(RangeError);
    }
    await expect(images.get('../private')).rejects.toThrow(RangeError);
    await expect(images.get('a'.repeat(64))).rejects.toThrow('Image not found');
    expect(fetch_image).not.toHaveBeenCalled();
  });

  it('rejects unsafe redirects, active formats, false raster MIME, and oversized responses without leaving files', async () => {
    const fetch_image = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: 'https://evil.example/image' } }))
      .mockResolvedValueOnce(new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } }))
      .mockResolvedValueOnce(new Response('<svg/>', { headers: { 'Content-Type': 'image/webp' } }))
      .mockResolvedValueOnce(new Response(WEBP, { headers: { 'Content-Type': 'image/webp', 'Content-Length': String(21 * 1024 * 1024) } }))
      .mockResolvedValueOnce(new Response(new Uint8Array(21 * 1024 * 1024), { headers: { 'Content-Type': 'image/webp' } }));
    const images = create_images(store, { fetch: fetch_image });
    const key = images.register(SOURCE).split('/').at(-1)!;
    for (const message of ['302', 'Unsupported', 'does not match', 'size limit', 'size limit']) await expect(images.get(key)).rejects.toThrow(message);
    expect(await readdir(join(directory, 'images'))).toEqual([]);
    expect(store.image_get(key)?.fetched_at).toBeNull();
    expect(store.status().image_bytes).toBe(0);
  });
});
