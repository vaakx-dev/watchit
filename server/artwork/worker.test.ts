import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageCredit, ImdbId, Title } from '../../src/catalog/types.ts';
import { create_attribution } from '../attribution/index.ts';
import type { Attribution } from '../attribution/types.ts';
import { create_images } from '../media/index.ts';
import { create_store } from '../storage/index.ts';
import type { Store } from '../storage/types.ts';
import { identity } from './selection.ts';
import { create_artwork } from './worker.ts';

const WEBP = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAABQAQCdASoBAAEAAcAsJaQABHQAAORAAAA=', 'base64');
function poster(id: ImdbId = 'tt0133093'): ImageCredit {
  return { source: 'cinemeta', role: 'poster', source_url: `https://images.metahub.space/poster/small/${id}/img`, url: '',
    description_url: `https://v3-cinemeta.strem.io/meta/movie/${id}.json`, terms_url: 'https://www.metahub.space/terms', author: '', license: '', license_url: '' };
}
function title(id: ImdbId = 'tt0133093'): Title {
  return { id, title: `Movie ${id}`, kind: 'movie', year: 2024, anime: false, genres: ['Drama'], artwork: '', backdrop: '',
    minutes: null, synopsis: '', director: '', cast: '', imdb_id: id, tmdb_id: null,
    series: null, season: null, episode: null, related: [], images: [poster(id)], source_url: `https://v3-cinemeta.strem.io/meta/movie/${id}.json` };
}
let directory: string;
let store: Store;
let worker: ReturnType<typeof create_artwork> | undefined;
let images: ReturnType<typeof create_images>;
const fetch_image = vi.fn<typeof fetch>();

function put(item: Title) {
  store.title_put([{ title: { ...item, images: item.images.map(image => ({ ...image, url: image.source === 'cinemeta' ? images.register(image.source_url!) : image.url })) }, genres: [] }]);
}
function start(ids = ['tt0133093'], attribution: Attribution = create_attribution(join(directory, 'attribution'))) {
  worker = create_artwork(store, images, attribution, { interval_ms: 5 });
  worker.request(ids);
  worker.start();
}
async function ready(id = 'tt0133093') {
  await vi.waitFor(() => expect(worker!.status([id]).pending).toBe(false));
}

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'streamit-artwork-'));
  store = create_store(directory);
  fetch_image.mockReset().mockImplementation(async () => new Response(WEBP, { headers: { 'Content-Type': 'image/webp' } }));
  images = create_images(store, { fetch: fetch_image });
  put(title());
});
afterEach(async () => {
  await Promise.all([worker?.stop(), images.stop()]);
  worker = undefined;
  store.close();
  vi.useRealTimers();
  vi.restoreAllMocks();
  await rm(directory, { recursive: true, force: true });
});

describe('Cinemeta artwork', () => {
  it('publishes versioned local URLs only after download and archives supplied provenance', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    fetch_image.mockImplementation(async () => { await gate; return new Response(WEBP, { headers: { 'Content-Type': 'image/webp' } }); });
    const timestamp = store.title_get('tt0133093')!.updated_at;
    start();
    await vi.waitFor(() => expect(fetch_image).toHaveBeenCalledTimes(1));
    expect(store.title_get('tt0133093')!.value.artwork).toBe('');
    expect(worker!.status(['tt0133093']).pending).toBe(true);
    release();
    await ready();
    const snapshot = store.title_get('tt0133093')!;
    expect(snapshot.updated_at).toBe(timestamp);
    expect(snapshot.value.artwork).toMatch(/^\/api\/images\/[a-f0-9]{64}\?v=\d+$/);
    expect(snapshot.value.images[0]).toMatchObject({ ...poster(), url: snapshot.value.artwork });
    expect(snapshot.value.backdrop).toBe(snapshot.value.artwork);
    expect(store.catalog_query({ kind: 'movie', page: 1, query: '', genre: '', sort: 'title' }).items[0]?.artwork).toBe(snapshot.value.artwork);
    await worker!.stop();
    const image_key = snapshot.value.artwork.split('/').at(-1)!.split('?')[0]!;
    const archived = await readFile(join(directory, 'attribution', 'images', `${image_key}.json`), 'utf8');
    expect(archived).toContain(poster().source_url);
    expect(archived).toContain('https://www.metahub.space/terms');
    expect(fetch_image).toHaveBeenCalledTimes(1);
  });

  it('reopens ready artwork offline', async () => {
    start();
    await ready();
    const url = store.title_get('tt0133093')!.value.artwork;
    await worker!.stop();
    await images.stop();
    store.close();
    store = create_store(directory);
    fetch_image.mockClear().mockRejectedValue(new Error('Network blocked'));
    images = create_images(store, { fetch: fetch_image });
    start();
    expect(worker!.status(['tt0133093']).pending).toBe(false);
    const cached = await images.get(url.split('/').at(-1)!.split('?')[0]!);
    expect(await readFile(cached.path)).toEqual(WEBP);
    expect(fetch_image).not.toHaveBeenCalled();
  });

  it('prioritizes requested titles and isolates retry delays per title', async () => {
    put(title('tt0903747'));
    fetch_image.mockImplementation(async url => {
      if (String(url).includes('tt0903747')) throw new Error('Image unavailable');
      return new Response(WEBP, { headers: { 'Content-Type': 'image/webp' } });
    });
    const download = vi.spyOn(images, 'get');
    start(['tt0903747', 'tt0133093']);
    await ready();
    expect(store.image_get(download.mock.calls[0]![0])?.source_url).toContain('tt0903747');
    await vi.waitFor(() => expect(worker!.status(['tt0903747'])).toMatchObject({ pending: true, error: 'Image unavailable' }));
    worker!.request(['tt0903747']);
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(fetch_image).toHaveBeenCalledTimes(2);
  });

  it('persists failures across restarts and retries when their delay expires', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const now = Date.now();
    fetch_image.mockRejectedValueOnce(new Error('Offline'));
    start();
    await vi.waitFor(() => expect(worker!.status(['tt0133093']).error).toBe('Offline'));
    await worker!.stop();
    start();
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(fetch_image).toHaveBeenCalledTimes(1);
    vi.setSystemTime(now + 61000);
    worker!.request(['tt0133093']);
    await ready();
    expect(fetch_image).toHaveBeenCalledTimes(2);
  });

  it('retries titles that an earlier check version marked as permanent redirect failures', async () => {
    store.cache_set('cinemeta:artwork:download:v1:tt0133093', {
      identity: identity(store.title_get('tt0133093')!.value), retry_at: Date.now() + 30 * 86400000, error: 'Image origin returned 307: unsafe redirect', failures: 1,
    });
    start();
    await ready();
    expect(fetch_image).toHaveBeenCalledTimes(1);
    expect(store.title_get('tt0133093')!.value.artwork).toMatch(/\?v=\d+$/);
  });

  it.each([false, true])('shares origin cooldowns with API requests and persists their retry time (stale: %s)', async stale => {
    const now = Date.UTC(2026, 0, 1);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    store.settings_update({ images_days: 1, max_stale_days: 1 });
    if (stale) {
      const url = store.title_get('tt0133093')!.value.images[0]!.url;
      await images.get(url.split('/').at(-1)!);
    }
    const failed_at = now + 86400001;
    clock.mockReturnValue(failed_at);
    put(title('tt0903747'));
    fetch_image.mockImplementation(async () => new Response(null, { status: 429, headers: { 'Retry-After': '120' } }));
    start(['tt0133093', 'tt0903747']);
    await vi.waitFor(() => {
      for (const id of ['tt0133093', 'tt0903747']) expect(worker!.status([id]).error).toContain('429');
    });
    for (const id of ['tt0133093', 'tt0903747']) {
      expect(store.cache_get<{ retry_at: number }>(`cinemeta:artwork:download:v1:${id}`)?.value.retry_at).toBe(failed_at + 120000);
    }
    const attempts = fetch_image.mock.calls.length;
    expect(attempts).toBeLessThanOrEqual(stale ? 3 : 2);
    if (stale) expect(store.title_get('tt0133093')!.value.artwork).toContain(`?v=${now}`);
    const extra = images.register('https://images.metahub.space/poster/small/tt9999999/img').split('/').at(-1)!;
    await expect(images.get(extra)).rejects.toMatchObject({ status: 429, retry_at: failed_at + 120000 });
    clock.mockReturnValue(failed_at + 119999);
    worker!.request(['tt0133093', 'tt0903747']);
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(fetch_image).toHaveBeenCalledTimes(attempts);
    fetch_image.mockImplementation(async () => new Response(WEBP, { headers: { 'Content-Type': 'image/webp' } }));
    clock.mockReturnValue(failed_at + 120000);
    worker!.request(['tt0133093', 'tt0903747']);
    await ready('tt0133093');
    await ready('tt0903747');
    expect(fetch_image).toHaveBeenCalledTimes(attempts + 2);
  });

  it('keeps the longest source delay when several descriptors fail', async () => {
    const now = Date.UTC(2026, 0, 1);
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const item = title();
    item.images.push({ ...poster(), role: 'still', source_url: 'https://episodes.metahub.space/tt0903747/1/1/w780.jpg' });
    put(item);
    fetch_image
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 503, headers: { 'Retry-After': '300' } }));
    start();
    await vi.waitFor(() => expect(worker!.status(['tt0133093']).error).toContain('503'));
    expect(store.cache_get<{ retry_at: number }>('cinemeta:artwork:download:v1:tt0133093')?.value.retry_at).toBe(now + 300000);
    expect(fetch_image).toHaveBeenCalledTimes(2);
  });

  it('skips image-free records in batches instead of delaying each download behind them', async () => {
    vi.useFakeTimers();
    for (let index = 1; index <= 150; index++) {
      put({ ...title(`tt${String(index).padStart(7, '0')}` as ImdbId), images: [] });
    }
    const download = vi.spyOn(images, 'get').mockImplementation(async key => {
      store.image_put({ ...store.image_get(key)!, content_type: 'image/webp', bytes: WEBP.length, fetched_at: Date.now() });
      return { path: '', content_type: 'image/webp', stale: false };
    });
    worker = create_artwork(store, images, { record: async () => {} }, { interval_ms: 5 });
    worker.start();
    await vi.advanceTimersByTimeAsync(5);
    expect(download).toHaveBeenCalledTimes(1);
    expect(worker.status(['tt0133093']).pending).toBe(false);
  });

  it.each([
    ['404', () => new Response(null, { status: 404 })],
    ['unsafe redirect', () => new Response(null, { status: 307, headers: { Location: 'https://evil.example/image' } })],
  ])('waits the image lifetime after a permanent failure: %s', async (message, failure) => {
    const now = Date.UTC(2026, 0, 1);
    vi.spyOn(Date, 'now').mockReturnValue(now);
    store.settings_update({ images_days: 2 });
    fetch_image.mockImplementation(async () => failure());
    start();
    await vi.waitFor(() => expect(worker!.status(['tt0133093']).error).toContain(message));
    expect(store.cache_get<{ retry_at: number }>('cinemeta:artwork:download:v1:tt0133093')?.value.retry_at).toBe(now + 2 * 86400000);
  });

  it('backs off repeated transient failures exponentially', async () => {
    const now = Date.UTC(2026, 0, 1);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    fetch_image.mockRejectedValue(new Error('Offline'));
    const retry_at = () => store.cache_get<{ retry_at: number }>('cinemeta:artwork:download:v1:tt0133093')?.value.retry_at;
    start();
    await vi.waitFor(() => expect(retry_at()).toBe(now + 60000));
    clock.mockReturnValue(now + 60000);
    worker!.request(['tt0133093']);
    await vi.waitFor(() => expect(retry_at()).toBe(now + 180000));
  });

  it('stops prefetching and reports nothing pending when the image cache is nearly full', async () => {
    vi.spyOn(images, 'full').mockReturnValue(true);
    start();
    expect(worker!.status(['tt0133093']).pending).toBe(false);
    expect(worker!.status().pending).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(fetch_image).not.toHaveBeenCalled();
  });

  it('archives only titles that changed since their last export', async () => {
    vi.spyOn(images, 'full').mockReturnValue(true);
    const record = vi.fn(async () => {});
    async function run() {
      worker = create_artwork(store, images, { record });
      worker.start();
      await vi.waitFor(() => expect(record).toHaveBeenCalled());
      await worker.stop();
    }
    await run();
    worker = create_artwork(store, images, { record });
    worker.start();
    await worker.stop();
    expect(record).toHaveBeenCalledTimes(1);
    put({ ...title(), synopsis: 'Changed' });
    record.mockClear();
    await run();
    expect(record).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ synopsis: 'Changed' }));
  });

  it('retries failed downloads in the background without another title request', async () => {
    fetch_image.mockRejectedValueOnce(new Error('Offline'));
    worker = create_artwork(store, images, create_attribution(join(directory, 'attribution')), { interval_ms: 5, retry_ms: 20 });
    worker.start();
    await ready();
    expect(fetch_image).toHaveBeenCalledTimes(2);
  });

  it('processes changed descriptors without waiting for an obsolete failure delay', async () => {
    fetch_image.mockRejectedValueOnce(new Error('Offline'));
    start();
    await vi.waitFor(() => expect(worker!.status(['tt0133093']).error).toBe('Offline'));
    const current = title();
    current.images = [{ ...poster(), source_url: 'https://images.metahub.space/poster/small/tt0903747/img' }];
    put(current);
    expect(worker!.request(['tt0133093']).error).toBeNull();
    await ready();
    expect(fetch_image).toHaveBeenCalledTimes(2);
  });

  it('marks stale cache pending, preserves fallback, and retries its download', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const now = Date.now();
    store.settings_update({ images_days: 1, max_stale_days: 1 });
    start();
    await ready();
    const previous = store.title_get('tt0133093')!.value.artwork;
    vi.setSystemTime(now + 86401000);
    fetch_image.mockRejectedValueOnce(new Error('Offline'));
    expect(worker!.status(['tt0133093']).pending).toBe(true);
    worker!.request(['tt0133093']);
    await vi.waitFor(() => expect(worker!.status(['tt0133093']).error).toContain('stale'));
    expect(store.title_get('tt0133093')!.value.artwork).toBe(previous);
    vi.setSystemTime(now + 86500000);
    worker!.request(['tt0133093']);
    await ready();
    expect(store.title_get('tt0133093')!.value.artwork).not.toBe(previous);
  });

  it('prefetches posters and episode stills but loads backdrops only on demand', async () => {
    const item = title();
    const backdrop = 'https://images.metahub.space/background/medium/tt0133093/img';
    item.images.push({ ...poster(), role: 'backdrop', source_url: backdrop });
    item.backdrop = images.register(backdrop);
    put(item);
    const episode = { ...title('tt0903747'), id: 'tt0903747:1:1', kind: 'episode' as const, season: 1, episode: 1,
      series: { id: 'tt0903747', title: 'Breaking Bad', imdb_id: 'tt0903747' as const, tmdb_id: null },
      images: [{ ...poster('tt0903747'), role: 'still' as const, source_url: 'https://episodes.metahub.space/tt0903747/1/1/w780.jpg' }] };
    put(episode);
    start(['tt0133093', episode.id]);
    await ready();
    await ready(episode.id);
    const updated = store.title_get('tt0133093')!.value;
    expect(updated.artwork).not.toBe(updated.backdrop);
    const still = store.title_get(episode.id)!.value;
    expect(still.artwork).toBe(still.backdrop);
    expect(still.artwork).toContain('?v=');
    expect(fetch_image).toHaveBeenCalledTimes(2);
    expect(updated.backdrop).toBe(item.backdrop);
    const key = item.backdrop.split('/').at(-1)!;
    expect(store.image_get(key)?.fetched_at).toBeNull();
    await images.get(key);
    expect(fetch_image).toHaveBeenCalledTimes(3);
  });


  it('publishes posters while the visible banner is still downloading', async () => {
    const item = title();
    const backdrop = 'https://images.metahub.space/background/medium/tt0133093/img';
    item.images.push({ ...poster(), role: 'backdrop', source_url: backdrop });
    item.backdrop = images.register(backdrop);
    put(item);
    put(title('tt0903747'));
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let banner_ready = false;
    fetch_image.mockImplementation(async url => {
      if (url === backdrop) await gate;
      return new Response(WEBP, { headers: { 'Content-Type': 'image/webp' } });
    });
    const banner = images.get(item.backdrop.split('/').at(-1)!).then(() => { banner_ready = true; });
    try {
      await vi.waitFor(() => expect(fetch_image).toHaveBeenCalledTimes(1));
      start(['tt0133093', 'tt0903747']);
      await ready('tt0133093');
      await ready('tt0903747');
      expect(banner_ready).toBe(false);
      expect(store.title_get('tt0133093')!.value.artwork).toContain('?v=');
      expect(store.title_get('tt0903747')!.value.artwork).toContain('?v=');
    } finally {
      release();
      await banner;
    }
  });

  it('prefetches two titles at a time and fills a free slot without the scan delay', async () => {
    const ids = ['tt0133093', 'tt0903747', 'tt0000001', 'tt0000002'] as const;
    for (const id of ids.slice(1)) put(title(id));
    const gates = ids.map(() => {
      let resolve!: () => void;
      const promise = new Promise<void>(done => { resolve = done; });
      return { promise, resolve };
    });
    fetch_image.mockImplementation(async url => {
      const index = ids.findIndex(id => String(url).includes(id));
      await gates[index]!.promise;
      return new Response(WEBP, { headers: { 'Content-Type': 'image/webp' } });
    });
    worker = create_artwork(store, images, { record: async () => {} }, { interval_ms: 60000 });
    worker.request(ids);
    worker.start();
    try {
      await vi.waitFor(() => expect(fetch_image).toHaveBeenCalledTimes(2));
      expect(worker.status(ids).running).toBe(true);
      gates[0]!.resolve();
      await vi.waitFor(() => expect(fetch_image).toHaveBeenCalledTimes(3));
      expect(worker.status([ids[1]]).running).toBe(true);
      expect(worker.status([ids[2]]).running).toBe(true);
      expect(worker.status([ids[3]]).running).toBe(false);
    } finally {
      gates.forEach(gate => gate.resolve());
    }
    for (const id of ids) await ready(id);
  });

  it('discards obsolete download results after a metadata descriptor change', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    fetch_image.mockImplementationOnce(async () => { await gate; return new Response(WEBP, { headers: { 'Content-Type': 'image/webp' } }); });
    start();
    await vi.waitFor(() => expect(fetch_image).toHaveBeenCalledTimes(1));
    const current = title();
    current.images = [{ ...poster(), source_url: 'https://images.metahub.space/poster/small/tt0903747/img' }];
    put(current);
    release();
    await ready();
    expect(store.title_get('tt0133093')!.value.images[0]?.source_url).toContain('tt0903747');
    expect(fetch_image).toHaveBeenCalledTimes(2);
  });

  it('archives current snapshots instead of stale startup batches', async () => {
    put(title('tt0903747'));
    put(title('tt9999999'));
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const records: Title[] = [];
    let tail = Promise.resolve();
    const archive: Attribution = { record(item) {
      const snapshot = structuredClone(item);
      const operation = tail.then(async () => {
        if (snapshot.id === 'tt0903747') await gate;
        records.push(snapshot);
      });
      tail = operation;
      return operation;
    } };
    start(['tt9999999'], archive);
    try {
      await vi.waitFor(() => expect(store.title_get('tt9999999')!.value.artwork).toContain('?v='));
    } finally { release(); }
    await vi.waitFor(() => expect(records.filter(item => item.id === 'tt9999999').length).toBeGreaterThanOrEqual(1));
    expect(records.filter(item => item.id === 'tt9999999').at(-1)?.artwork).toBe(store.title_get('tt9999999')!.value.artwork);
  });

  it('drains an in-flight download without publishing after stop', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    fetch_image.mockImplementationOnce(async () => { await gate; return new Response(WEBP, { headers: { 'Content-Type': 'image/webp' } }); });
    start();
    await vi.waitFor(() => expect(fetch_image).toHaveBeenCalledTimes(1));
    const closing = worker!.stop();
    release();
    await closing;
    expect(store.title_get('tt0133093')!.value.artwork).toBe('');
  });

  it('does not start disabled work', async () => {
    worker = create_artwork(store, images, create_attribution(join(directory, 'attribution')), { enabled: false });
    worker.start();
    expect(worker.request(['tt0133093'])).toMatchObject({ pending: false, running: false });
    await worker.stop();
    expect(fetch_image).not.toHaveBeenCalled();
  });
});
