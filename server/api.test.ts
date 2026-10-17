import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CacheStatus } from '../src/cache/types.ts';
import type { LibraryPage, LibrarySnapshot } from '../src/library/types.ts';
import { SESSION_HEADER } from '../src/profiles/types.ts';
import { close_services, handle_api } from './api.ts';
import { image_ttl } from './media/cache.ts';
import { image_path } from './storage/paths.ts';
import { create_store } from './storage/index.ts';
import type { Title } from '../src/catalog/types.ts';

let directory: string;
let server: Server;
let origin: string;
let token: string;

const movie: Title = {
  id: 'tt0133093', title: 'Example', year: 2024, artwork: '', backdrop: '', genres: [], kind: 'movie', anime: false,
  minutes: null, synopsis: '', director: '', cast: '', imdb_id: 'tt0133093', tmdb_id: null,
  season: null, episode: null, series: null, related: [], images: [],
  source_url: 'https://v3-cinemeta.strem.io/meta/movie/tt0133093.json',
};
const IMAGE_SOURCE = 'https://images.metahub.space/poster/small/tt0133093/img';
const IMAGE_KEY = createHash('sha256').update(IMAGE_SOURCE).digest('hex');
const IMAGE_BYTES = Buffer.from('cached image');
const DAY = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'streamit-api-'));
  vi.stubEnv('STREAMIT_DATA_DIR', directory);
  vi.stubEnv('STREAMIT_SYNC', 'off');
  const store = create_store(directory);
  store.title_put([{ title: movie, genres: [] }]);
  token = store.session_create(store.profile_create('test').id);
  store.close();
  server = createServer((req, res) => handle_api(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await close_services();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await rm(directory, { recursive: true, force: true });
});

function get(path: string) {
  return fetch(`${origin}${path}`, { headers: { [SESSION_HEADER]: token } });
}

function patch(path: string, value: unknown) {
  return fetch(`${origin}${path}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', [SESSION_HEADER]: token }, body: JSON.stringify(value),
  });
}

async function seed_image(fetched_at: number, images_days: number) {
  const store = create_store(directory);
  store.settings_update({ images_days });
  await mkdir(join(directory, 'images'), { recursive: true });
  await writeFile(image_path(directory, IMAGE_KEY), IMAGE_BYTES);
  store.image_put({ key: IMAGE_KEY, source_url: IMAGE_SOURCE, content_type: 'image/png', bytes: IMAGE_BYTES.length, fetched_at, accessed_at: fetched_at });
  store.close();
  return IMAGE_KEY;
}

function series_titles(): { series: Title; episode: Title } {
  const series: Title = {
    ...movie, id: 'tt0903747', title: 'Breaking Bad', year: 2008, kind: 'series', imdb_id: 'tt0903747',
    source_url: 'https://v3-cinemeta.strem.io/meta/series/tt0903747.json',
  };
  const episode: Title = {
    ...series, id: 'tt0903747:1:2', title: "Cat's in the Bag...", kind: 'episode', imdb_id: null,
    season: 1, episode: 2,
    series: { id: series.id, title: series.title, imdb_id: series.imdb_id, tmdb_id: null },
  };
  return { series, episode };
}

describe('local API', () => {
  it('keeps rating, status, favorite, saved, and opened changes independent', async () => {
    const first = await patch('/api/library/tt0133093', { rating: 4.5, saved: true });
    expect(first.status).toBe(200);
    const saved = await first.json() as LibrarySnapshot;
    expect(saved.entries.tt0133093).toMatchObject({ rating: 4.5, status: null, favorite: false, saved: true, last_opened_at: null });
    expect(saved.saved.map(title => title.id)).toEqual(['tt0133093']);
    const second = await patch('/api/library/tt0133093', { status: 'watched', favorite: true, opened: true });
    const watched = await second.json() as LibrarySnapshot;
    expect(watched.entries.tt0133093).toMatchObject({ rating: 4.5, status: 'watched', favorite: true, saved: true });
    expect(watched.entries.tt0133093!.last_opened_at).not.toBeNull();
    expect(watched.recent.map(title => title.id)).toEqual(['tt0133093']);
    const invalid = await patch('/api/library/tt0133093', { status: 'queued' });
    expect(invalid.status).toBe(400);
    await invalid.json();
    const cleared = await patch('/api/library/tt0133093', { rating: null, status: null });
    expect((await cleared.json() as LibrarySnapshot).entries.tt0133093).toMatchObject({ rating: null, status: null, favorite: true, saved: true });
  });

  it('keeps recommended per profile, independent of favourite, and lists it as a library tab', async () => {
    const store = create_store(directory);
    const other = store.session_create(store.profile_create('other').id);
    store.close();
    const on = await patch('/api/library/tt0133093', { recommended: true, status: 'watched' });
    expect((await on.json() as LibrarySnapshot).entries.tt0133093).toMatchObject({ recommended: true, favorite: false });
    const tab = await (await get('/api/library/titles?status=recommended')).json() as LibraryPage;
    expect([tab.total, tab.counts.recommended, tab.counts.favorite, tab.items[0]?.entry.recommended]).toEqual([1, 1, 0, true]);
    const other_library = await (await fetch(`${origin}/api/library`, { headers: { [SESSION_HEADER]: other } })).json() as LibrarySnapshot;
    expect(other_library.entries.tt0133093).toBeUndefined();
    const off = await patch('/api/library/tt0133093', { recommended: false });
    expect((await off.json() as LibrarySnapshot).entries.tt0133093).toMatchObject({ recommended: false, status: 'watched' });
    expect((await patch('/api/library/tt0133093', { recommended: 'yes' })).status).toBe(400);
  });

  it('stores independent season ratings for an actual series and persists them without title entries', async () => {
    const store = create_store(directory);
    const { series, episode } = series_titles();
    store.title_put([series, episode].map(title => ({ title, genres: [] })));
    store.close();

    const title = await patch(`/api/library/${series.id}`, { rating: 4.5, status: 'watching', favorite: true });
    expect(title.status).toBe(200);
    const first = await patch(`/api/library/${series.id}/seasons/1`, { rating: 4 });
    expect(first.status).toBe(200);
    const first_library = await first.json() as LibrarySnapshot;
    expect(first_library.entries[series.id]).toMatchObject({ rating: 4.5, status: 'watching', favorite: true });
    expect(first_library.entries[episode.id]).toBeUndefined();
    expect(first_library.seasons).toEqual({ [series.id]: { 1: 4 } });

    const second = await patch(`/api/library/${series.id}/seasons/2`, { rating: 2.5 });
    expect((await second.json() as LibrarySnapshot).seasons).toEqual({ [series.id]: { 1: 4, 2: 2.5 } });
    const cleared = await patch(`/api/library/${series.id}/seasons/1`, { rating: null });
    expect((await cleared.json() as LibrarySnapshot).seasons).toEqual({ [series.id]: { 2: 2.5 } });
    expect((await (await get(`/api/library`)).json() as LibrarySnapshot).entries[series.id]).toMatchObject({ rating: 4.5, status: 'watching' });

    await close_services();
    const reopened = await get(`/api/library`);
    expect(reopened.status).toBe(200);
    expect((await reopened.json() as LibrarySnapshot).seasons).toEqual({ [series.id]: { 2: 2.5 } });
  });

  it('validates season coordinates, fields, ratings, and series identity without changing saved data', async () => {
    const store = create_store(directory);
    const { series } = series_titles();
    store.title_put([{ title: series, genres: [] }]);
    store.close();
    const path = `/api/library/${series.id}/seasons/1`;
    const valid = await patch(path, { rating: 3.5 });
    expect(valid.status).toBe(200);
    const invalid_paths = [
      `/api/library/${series.id}/seasons/-1`, `/api/library/${series.id}/seasons/1.5`,
      `/api/library/${series.id}/seasons/01`, `/api/library/${series.id}/seasons/1%0A`,
      `/api/library/${series.id}/seasons/100000`, `/api/library/${series.id}/seasons/%ZZ`,
      `/api/library/tt0903747:1:2/seasons/1`, `/api/library/tt9999999/seasons/1`, `/api/library/tt0133093/seasons/1`,
    ];
    for (const invalid_path of invalid_paths) {
      const response = await patch(invalid_path, { rating: 3 });
      expect(response.status).toBe(invalid_path.includes('tt0903747:') || invalid_path.includes('tt9999999') || invalid_path.includes('tt0133093') ? invalid_path.includes(':') ? 400 : 404 : 400);
      await response.json();
    }
    for (const body of [{}, { rating: 4.25 }, { rating: '4' }, { rating: 4, extra: true }, { value: 4 }]) {
      const response = await patch(path, body);
      expect(response.status).toBe(400);
      await response.json();
    }
    const unchanged = await (await get(`/api/library`)).json() as LibrarySnapshot;
    expect(unchanged.seasons).toEqual({ [series.id]: { 1: 3.5 } });
  });

  it('saves valid cache settings and rejects invalid values without changing them', async () => {
    const updated = await patch('/api/cache', { metadata_hours: 12, max_stale_days: 0 });
    expect(updated.status).toBe(200);
    expect((await updated.json() as CacheStatus).settings).toMatchObject({ metadata_hours: 12, max_stale_days: 0 });
    const invalid = await patch('/api/cache', { metadata_hours: 0 });
    expect(invalid.status).toBe(400);
    await invalid.json();
    const status = await get(`/api/cache`);
    expect((await status.json() as CacheStatus).settings.metadata_hours).toBe(12);
  });

  it('reuses fresh versioned images for the configured freshness window', async () => {
    const now = 1_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const fetched_at = now - 1000;
    const key = await seed_image(fetched_at, 1);
    const url = `${origin}/api/images/${key}?v=${fetched_at}`;
    const cache_control = `private, max-age=${Math.floor((image_ttl(key, 1) - 1000) / 1000)}, immutable`;

    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(cache_control);
    expect(response.headers.get('ETag')).toBe(`"${key}:${fetched_at}:${IMAGE_BYTES.length}"`);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');

    const not_modified = await fetch(url, { headers: { 'If-None-Match': `"${key}:${fetched_at}:${IMAGE_BYTES.length}"` } });
    expect(not_modified.status).toBe(304);
    expect(not_modified.headers.get('Cache-Control')).toBe(cache_control);

    const mismatched = await get(`/api/images/${key}?v=${fetched_at - 1}`);
    expect(mismatched.headers.get('Cache-Control')).toBe('private, no-cache');
  });

  it('does not cache stale fallback images', async () => {
    const now = 1_000_000;
    const images_days = 0.25;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const fetched_at = now - images_days * DAY;
    const key = await seed_image(fetched_at, images_days);
    const original_fetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, options) => {
      const url = input instanceof Request ? input.url : String(input);
      if (new URL(url).origin === origin) return original_fetch(input, options);
      return Promise.reject(new Error('Origin is unavailable'));
    });

    const response = await get(`/api/images/${key}?v=${fetched_at}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-cache');
    expect(response.headers.get('X-Watchit-Stale')).toBe('true');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(IMAGE_BYTES);
  });

  it('serves catalog and title routes without an upstream request', async () => {
    const original_fetch = globalThis.fetch;
    const upstream = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, options) => {
      const url = input instanceof Request ? input.url : String(input);
      if (new URL(url).origin === origin) return original_fetch(input, options);
      upstream(url);
      return Promise.reject(new Error('Upstream is unavailable'));
    });
    const response = await get(`/api/catalog?kind=movie`);
    expect(response.status).toBe(200);
    const page = await response.json() as import('../src/catalog/types.ts').CatalogPage;
    expect(page.items.map(item => item.id)).toEqual(['tt0133093']);
    const detail = await get(`/api/titles/tt0133093`);
    expect(detail.status).toBe(200);
    expect((await detail.json() as import('../src/catalog/types.ts').TitleResult).title.id).toBe('tt0133093');
    expect(upstream).not.toHaveBeenCalled();
  });

  it('serves encoded episode IDs and keeps episode library state independent', async () => {
    const store = create_store(directory);
    const { series, episode } = series_titles();
    store.title_put([series, episode].map(title => ({ title, genres: [{ id: 'drama', label: 'Drama' }] })));
    store.close();
    const response = await get(`/api/titles/${encodeURIComponent(episode.id)}`);
    expect(response.status).toBe(200);
    expect((await response.json()).title).toMatchObject({ id: episode.id, season: 1, episode: 2 });
    const saved = await patch(`/api/library/${encodeURIComponent(episode.id)}`, { rating: 4.5, saved: true });
    expect(saved.status).toBe(200);
    const library = await saved.json() as LibrarySnapshot;
    expect(library.entries[episode.id]).toMatchObject({ rating: 4.5, status: null, favorite: false, saved: true });
    expect(library.entries[series.id]).toBeUndefined();
    const episodes = await get(`/api/titles/${series.id}/episodes`);
    expect((await episodes.json()).items.map((item: { id: string }) => item.id)).toEqual([episode.id]);
    const navigation = await get(`/api/titles/${encodeURIComponent(episode.id)}/navigation`);
    expect(navigation.status).toBe(200);
    expect(await navigation.json()).toMatchObject({ season: 1, seasons: [1], items: [{ id: episode.id }], previous: null, next: null,
      imports: { enabled: false }, artwork_status: { pending: false } });
    for (const query of ['season=-1', 'season=1.5', 'season=1%0A', 'season=01', 'page=1%0A', 'page=100001']) {
      const invalid = await get(`/api/titles/${encodeURIComponent(episode.id)}/navigation?${query}`);
      expect(invalid.status).toBe(400);
      await invalid.json();
    }
    const filtered = await get(`/api/catalog?kind=series&genre=drama`);
    expect((await filtered.json()).items.map((item: { id: string }) => item.id)).toEqual([series.id]);
  });

  it('serves trending, my shows, continue watching and rankings, and remembers playback sources', async () => {
    const store = create_store(directory);
    const { series, episode } = series_titles();
    store.title_put([series, episode].map(title => ({ title, genres: [] })));
    store.trending_put('movie', [movie.id]);
    store.close();
    await patch(`/api/library/${series.id}`, { status: 'watching', rating: 4 });
    await patch(`/api/library/${movie.id}`, { status: 'watched', rating: 4 });
    await patch(`/api/library/${encodeURIComponent(episode.id)}`, { opened: true });

    const trending = await (await get(`/api/trending?kind=movie`)).json();
    expect(trending).toMatchObject({ items: [{ id: movie.id, rank: 1, imdb_rating: null }], has_next: false, imports: { pending: false } });
    expect((await (await get(`/api/trending?hide=watched`)).json()).items).toEqual([]);
    expect((await (await get(`/api/catalog?sort=trending&hide=watched,dropped`)).json()).items.map((item: { id: string }) => item.id)).toEqual([series.id]);
    const shows = await (await get(`/api/library/titles?status=recent&kind=series`)).json();
    expect(shows).toMatchObject({ total: 1, counts: { watching: 1, watched: 0, recent: 1 }, items: [{ title: { id: series.id }, progress: { last: { id: episode.id } } }] });
    expect((await (await get(`/api/library/continue`)).json()).items.map((item: { title: { id: string } }) => item.title.id)).toEqual([series.id]);
    const rankings = await (await get(`/api/rankings`)).json();
    expect(rankings.tiers).toMatchObject([{ rating: 4, items: [{ title: { id: series.id } }, { title: { id: movie.id } }] }]);
    const moved = await (await patch(`/api/rankings/${movie.id}?kind=movie`, { before: null })).json();
    expect(moved).toMatchObject({ kind: 'movie', tiers: [{ rating: 4, items: [{ title: { id: movie.id }, rank: 1 }] }] });
    expect((await patch(`/api/rankings/${movie.id}`, { before: 'tt0000000' })).status).toBe(400);

    const chosen = await patch(`/api/library/${encodeURIComponent(episode.id)}/playback`, { source: 'vidsrc' });
    expect(await chosen.json()).toEqual({ id: series.id, source: 'vidsrc' });
    const watch = await (await get(`/api/titles/${encodeURIComponent(episode.id)}`)).json();
    expect(watch).toMatchObject({ playback_source: 'vidsrc', progress: { last: { id: episode.id }, next: null } });
    for (const [path, body] of [[`/api/library/${movie.id}/playback`, { source: 'Not valid' }], [`/api/library/${movie.id}/playback`, { source: 1 }],
      [`/api/library/${movie.id}/playback`, {}], [`/api/rankings/${movie.id}`, { before: 5 }]] as const) {
      const response = await patch(path, body);
      expect(response.status).toBe(400);
      await response.json();
    }
    for (const path of ['/api/library/titles?status=queued', '/api/library/titles?sort=imdb', '/api/catalog?sort=popular', '/api/catalog?hide=seen', '/api/trending?kind=episode', '/api/rankings?kind=tv']) {
      const response = await get(`${path}`);
      expect(response.status).toBe(400);
      await response.json();
    }
  });

  it('rejects invalid queries, bodies, methods, and unknown routes locally', async () => {
    for (const path of ['/api/catalog?page=0', '/api/catalog?kind=invalid', '/api/catalog?genre=not/an/id', '/api/titles/tt0133093%0A', '/api/titles/tt123', '/api/titles/%ZZ', '/api/titles/tt0133093/navigation']) {
      const response = await get(`${path}`);
      expect(response.status).toBe(400);
      await response.json();
    }
    for (const path of ['/api/titles/tt9999999:1:1/navigation', '/api/titles/tt0133093/navigation?season=100000', '/api/titles/tt0133093/navigation?page=0']) {
      const response = await get(`${path}`);
      expect(response.status).toBe(path.includes('tt9999999') ? 404 : 400);
      await response.json();
    }
    const body = await patch('/api/library/tt0133093', { watched: 'yes' });
    expect(body.status).toBe(400);
    await body.json();
    for (const [source, status] of [[origin, 400], ['https://evil.example', 403], ['null', 403]] as const) {
      const response = await fetch(`${origin}/api/library/tt0133093`, {
        method: 'PATCH', headers: { Origin: source, 'Content-Type': 'application/json', [SESSION_HEADER]: token }, body: '{"watched":"yes"}',
      });
      expect(response.status).toBe(status);
      await response.json();
    }
    const method = await fetch(`${origin}/api/cache`, { method: 'OPTIONS' });
    expect(method.status).toBe(405);
    await method.json();
    const missing = await get(`/api/missing`);
    expect(missing.status).toBe(404);
    await missing.json();
  });
});

