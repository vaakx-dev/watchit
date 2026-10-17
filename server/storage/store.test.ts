import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CacheSettings } from '../../src/cache/types.ts';
import type { Title } from '../../src/catalog/types.ts';
import type { PersonalPatch } from '../../src/library/types.ts';
import { open_database } from './database.ts';
import { create_store } from './index.ts';
import type { Store } from './types.ts';

const movie: Title = {
  id: 'tt0133093', title: 'Movie', year: 1999, artwork: '', genres: ['Drama'], kind: 'movie', anime: false,
  backdrop: '', minutes: null, synopsis: '', director: '', cast: '', imdb_id: 'tt0133093', tmdb_id: null,
  season: null, episode: null, series: null, related: [], images: [],
  source_url: 'https://v3-cinemeta.strem.io/meta/movie/tt0133093.json',
};
const series: Title = {
  ...movie, id: 'tt1234567', title: 'Series', year: 2024, kind: 'series', imdb_id: 'tt1234567',
  source_url: 'https://v3-cinemeta.strem.io/meta/series/tt1234567.json',
};
const episode: Title = {
  ...series, id: 'tt1234567:1:1', title: 'Episode', kind: 'episode', imdb_id: null, season: 1, episode: 1,
  series: { id: series.id, title: series.title, imdb_id: series.imdb_id, tmdb_id: null },
};
function put(titles: Title[]) {
  store.title_put(titles.map(title => ({ title, genres: [{ id: 'drama', label: 'Drama' }] })));
}
let directory: string;
let store: Store;
let profile: number;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'streamit-store-'));
  store = create_store(directory);
  profile = store.profile_create('test').id;
});
afterEach(() => {
  vi.restoreAllMocks();
  store.close();
  rmSync(directory, { recursive: true, force: true });
});

describe('personal storage', () => {
  it('keeps title scopes, statuses, favorites, saved state and history independent across updates and reopen', () => {
    put([movie, series, episode]);
    store.personal_update(profile, movie.id, { rating: 4.5, status: 'want', favorite: true, saved: true, opened: true });
    store.personal_update(profile, series.id, { status: 'watching', favorite: true });
    store.personal_update(profile, episode.id, { rating: 0.5, status: 'watched' });
    store.season_update(profile, series.id, 1, 4);
    store.season_update(profile, series.id, 2, 2.5);

    const opened = store.library_get(profile).entries[movie.id]!.last_opened_at;
    expect(store.library_get(profile)).toMatchObject({
      entries: {
        [movie.id]: { id: movie.id, rating: 4.5, status: 'want', favorite: true, saved: true, last_opened_at: opened },
        [series.id]: { id: series.id, rating: null, status: 'watching', favorite: true, saved: false, last_opened_at: null },
        [episode.id]: { id: episode.id, rating: 0.5, status: 'watched', favorite: false, recommended: false, saved: false, last_opened_at: null },
      },
      seasons: { [series.id]: { 1: 4, 2: 2.5 } },
    });

    store.close();
    store = create_store(directory);
    const library = store.library_get(profile);
    expect(library.entries[movie.id]).toMatchObject({ rating: 4.5, status: 'want', favorite: true, saved: true, last_opened_at: opened });
    expect(library.entries[series.id]).toMatchObject({ status: 'watching', favorite: true });
    expect(library.entries[episode.id]).toMatchObject({ rating: 0.5, status: 'watched' });
    expect(library.seasons).toEqual({ [series.id]: { 1: 4, 2: 2.5 } });
    expect(library.saved.map(item => item.id)).toEqual([movie.id]);
    expect(library.recent.map(item => item.id)).toEqual([movie.id]);
  });

  it('supports every tracking transition without coupling status to favorite or saved', () => {
    put([series]);
    for (const status of ['want', 'watching', 'paused', 'watched', 'dropped'] as const) {
      const entry = store.personal_update(profile, series.id, { status }).entries[series.id];
      expect(entry).toMatchObject({ status, favorite: false, saved: false });
    }
    store.personal_update(profile, series.id, { favorite: true, saved: true });
    expect(store.library_get(profile).entries[series.id]).toMatchObject({ status: 'dropped', favorite: true, saved: true });
    store.personal_update(profile, series.id, { status: null });
    expect(store.library_get(profile).entries[series.id]).toMatchObject({ status: null, favorite: true, saved: true });
    store.personal_update(profile, series.id, { favorite: false, status: 'watching' });
    expect(store.library_get(profile).entries[series.id]).toMatchObject({ status: 'watching', favorite: false, saved: true });
  });

  it('does not mark a title watched when it is rated or opened', () => {
    put([movie]);
    const first = store.personal_update(profile, movie.id, { rating: 4.5 });
    expect(first.entries[movie.id]).toMatchObject({ rating: 4.5, status: null, last_opened_at: null });
    const second = store.personal_update(profile, movie.id, { opened: true });
    expect(second.entries[movie.id]).toMatchObject({ rating: 4.5, status: null });
    expect(second.entries[movie.id]!.last_opened_at).not.toBeNull();
  });

  it('surfaces an existing watched flag without migrating it and lets an explicit status take precedence', () => {
    put([movie]);
    store.personal_update(profile, movie.id, { rating: 3 });
    store.close();
    const database = open_database(directory);
    database.prepare('UPDATE personal SET watched = 1 WHERE id = ?').run(movie.id);
    database.close();
    store = create_store(directory);
    expect(store.library_get(profile).entries[movie.id]).toMatchObject({ rating: 3, status: 'watched' });
    store.personal_update(profile, movie.id, { status: 'paused' });
    expect(store.library_get(profile).entries[movie.id]).toMatchObject({ rating: 3, status: 'paused' });
    store.personal_update(profile, movie.id, { status: null });
    expect(store.library_get(profile).entries[movie.id]).toMatchObject({ rating: 3, status: null });
  });

  it('rejects invalid personal and season updates atomically', () => {
    put([movie, series]);
    store.personal_update(profile, movie.id, { rating: 4, favorite: true });
    const invalid: unknown[] = [
      { rating: 0 }, { rating: 5.5 }, { rating: 1.25 }, { rating: NaN }, { rating: Infinity }, { rating: '4' },
      { status: 'queued' }, { status: 1 }, { favorite: null }, { saved: null }, { opened: 'yes' }, { watched: true },
      { favorite: false, extra: true }, null, [],
    ];
    for (const patch of invalid) expect(() => store.personal_update(profile, movie.id, patch as PersonalPatch)).toThrow(RangeError);
    for (const id of ['invalid', 'tt123', 'TT1234567', "tt1234567' OR 1=1", '../tt1234567']) {
      expect(() => store.personal_update(profile, id, {})).toThrow(RangeError);
    }
    expect(() => store.personal_update(profile, 'tt9999999', {})).toThrow('Catalog entry not found');
    expect(() => store.season_update(profile, series.id, 1, 1.25 as never)).toThrow(RangeError);
    expect(() => store.season_update(profile, series.id, -1, 3)).toThrow(RangeError);
    expect(() => store.season_update(profile, series.id, 100000, 3)).toThrow(RangeError);
    expect(() => store.season_update(profile, 'tt123456', 1, 3)).toThrow(RangeError);
    expect(() => store.season_update(profile, movie.id, 1, 3)).toThrow('Series catalog entry not found');
    expect(store.library_get(profile).entries[movie.id]).toMatchObject({ rating: 4, favorite: true, status: null });
    expect(store.library_get(profile).seasons).toEqual({});
  });

  it('clears one season rating without creating title or episode entries', () => {
    put([series, episode]);
    store.personal_update(profile, episode.id, { rating: 4.5 });
    store.season_update(profile, series.id, 1, 5);
    store.season_update(profile, series.id, 2, 3.5);
    store.season_update(profile, series.id, 1, null);
    const library = store.library_get(profile);
    expect(library.entries[episode.id]).toMatchObject({ rating: 4.5, status: null });
    expect(library.entries[series.id]).toBeUndefined();
    expect(library.seasons).toEqual({ [series.id]: { 2: 3.5 } });
  });
});

describe('cache and settings storage', () => {
  it('records successful writes only, binds cache keys, and preserves personal state at any age', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const key = "query:'; DELETE FROM personal; --";
    put([movie]);
    store.personal_update(profile, movie.id, { saved: true, status: 'watched', rating: 3.5 });
    store.cache_set(key, { items: [movie], nested: { value: true } });
    clock.mockReturnValue(1000 + 400 * 24 * 60 * 60 * 1000);
    expect(store.cache_get(key)).toMatchObject({ updated_at: 1000, value: { nested: { value: true } } });
    expect(store.cache_get('missing')).toBeNull();
    expect(store.library_get(profile).entries[movie.id]).toMatchObject({ saved: true, status: 'watched', rating: 3.5 });
    expect(store.status()).toMatchObject({ metadata_count: 1, image_count: 0, image_bytes: 0 });
    store.cache_set(key, { items: [] });
    expect(store.cache_get(key)?.updated_at).toBe(Date.now());
  });

  it('summarizes cached images from their records', () => {
    store.image_put({ key: 'a'.repeat(64), source_url: 'https://images.metahub.space/a', content_type: 'image/jpeg', bytes: 10, fetched_at: 1, accessed_at: 1 });
    store.image_put({ key: 'b'.repeat(64), source_url: 'https://images.metahub.space/b', content_type: null, bytes: 0, fetched_at: null, accessed_at: 1 });
    expect(store.status()).toMatchObject({ image_count: 1, image_bytes: 10 });
  });

  it('persists bounded settings, preserves unrelated settings, and rejects unknown or invalid values', () => {
    expect(store.settings_get()).toEqual({ metadata_hours: 24, images_days: 30, max_stale_days: 7, image_limit_mb: 1024 });
    store.settings_update({ metadata_hours: 0.25, images_days: 0.25, max_stale_days: 0, image_limit_mb: 16 });
    store.settings_update({ metadata_hours: 8760, images_days: 365, max_stale_days: 365, image_limit_mb: 10240 });
    const invalid: unknown[] = [{ metadata_hours: 0 }, { metadata_hours: 8761 }, { images_days: 0.2 }, { images_days: 366 }, { max_stale_days: -1 }, { max_stale_days: 366 }, { image_limit_mb: 15 }, { image_limit_mb: 10241 }, { images_days: Infinity }, { images_days: NaN }, { metadata_hours: '24' }, { images_days: 10, unknown: 1 }, null, []];
    for (const patch of invalid) expect(() => store.settings_update(patch as Partial<CacheSettings>)).toThrow(RangeError);
    expect(store.settings_update({ metadata_hours: 48 })).toEqual({ metadata_hours: 48, images_days: 365, max_stale_days: 365, image_limit_mb: 10240 });
    store.close();
    store = create_store(directory);
    expect(store.settings_get().metadata_hours).toBe(48);
  });
});
