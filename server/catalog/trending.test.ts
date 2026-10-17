import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Title } from '../../src/catalog/types.ts';
import type { Images } from '../media/types.ts';
import { create_store } from '../storage/index.ts';
import type { ImportedTitle, Store } from '../storage/types.ts';
import { Source, type CatalogData } from './source.ts';
import { create_sync } from './sync.ts';
import { trending_ids } from './trending.ts';

function imported(id: string, patch: Partial<Title> = {}): ImportedTitle & { present: (keyof Title)[] } {
  return { genres: [], present: ['id', 'title', 'kind'], title: {
    id, title: id, year: 2024, artwork: '', genres: [], kind: 'movie', anime: false, backdrop: '', minutes: null, synopsis: '',
    director: '', cast: '', imdb_id: null, tmdb_id: null, season: null, episode: null, series: null, related: [], images: [],
    source_url: '', ...patch,
  } };
}
const images: Images = { register: () => '', get: async () => { throw new Error('No image downloads in this test'); } };
let directory: string;
let store: Store;
let sync: ReturnType<typeof create_sync> | undefined;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 0, 1, 12));
  directory = await mkdtemp(join(tmpdir(), 'streamit-trending-'));
  store = create_store(directory);
});
afterEach(async () => {
  await sync?.stop();
  sync = undefined;
  store.close();
  vi.restoreAllMocks();
  vi.useRealTimers();
  await rm(directory, { recursive: true, force: true });
});

describe('trending order', () => {
  it('interleaves series and movie positions and keeps only anime for the anime list', () => {
    const items = [imported('tt0000001'), imported('tt0000002', { anime: true }), imported('tt0000003', { kind: 'series', anime: true }),
      imported('tt0000004', { kind: 'series' })];
    expect(trending_ids(items, 'movie')).toEqual(['tt0000003', 'tt0000001', 'tt0000004', 'tt0000002']);
    expect(trending_ids(items, 'anime')).toEqual(['tt0000003', 'tt0000002']);
  });

  it('records each kind at most once a day from Cinemeta top pages', async () => {
    const page = (ids: string[], has_next: boolean): CatalogData => {
      const titles = ids.map(id => imported(id));
      return { titles, items: titles.map(item => item.title), has_next, genres: [], images: [] };
    };
    const upstream = vi.spyOn(Source.prototype, 'catalog').mockImplementation(async query => {
      if (query.sort !== 'trending' || query.kind !== 'movie') return page([], false);
      return query.page === 1 ? page(['tt0000002', 'tt0000001'], true) : page(['tt0000001', 'tt0000003'], false);
    });
    const trending_calls = () => upstream.mock.calls.filter(([query]) => query.sort === 'trending').length;
    sync = create_sync(store, images, { batch_interval_ms: 1 });
    expect(sync.trending('movie').pending).toBe(false);
    sync.start();
    expect(sync.trending('movie').pending).toBe(true);
    await vi.advanceTimersByTimeAsync(20);
    expect(store.trending_query({ kind: 'movie', page: 1 })).toMatchObject({
      day: '2026-01-01', items: [{ id: 'tt0000002', rank: 1 }, { id: 'tt0000001', rank: 2 }, { id: 'tt0000003', rank: 3 }],
    });
    const calls = trending_calls();
    vi.setSystemTime(Date.now() + 20 * 3600000);
    await vi.advanceTimersByTimeAsync(120000);
    expect(trending_calls()).toBe(calls);
    vi.setSystemTime(Date.now() + 5 * 3600000);
    await vi.advanceTimersByTimeAsync(120000);
    expect(trending_calls()).toBeGreaterThan(calls);
    expect(store.trending_query({ kind: 'movie', page: 1 }).day).toBe('2026-01-02');
  });
});
