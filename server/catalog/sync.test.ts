import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Title } from '../../src/catalog/types.ts';
import type { Images } from '../media/types.ts';
import type { Store } from '../storage/types.ts';
import { create_store } from '../storage/index.ts';
import { create_catalog } from './index.ts';
import { CatalogError } from './http.ts';
import { Source, type CatalogData } from './source.ts';
import { create_sync } from './sync.ts';

const title: Title = {
  id: 'tt1234567', title: 'Imported film', year: 2024, artwork: '', genres: [], kind: 'movie', anime: false,
  backdrop: '', minutes: null, synopsis: 'Imported description', director: '', cast: '', imdb_id: 'tt1234567', tmdb_id: null,
  season: null, episode: null, series: null, related: [], images: [], trailers: [], source_url: 'https://v3-cinemeta.strem.io/meta/movie/tt1234567.json',
};
const series_title: Title = { ...title, id: 'tt7654321', title: 'Imported series', kind: 'series',
  source_url: 'https://v3-cinemeta.strem.io/meta/series/tt7654321.json' };
const series_meta = { id: series_title.id, type: 'series' as const, name: series_title.title, releaseInfo: '2024', videos: [] };
const batch: CatalogData = { items: [title], titles: [{ title, genres: [], present: ['id', 'title', 'kind', 'imdb_id', 'source_url'] }], has_next: true, genres: [], images: [] };
const images: Images = { register: () => '', get: async () => { throw new Error('No image downloads in this test'); } };
let directory: string;
let store: Store;
let profile: number;
let sync: ReturnType<typeof create_sync>;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 0, 1));
  directory = await mkdtemp(join(tmpdir(), 'streamit-imports-'));
  store = create_store(directory);
  profile = store.profile_create('test').id;
});
afterEach(async () => {
  await sync?.stop();
  store.close();
  vi.restoreAllMocks();
  vi.useRealTimers();
  await rm(directory, { recursive: true, force: true });
});

describe('background imports', () => {
  it('starts anime discovery on an unfiltered anime browse', async () => {
    const upstream = vi.spyOn(Source.prototype, 'catalog').mockResolvedValue({ ...batch, has_next: false });
    sync = create_sync(store, images, { batch_interval_ms: 1 });
    expect(sync.catalog({ kind: 'anime', page: 1, genre: '', query: '', sort: 'newest' }, true).pending).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(upstream.mock.calls[0]?.[0].kind).toBe('anime');
    expect(sync.catalog({ kind: 'anime', page: 1, genre: '', query: '', sort: 'newest' }, true).pending).toBe(false);
  });

  it('reports browse imports as pending only while the requested page is empty', async () => {
    let finish!: (data: CatalogData) => void;
    vi.spyOn(Source.prototype, 'catalog').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    sync = create_sync(store, images);
    sync.start();
    await vi.advanceTimersByTimeAsync(0);
    const query = { kind: 'movie' as const, page: 1, query: '', genre: '', sort: 'newest' as const };
    expect(sync.catalog(query, true).pending).toBe(true);
    expect(sync.catalog(query, false).pending).toBe(false);
    expect(sync.catalog({ ...query, kind: 'anime' }, false).pending).toBe(false);
    finish(batch);
  });

  it('returns promoted anime discovery to background rotation after one batch', async () => {
    const calls: string[] = [];
    vi.spyOn(Source.prototype, 'catalog').mockImplementation(async query => {
      if (query.sort !== 'trending') calls.push(query.kind);
      return batch;
    });
    sync = create_sync(store, images, { batch_interval_ms: 1 });
    sync.start();
    sync.catalog({ kind: 'anime', page: 1, query: '', genre: '', sort: 'newest' }, true);
    await vi.advanceTimersByTimeAsync(6);
    expect(calls).toEqual(['anime', 'movie', 'series', 'anime']);
  });

  it('refreshes finished discovery weekly instead of every metadata interval', async () => {
    const upstream = vi.spyOn(Source.prototype, 'catalog').mockResolvedValue({ ...batch, has_next: false });
    const discovery = () => upstream.mock.calls.filter(([query]) => query.sort !== 'trending').length;
    sync = create_sync(store, images, { batch_interval_ms: 1 });
    sync.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(discovery()).toBe(3);
    vi.setSystemTime(Date.now() + 2 * 24 * 3600000);
    await vi.advanceTimersByTimeAsync(120000);
    expect(discovery()).toBe(3);
    vi.setSystemTime(Date.now() + 7 * 24 * 3600000);
    await vi.advanceTimersByTimeAsync(120000);
    expect(discovery()).toBe(6);
  });

  it('drops finished detail jobs from the persisted queue', async () => {
    vi.spyOn(Source.prototype, 'title').mockResolvedValue({ title, verified_at: Date.now(), parents: [], titles: batch.titles });
    sync = create_sync(store, images, { batch_interval_ms: 1 });
    sync.title(title.id);
    await vi.advanceTimersByTimeAsync(1);
    expect(sync.title(title.id).pending).toBe(false);
    expect(store.cache_get<{ jobs: unknown[] }>('cinemeta:imports:v2')?.value.jobs).toEqual([]);
  });

  it('skips publication callbacks when refreshed detail is unchanged', async () => {
    const on_titles = vi.fn();
    const upstream = vi.spyOn(Source.prototype, 'title').mockImplementation(async () => ({ title, verified_at: Date.now(), parents: [], titles: batch.titles }));
    sync = create_sync(store, images, { batch_interval_ms: 1, on_titles });
    sync.title(title.id);
    await vi.advanceTimersByTimeAsync(1);
    vi.setSystemTime(Date.now() + store.settings_get().metadata_hours * 3600000);
    sync.title(title.id);
    await vi.advanceTimersByTimeAsync(1);
    expect(upstream).toHaveBeenCalledTimes(2);
    expect(on_titles).toHaveBeenCalledOnce();
  });

  it('refreshes fresh detail once when the stored snapshot predates trailers', async () => {
    const { trailers: _, ...without_trailers } = title;
    const upstream = vi.spyOn(Source.prototype, 'title').mockResolvedValue({ title, verified_at: Date.now(), parents: [], titles: batch.titles });
    sync = create_sync(store, images, { batch_interval_ms: 1 });
    store.title_put([{ title: without_trailers, genres: [] }]);
    store.cache_set(`cinemeta:detail:v1:${title.id}`, { kind: 'movie', verified_at: Date.now() });
    expect(create_catalog(store).title(profile, title.id)).toMatchObject({ title: { trailers: [] }, freshness: { stale: true } });
    sync.title(title.id);
    await vi.advanceTimersByTimeAsync(1);
    sync.title(title.id);
    await vi.advanceTimersByTimeAsync(1);
    expect(upstream).toHaveBeenCalledOnce();
    expect(create_catalog(store).title(profile, title.id).freshness.stale).toBe(false);
  });

  it('keeps interactive requests moving while an origin failure pauses discovery', async () => {
    vi.spyOn(Source.prototype, 'catalog').mockRejectedValue(new CatalogError('Cinemeta request failed (HTTP 503).', 503));
    const upstream = vi.spyOn(Source.prototype, 'title').mockResolvedValue({ title, verified_at: Date.now(), parents: [], titles: batch.titles });
    sync = create_sync(store, images, { batch_interval_ms: 1 });
    sync.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(sync.status().next_retry_at).not.toBeNull();
    sync.title(title.id);
    await vi.advanceTimersByTimeAsync(0);
    expect(upstream).toHaveBeenCalledOnce();
    expect(sync.title(title.id)).toMatchObject({ pending: false, error: null, next_retry_at: null });
  });

  it('wakes an episode request instead of waiting for the idle discovery timer', async () => {
    const catalog_upstream = vi.spyOn(Source.prototype, 'catalog').mockResolvedValue({ ...batch, has_next: false });
    const detail_upstream = vi.spyOn(Source.prototype, 'title').mockResolvedValue({ title: series_title, verified_at: Date.now(), parents: [],
      titles: [{ title: series_title, genres: [] }] });
    sync = create_sync(store, images, { batch_interval_ms: 30000 });
    sync.catalog({ kind: 'anime', page: 1, query: '', genre: '', sort: 'newest' }, true);
    await vi.advanceTimersByTimeAsync(0);
    expect(catalog_upstream).toHaveBeenCalledOnce();
    expect(sync.status().pending).toBe(false);
    sync.episodes(series_title.id);
    await vi.advanceTimersByTimeAsync(0);
    expect(detail_upstream).toHaveBeenCalledOnce();
    expect(sync.episodes(series_title.id).pending).toBe(false);
  });

  it('promotes an already queued discovery for the first interactive request', async () => {
    const calls: string[] = [];
    vi.spyOn(Source.prototype, 'catalog').mockImplementation(async query => {
      calls.push(query.kind);
      return { ...batch, has_next: false };
    });
    sync = create_sync(store, images, { batch_interval_ms: 30000 });
    sync.start();
    const query = { kind: 'anime' as const, page: 1, query: '', genre: '', sort: 'newest' as const };
    sync.catalog(query, true);
    sync.catalog(query, true);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls[0]).toBe('anime');
  });

  it('runs a requested episode between catalog and enrichment requests', async () => {
    const calls: string[] = [];
    let schedule_episode!: () => void;
    const fetcher = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      calls.push(url.pathname);
      if (url.pathname === '/manifest.json') {
        schedule_episode();
        return Response.json({ catalogs: [{ type: 'movie', id: 'top', genres: ['Drama'] }, { type: 'series', id: 'top', genres: ['Drama'] }] });
      }
      if (url.pathname === `/meta/series/${series_title.id}.json`) return Response.json({ meta: series_meta });
      return Response.json({ metas: [] });
    });
    sync = create_sync(store, images, { fetch: fetcher, request_interval_ms: 0, batch_interval_ms: 30000 });
    schedule_episode = () => { sync.episodes(series_title.id); };
    sync.catalog({ kind: 'all', page: 1, query: '', genre: 'drama', sort: 'title' }, true);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual(['/manifest.json', `/meta/series/${series_title.id}.json`, '/catalog/movie/top/genre=Drama&skip=0.json', '/catalog/series/top/genre=Drama&skip=0.json']);
  });

  it('keeps queued user requests FIFO when repeated polling promotes existing work', async () => {
    const calls: string[] = [];
    const upstream = vi.spyOn(Source.prototype, 'title').mockImplementation(async id => {
      calls.push(id);
      const item = { ...title, id };
      return { title: item, verified_at: Date.now(), parents: [], titles: [{ title: item, genres: [] }] };
    });
    sync = create_sync(store, images, { batch_interval_ms: 30000 });
    sync.title('tt0000001');
    sync.title('tt0000002');
    sync.title('tt0000001');
    sync.title('tt0000003');
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual(['tt0000001', 'tt0000002', 'tt0000003']);
    expect(upstream).toHaveBeenCalledTimes(3);
  });

  it.each(['anime', 'genre'] as const)('enriches partial search results before settling a %s filter', async filter => {
    const query = { kind: filter === 'anime' ? 'anime' as const : 'movie' as const,
      page: 1, genre: filter === 'genre' ? 'drama' : '', query: 'Imported', sort: 'title' as const };
    const complete = { ...title, anime: true, genres: ['Animation', 'Drama'] };
    vi.spyOn(Source.prototype, 'catalog').mockResolvedValue({ ...batch, has_next: false });
    let finish!: () => void;
    const gate = new Promise<void>(resolve => { finish = resolve; });
    vi.spyOn(Source.prototype, 'title').mockImplementation(async () => {
      await gate;
      return { title: complete, verified_at: Date.now(), parents: [],
        titles: [{ title: complete, genres: [{ id: 'animation', label: 'Animation' }, { id: 'drama', label: 'Drama' }] }] };
    });
    sync = create_sync(store, images, { batch_interval_ms: 1 });
    sync.catalog(query, true);
    await vi.advanceTimersByTimeAsync(1);
    try {
      expect(sync.catalog(query, true).pending).toBe(true);
      expect(store.catalog_query(query).items).toEqual([]);
    } finally { finish(); }
    await vi.advanceTimersByTimeAsync(0);
    expect(sync.catalog(query, true).pending).toBe(false);
    expect(store.catalog_query(query).items.map(item => item.id)).toEqual([title.id]);
  });

  it('deduplicates series detail and episode work across requests and restarts', async () => {
    const series = { ...title, kind: 'series' as const };
    const episode = { ...title, id: `${title.id}:1:1`, kind: 'episode' as const, season: 1, episode: 1,
      series: { id: title.id, title: title.title, imdb_id: title.imdb_id, tmdb_id: null } };
    store.title_put([{ title: series, genres: [] }]);
    const upstream = vi.spyOn(Source.prototype, 'title').mockResolvedValue({ title: series, verified_at: Date.now(), parents: [], titles: [{ title: series, genres: [] }, { title: episode, genres: [] }] });
    sync = create_sync(store, images, { batch_interval_ms: 1 });
    sync.title(title.id);
    sync.episodes(title.id);
    await vi.advanceTimersByTimeAsync(3);
    expect(upstream).toHaveBeenCalledExactlyOnceWith(title.id, 'series');
    expect(sync.title(episode.id).pending).toBe(false);
    expect(sync.episodes(episode.id).pending).toBe(false);
    await sync.stop();
    sync = create_sync(store, images, { batch_interval_ms: 1 });
    expect(sync.title(title.id).pending).toBe(false);
    expect(sync.episodes(title.id).pending).toBe(false);
    await vi.advanceTimersByTimeAsync(10);
    expect(upstream).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + store.settings_get().metadata_hours * 3600000);
    store.title_put([{ title: series, genres: [] }]);
    expect(create_catalog(store).title(profile, title.id).freshness.stale).toBe(true);
    expect(sync.episodes(title.id).pending).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it('awaits publication callbacks during shutdown even when titles have no artwork', async () => {
    let finish!: () => void;
    const on_titles = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    vi.spyOn(Source.prototype, 'catalog').mockResolvedValue({ ...batch, has_next: false });
    sync = create_sync(store, images, { on_titles });
    sync.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(on_titles).toHaveBeenCalledWith([title.id]);
    let drained = false;
    const stop = sync.stop().then(() => { drained = true; });
    await Promise.resolve();
    expect(drained).toBe(false);
    finish();
    await stop;
    expect(drained).toBe(true);
  });

  it('retries failed async publication before marking detail fresh', async () => {
    const on_titles = vi.fn().mockRejectedValueOnce(new Error('Attribution write failed')).mockResolvedValue(undefined);
    const upstream = vi.spyOn(Source.prototype, 'title').mockResolvedValue({ title, verified_at: Date.now(), parents: [], titles: batch.titles });
    sync = create_sync(store, images, { batch_interval_ms: 1, on_titles });
    sync.title(title.id);
    await vi.advanceTimersByTimeAsync(1);
    expect(sync.status().error).toBe('Attribution write failed');
    expect(create_catalog(store).title(profile, title.id).freshness.stale).toBe(true);
    await vi.advanceTimersByTimeAsync(60000);
    expect(upstream).toHaveBeenCalledTimes(2);
    expect(on_titles).toHaveBeenCalledTimes(2);
    expect(sync.status().error).toBeNull();
    expect(create_catalog(store).title(profile, title.id).freshness.stale).toBe(false);
  });

  it('keeps unrelated user work moving after a title-specific publication failure', async () => {
    const calls: string[] = [];
    const on_titles = vi.fn(async ids => {
      if (ids[0] === 'tt0000001' && on_titles.mock.calls.length === 1) throw new Error('Attribution write failed');
    });
    const upstream = vi.spyOn(Source.prototype, 'title').mockImplementation(async id => {
      calls.push(id);
      const item = { ...title, id };
      return { title: item, verified_at: Date.now(), parents: [], titles: [{ title: item, genres: [] }] };
    });
    sync = create_sync(store, images, { batch_interval_ms: 30000, on_titles });
    sync.title('tt0000001');
    sync.title('tt0000002');
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual(['tt0000001', 'tt0000002']);
    expect(sync.status('title:tt0000002').error).toBeNull();
    expect(sync.status().error).toBe('Attribution write failed');
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it('does not reopen exhausted catalogs until metadata refresh is due, including after restart', async () => {
    const upstream = vi.spyOn(Source.prototype, 'catalog').mockResolvedValue({ ...batch, has_next: false });
    sync = create_sync(store, images, { batch_interval_ms: 1 });
    sync.start();
    await vi.advanceTimersByTimeAsync(120000);
    expect(upstream).toHaveBeenCalledTimes(6);
    expect(sync.status().pending).toBe(false);
    await sync.stop();
    sync = create_sync(store, images, { batch_interval_ms: 1 });
    sync.start();
    await vi.advanceTimersByTimeAsync(120000);
    expect(upstream).toHaveBeenCalledTimes(6);
  });

  it('enriches partial catalog entries on click and does not downgrade detail during discovery', async () => {
    const on_titles = vi.fn();
    const complete = { ...title, synopsis: 'Full detail', director: 'A director' };
    const upstream = vi.spyOn(Source.prototype, 'title').mockResolvedValue({ title: complete, verified_at: Date.now(), parents: [], titles: [{ title: complete, genres: [] }] });
    vi.spyOn(Source.prototype, 'catalog').mockResolvedValue({ ...batch, has_next: false });
    store.title_put(batch.titles);
    sync = create_sync(store, images, { batch_interval_ms: 1, on_titles });
    sync.title(title.id);
    sync.start();
    await vi.advanceTimersByTimeAsync(3);
    expect(upstream).toHaveBeenCalledWith(title.id, 'movie');
    expect(create_catalog(store).title(profile, title.id)).toMatchObject({ title: { synopsis: 'Full detail', director: 'A director' }, freshness: { stale: false } });
    expect(on_titles).toHaveBeenCalledWith([title.id]);
    sync.title(title.id);
    await vi.advanceTimersByTimeAsync(2);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it('drains an aborted HTTP request before shutdown', async () => {
    let aborted = false;
    const fetcher = vi.fn<typeof fetch>((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => { aborted = true; reject(init.signal?.reason); }, { once: true });
    }));
    sync = create_sync(store, images, { fetch: fetcher });
    sync.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('/catalog/movie/top/skip=0.json');
    await sync.stop();
    expect(aborted).toBe(true);
    expect(sync.status().running).toBe(false);
    await vi.advanceTimersByTimeAsync(120000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(store.catalog_count()).toBe(0);
  });

  it('never blocks local reads while the source is pending, then publishes catalog metadata', async () => {
    let finish!: (data: CatalogData) => void;
    vi.spyOn(Source.prototype, 'catalog').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    sync = create_sync(store, images);
    sync.start();
    await vi.advanceTimersByTimeAsync(0);
    const local = create_catalog(store);
    expect(local.catalog({ kind: 'all', page: 1, query: '', genre: '', sort: 'title' }).items).toEqual([]);
    expect(sync.status()).toMatchObject({ pending: true, running: true, imported: 0 });
    finish(batch);
    await vi.advanceTimersByTimeAsync(0);
    expect(local.title(profile, 'tt1234567').title).toMatchObject({ imdb_id: 'tt1234567', synopsis: 'Imported description' });
    expect(sync.status().imported).toBe(1);
    expect(local.title(profile, 'tt1234567').freshness.stale).toBe(true);
  });

  it('retains local data and the failed cursor while respecting the source retry delay', async () => {
    store.title_put(batch.titles);
    store.personal_update(profile, 'tt1234567', { rating: 4.5, status: 'watched' });
    const upstream = vi.spyOn(Source.prototype, 'catalog')
      .mockRejectedValueOnce(new CatalogError('Cinemeta request failed (HTTP 429).', 429, { retry_after: 90 }))
      .mockResolvedValue(batch);
    sync = create_sync(store, images);
    sync.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(sync.status()).toMatchObject({ imported: 1, error: 'Cinemeta request failed (HTTP 429).' });
    expect(create_catalog(store).title(profile, 'tt1234567').title.imdb_id).toBe('tt1234567');
    await vi.advanceTimersByTimeAsync(89999);
    expect(upstream).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(upstream).toHaveBeenCalledTimes(2);
    expect(upstream.mock.calls.map(([query]) => query.page)).toEqual([1, 1]);
    expect(store.library_get(profile).entries.tt1234567).toMatchObject({ status: 'watched', rating: 4.5 });
    expect(sync.status().error).toBeNull();
  });

  it('resumes durable cursors and rotates discovery batches across catalog kinds', async () => {
    const upstream = vi.spyOn(Source.prototype, 'catalog').mockResolvedValue(batch);
    sync = create_sync(store, images, { batch_interval_ms: 1 });
    sync.start();
    await vi.advanceTimersByTimeAsync(0);
    await sync.stop();
    store.close();
    store = create_store(directory);
    sync = create_sync(store, images, { batch_interval_ms: 1 });
    sync.start();
    await vi.advanceTimersByTimeAsync(5);
    expect(upstream.mock.calls.filter(([query]) => query.sort !== 'trending').map(([query]) => [query.kind, query.page])).toEqual([
      ['movie', 1], ['series', 1], ['anime', 1], ['movie', 2],
    ]);
    expect(store.title_get('tt1234567')?.value.imdb_id).toBe('tt1234567');
  });
});
