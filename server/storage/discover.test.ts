import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogQuery, Title } from '../../src/catalog/types.ts';
import { create_catalog } from '../catalog/index.ts';
import { imported, title } from './fixtures.ts';
import { create_store } from './index.ts';
import type { Store } from './types.ts';

const query: CatalogQuery = { page: 1, query: '', kind: 'all', genre: '', sort: 'newest' };
let directory: string;
let store: Store;
let profile: number;

function put(...titles: Title[]) {
  store.title_put(titles.map(imported));
}
function ids(input: Partial<CatalogQuery>) {
  return store.catalog_query({ ...query, ...input }).items.map(item => item.id);
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'streamit-discover-'));
  store = create_store(directory);
  profile = store.profile_create('test').id;
});
afterEach(() => {
  vi.restoreAllMocks();
  store.close();
  rmSync(directory, { recursive: true, force: true });
});

describe('discover', () => {
  it('sorts by the latest trending snapshot per list, then everything else by newest', () => {
    put(title('tt0000001', { year: 2020 }), title('tt0000002', { year: 2021 }), title('tt0000003', { kind: 'series', year: 2022 }),
      title('tt0000004', { kind: 'series', anime: true, year: 2023 }), title('tt0000005', { year: 2026 }));
    store.trending_put('movie', ['tt0000001', 'tt0000002']);
    store.trending_put('series', ['tt0000004', 'tt0000003']);
    store.trending_put('anime', ['tt0000004']);
    expect(ids({ sort: 'trending', kind: 'movie' })).toEqual(['tt0000001', 'tt0000002', 'tt0000005']);
    expect(ids({ sort: 'trending' })).toEqual(['tt0000004', 'tt0000001', 'tt0000003', 'tt0000002', 'tt0000005']);
    expect(ids({ sort: 'trending', kind: 'anime' })).toEqual(['tt0000004']);
    store.trending_put('movie', ['tt0000002']);
    expect(ids({ sort: 'trending', kind: 'movie' })).toEqual(['tt0000002', 'tt0000005', 'tt0000001']);
  });

  it('pages trending lists, interleaves movies and series for all, and keeps 30 days of history', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 0, 1));
    const movies = Array.from({ length: 30 }, (_, index) => title(`tt${String(index + 1).padStart(7, '0')}`));
    put(...movies, title('tt0000099', { kind: 'series' }));
    store.trending_put('movie', movies.map(movie => movie.id));
    store.trending_put('series', ['tt0000099']);
    const first = store.trending_query({ kind: 'all', page: 1 });
    expect(first.items.slice(0, 3).map(item => [item.id, item.rank])).toEqual([['tt0000099', 1], ['tt0000001', 1], ['tt0000002', 2]]);
    expect(first).toMatchObject({ day: '2026-01-01', has_next: true });
    expect(store.trending_query({ kind: 'movie', page: 2 })).toMatchObject({ has_next: false, items: { length: 6 } });
    clock.mockReturnValue(Date.UTC(2026, 1, 15));
    store.trending_put('movie', ['tt0000003']);
    expect(store.trending_query({ kind: 'movie', page: 1 })).toMatchObject({ day: '2026-02-15', items: [{ id: 'tt0000003', rank: 1 }] });
    expect(store.trending_query({ kind: 'anime', page: 1 })).toEqual({ items: [], page: 1, has_next: false, day: null });
  });

  it('sorts top rated with popular titles first, then the rest, unrated last', () => {
    put(title('tt0000001', { imdb_rating: 9.6, popularity: 0.01 }), title('tt0000002', { imdb_rating: 8.1, popularity: 3 }),
      title('tt0000003', { imdb_rating: 8.8, popularity: 0.5 }), title('tt0000004', { popularity: 9 }), title('tt0000005', { imdb_rating: 7 }));
    expect(ids({ sort: 'top_rated' })).toEqual(['tt0000003', 'tt0000002', 'tt0000001', 'tt0000005', 'tt0000004']);
    expect(store.catalog_query(query).items.find(item => item.id === 'tt0000003')?.imdb_rating).toBe(8.8);
  });

  it('hides titles by their own eye status', () => {
    put(title('tt0000001'), title('tt0000002'), title('tt0000003'), title('tt0000004'));
    store.personal_update(profile, 'tt0000001', { status: 'watched' });
    store.personal_update(profile, 'tt0000002', { status: 'dropped' });
    store.personal_update(profile, 'tt0000003', { status: 'watching' });
    store.personal_update(profile, 'tt0000004', { status: 'dropped' });
    store.personal_update(profile, 'tt0000004', { status: null });
    store.trending_put('movie', ['tt0000001', 'tt0000002', 'tt0000003', 'tt0000004']);
    const hide = { profile, statuses: ['watched', 'dropped'] as const };
    expect(store.catalog_query(query, hide).items.map(item => item.id).sort()).toEqual(['tt0000003', 'tt0000004']);
    expect(store.trending_query({ kind: 'movie', page: 1 }, hide).items.map(item => [item.id, item.rank]))
      .toEqual([['tt0000003', 3], ['tt0000004', 4]]);
  });

  it('serves normalised genres on cards, title details, the facet and the filter', () => {
    put(title('tt0000001', { genres: ['Sci-Fi', 'Adult'] }), title('tt0000002', { genres: ['Science Fiction', 'Drama'] }),
      title('tt0000003', { genres: ['Action & Adventure'] }), title('tt0000004', { genres: ['News'] }));
    const page = store.catalog_query(query);
    expect(page.genres).toEqual([
      { id: 'action', label: 'Action', minor: false }, { id: 'adventure', label: 'Adventure', minor: false },
      { id: 'drama', label: 'Drama', minor: false }, { id: 'news', label: 'News', minor: true },
      { id: 'science-fiction', label: 'Science Fiction', minor: false },
    ]);
    expect(page.items.find(item => item.id === 'tt0000001')?.genres).toEqual(['Science Fiction']);
    expect(ids({ genre: 'science-fiction' }).sort()).toEqual(['tt0000001', 'tt0000002']);
    expect(ids({ genre: 'adventure' })).toEqual(['tt0000003']);
    expect(create_catalog(store).title(profile, 'tt0000003').title.genres).toEqual(['Action', 'Adventure']);
  });

  it('reads titles stored before IMDb ratings existed as unrated', () => {
    put(title('tt0000001'));
    expect(store.catalog_query(query).items[0]?.imdb_rating).toBeNull();
    expect(create_catalog(store).title(profile, 'tt0000001')).toMatchObject({ title: { imdb_rating: null }, playback_source: null, progress: null });
  });
});
