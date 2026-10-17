import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogQuery, Title } from '../../src/catalog/types.ts';
import { create_store } from '../storage/index.ts';
import type { Store } from '../storage/types.ts';
import { create_catalog } from './index.ts';

const query: CatalogQuery = { kind: 'all', page: 1, query: '', genre: '', sort: 'title' };
const movie: Title = {
  id: 'tt1234567', title: 'A film', kind: 'movie', anime: false, year: 2001, artwork: '', genres: ['Adventure'],
  backdrop: '', minutes: 120, synopsis: 'A film description', director: '', cast: '', imdb_id: 'tt1234567', tmdb_id: 456,
  season: null, episode: null, series: null, related: [], images: [], source_url: 'https://v3-cinemeta.strem.io/meta/movie/tt1234567.json',
};
let directory: string;
let store: Store;
let profile: number;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'streamit-local-catalog-'));
  store = create_store(directory);
  profile = store.profile_create('test').id;
  store.title_put([{ title: movie, genres: [{ id: 'adventure', label: 'Adventure' }] }]);
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new Error('Offline')));
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  store.close();
  await rm(directory, { recursive: true, force: true });
});

describe('local catalog reads', () => {
  it('serves browsing, filters, search and playback identifiers with no network', () => {
    const catalog = create_catalog(store);
    expect(catalog.catalog(query).items.map(item => item.id)).toEqual(['tt1234567']);
    expect(catalog.catalog({ ...query, genre: 'adventure', query: 'film' }).items).toHaveLength(1);
    expect(catalog.title(profile, 'tt1234567').title).toMatchObject({ imdb_id: 'tt1234567', tmdb_id: 456, synopsis: 'A film description' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps old imported data browsable, marks it stale, and preserves personal records', () => {
    store.personal_update(profile, 'tt1234567', { rating: 4.5, status: 'watched' });
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 400 * 86400000);
    const catalog = create_catalog(store);
    expect(catalog.catalog(query)).toMatchObject({ items: [{ id: 'tt1234567' }], freshness: { stale: true } });
    expect(catalog.title(profile, 'tt1234567')).toMatchObject({ title: { id: 'tt1234567' }, freshness: { stale: true } });
    expect(store.library_get(profile).entries.tt1234567).toMatchObject({ status: 'watched', rating: 4.5 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reads imported episodes locally with their recorded episode numbers', () => {
    store.title_put([
      { title: { ...movie, id: 'tt7654321', kind: 'series', title: 'A series' }, genres: [] },
      { title: { ...movie, id: 'tt7654321:1:1', kind: 'episode', title: 'An episode', season: 1, episode: 1, series: { id: 'tt7654321', title: 'A series', imdb_id: 'tt7654321', tmdb_id: 123 } }, genres: [] },
    ]);
    const page = create_catalog(store).episodes('tt7654321', 1);
    expect(page.items).toMatchObject([{ id: 'tt7654321:1:1', season: 1, episode: 1 }]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('validates episode navigation at the catalog boundary', () => {
    const series: Title = { ...movie, id: 'tt7654321', kind: 'series', title: 'A series', imdb_id: 'tt7654321' };
    const episode: Title = { ...movie, id: 'tt7654321:0:3', kind: 'episode', title: 'An episode', season: 0, episode: 3,
      series: { id: series.id, title: series.title, imdb_id: series.imdb_id, tmdb_id: series.tmdb_id } };
    store.title_put([{ title: series, genres: [] }, { title: episode, genres: [] }]);
    const catalog = create_catalog(store);
    expect(catalog.episode_navigation(episode.id)).toMatchObject({ season: 0, seasons: [0], page: 1,
      items: [{ id: episode.id }], previous: null, next: null });
    expect(() => catalog.episode_navigation(series.id)).toThrow('only available for an episode');
    expect(() => catalog.episode_navigation('tt9999999:0:1')).toThrow('not been imported');
    expect(() => catalog.episode_navigation(episode.id, -1)).toThrow('season');
    expect(() => catalog.episode_navigation(episode.id, 0, 0)).toThrow('page');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('validates input and reports missing local titles without a remote fallback', () => {
    const catalog = create_catalog(store);
    expect(() => catalog.title(profile, 'tt123')).toThrow('valid title');
    expect(() => catalog.title(profile, 'tt9999999')).toThrow('not been imported');
    expect(() => catalog.catalog({ ...query, page: 0 })).toThrow('page');
    expect(() => catalog.episodes('tt1234567', 1)).toThrow('only available for a series');
    expect(catalog.catalog({ ...query, page: 418 }).items).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
