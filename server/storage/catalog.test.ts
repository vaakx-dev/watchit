import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogQuery, Title } from '../../src/catalog/types.ts';
import { create_store } from './index.ts';
import type { ImportedTitle, Store } from './types.ts';

const query: CatalogQuery = { page: 1, query: '', kind: 'all', genre: '', sort: 'newest' };
const drama = { id: 'drama', label: 'Drama' };
const comedy = { id: 'comedy', label: 'Comedy' };
const option = (genre: { id: string; label: string }) => ({ ...genre, minor: false });
function imported(id: string, patch: Partial<Title> = {}, genres = [drama]): ImportedTitle {
  return { title: { id, title: id, year: 2024, artwork: '', genres: genres.map(genre => genre.label), kind: 'movie',
    anime: false, backdrop: '', minutes: null, synopsis: '', director: '', cast: '', imdb_id: null, tmdb_id: null,
    season: null, episode: null, series: null, related: [], images: [], source_url: `https://v3-cinemeta.strem.io/meta/${patch.kind === 'series' ? 'series' : 'movie'}/${id}.json`,
    ...patch }, genres };
}
let directory: string;
let store: Store;
let profile: number;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'streamit-catalog-'));
  store = create_store(directory);
  profile = store.profile_create('test').id;
});
afterEach(() => {
  vi.restoreAllMocks();
  store.close();
  rmSync(directory, { recursive: true, force: true });
});

describe('durable titles', () => {
  it('persists complete snapshots and timestamps and keeps personal data across upserts and reopen', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const item = imported('tt0000001', { title: 'First', imdb_id: 'tt123', provider_ids: { one_anime: 'provider-key' },
      images: [{ url: '/image', description_url: '/credit', author: 'Author', license: 'CC0', license_url: '/license' }] });
    store.title_put([item]);
    store.personal_update(profile, 'tt0000001', { rating: 4.5, status: 'watched', saved: true, opened: true });
    const personal = store.library_get(profile).entries.tt0000001;
    clock.mockReturnValue(2000);
    const updated = { ...item, title: { ...item.title, title: 'Updated', genres: ['Comedy'] }, genres: [comedy] };
    store.title_put([updated]);
    store.close();
    store = create_store(directory);
    expect(store.title_get('tt0000001')).toEqual({ value: updated.title, updated_at: 2000 });
    expect(store.library_get(profile).entries.tt0000001).toEqual(personal);
    expect(store.library_get(profile).saved[0]?.title).toBe('Updated');
    expect(store.catalog_query({ ...query, genre: drama.id }).items).toEqual([]);
    expect(store.catalog_query({ ...query, genre: comedy.id }).items.map(item => item.id)).toEqual(['tt0000001']);
  });

  it('rolls back all basic rows, snapshots and genres when a batch fails', () => {
    store.title_put([imported('tt0000001')]);
    const previous = store.title_get('tt0000001');
    expect(() => store.title_put([imported('tt0000001', { title: 'Changed' }, [comedy]), imported('tt0000002'),
      imported('tt0000003', {}, [{ id: 'Invalid Genre', label: 'Invalid' }])])).toThrow(RangeError);
    expect(store.title_get('tt0000001')).toEqual(previous);
    expect(store.catalog_get('tt0000001')?.title).toBe('tt0000001');
    expect(store.title_get('tt0000002')).toBeNull();
    expect(store.catalog_count()).toBe(1);
    expect(store.catalog_query(query).genres).toEqual([option(drama)]);
  });

  it('keeps old imports readable beyond stale grace and uses settings only for freshness', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    store.title_put([imported('tt0000001')]);
    store.settings_update({ metadata_hours: 1, max_stale_days: 0 });
    clock.mockReturnValue(1000 + 60 * 60 * 1000);
    expect(store.catalog_query(query).freshness).toEqual({ updated_at: new Date(1000).toISOString(), stale: true });
    store.settings_update({ metadata_hours: 2 });
    expect(store.catalog_query(query).freshness.stale).toBe(false);
    clock.mockReturnValue(1000 + 400 * 24 * 60 * 60 * 1000);
    store.close();
    store = create_store(directory);
    expect(store.title_get('tt0000001')?.updated_at).toBe(1000);
    expect(store.catalog_query(query).items).toHaveLength(1);
    expect(store.catalog_query(query).freshness.stale).toBe(true);
    expect(store.catalog_query({ ...query, page: 2 }).freshness).toEqual({ updated_at: '', stale: false });
  });

});

describe('local SQL browsing', () => {
  it('paginates after global year/title sorting, places unknown years last and breaks ties by ID', () => {
    const entries = Array.from({ length: 51 }, (_, index) => imported(`tt${String(index + 1).padStart(7, '0')}`, {
      title: `Title ${String(50 - index).padStart(2, '0')}`, year: 2000 + index,
    }));
    store.title_put(entries);
    store.title_put([imported('tt0000060', { title: 'Title 00', year: 2050 }), imported('tt0000061', { title: 'Unknown', year: null }),
      imported('tt0000062', { title: 'Excluded', kind: 'episode', year: 3000 })]);
    const first = store.catalog_query(query);
    const second = store.catalog_query({ ...query, page: 2 });
    const last = store.catalog_query({ ...query, page: 3 });
    expect(first.items).toHaveLength(24);
    expect(second.items).toHaveLength(24);
    expect(last.items).toHaveLength(5);
    expect(first.items.slice(0, 3).map(item => item.id)).toEqual(['tt0000051', 'tt0000060', 'tt0000050']);
    expect(last.items.at(-1)?.id).toBe('tt0000061');
    expect([first.has_next, second.has_next, last.has_next]).toEqual([true, true, false]);
    expect(new Set([...first.items, ...second.items, ...last.items].map(item => item.id)).size).toBe(53);
    const alphabetical = store.catalog_query({ ...query, sort: 'title', page: 2 });
    expect(alphabetical.items[0]?.title).toBe('Title 23');
    expect(store.catalog_count()).toBe(53);
  });

  it('filters by kind, anime and genre IDs and gives global genre options for kind/search, not page or genre', () => {
    store.title_put(Array.from({ length: 25 }, (_, index) => imported(`tt${String(index + 1).padStart(7, '0')}`, { title: `Match ${index}`, year: 2024 - index })));
    store.title_put([imported('tt0000030', { title: 'Match comedy', year: 1900 }, [comedy]),
      imported('tt0000031', { title: 'Other', kind: 'series' }, [{ id: 'other', label: 'Other' }]),
      imported('tt0000032', { title: 'Anime movie', anime: true }), imported('tt0000033', { title: 'Anime series', kind: 'series', anime: true }),
      imported('tt0000034', { title: 'Match episode', kind: 'episode' }, [{ id: 'episode-genre', label: 'Episode genre' }])]);
    const result = store.catalog_query({ ...query, query: 'mAtCh', kind: 'movie', genre: drama.id });
    expect(result.items).toHaveLength(24);
    expect(result.has_next).toBe(true);
    expect(result.genres).toEqual([option(comedy), option(drama)]);
    expect(store.catalog_query({ ...query, kind: 'anime' }).items.map(item => item.id)).toEqual(['tt0000032', 'tt0000033']);
    expect(store.catalog_query({ ...query, kind: 'series' }).items.map(item => item.id)).toEqual(['tt0000033', 'tt0000031']);
    expect(store.catalog_query({ ...query, genre: comedy.id }).items.map(item => item.id)).toEqual(['tt0000030']);
  });

  it('treats wildcard, escape and SQL characters as literal search text', () => {
    store.title_put([imported('tt0000001', { title: '100%_\\ Match' }), imported('tt0000002', { title: '10000 Match' }),
      imported('tt0000003', { title: "A ' OR 1=1 -- title" }), imported('tt0000004', { title: 'ÉTÉ' })]);
    expect(store.catalog_query({ ...query, query: '%_\\ mAtCh' }).items.map(item => item.id)).toEqual(['tt0000001']);
    expect(store.catalog_query({ ...query, query: "' OR 1=1 --" }).items.map(item => item.id)).toEqual(['tt0000003']);
    expect(store.catalog_query({ ...query, query: 'été' }).items.map(item => item.id)).toEqual(['tt0000004']);
  });

  it('backfills lowercase search text for catalogs created before the search column', () => {
    store.close();
    rmSync(directory, { recursive: true, force: true });
    mkdirSync(directory);
    const database = new DatabaseSync(join(directory, 'streamit.sqlite'));
    database.exec(`CREATE TABLE catalog (id TEXT PRIMARY KEY, title TEXT NOT NULL, year INTEGER, artwork TEXT NOT NULL, genres TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('movie', 'series', 'episode')), anime INTEGER NOT NULL CHECK (anime IN (0, 1)));
      CREATE TABLE title_snapshots (id TEXT PRIMARY KEY REFERENCES catalog(id), value TEXT NOT NULL, updated_at INTEGER NOT NULL,
        series_id TEXT, season INTEGER, episode INTEGER);
      INSERT INTO catalog VALUES ('tt0000001', 'ÉTÉ', 2024, '', '[]', 'movie', 0);
      INSERT INTO title_snapshots VALUES ('tt0000001', '{}', 1, NULL, NULL, NULL);`);
    database.close();
    store = create_store(directory);
    expect(store.catalog_query({ ...query, query: 'été' }).items.map(item => item.id)).toEqual(['tt0000001']);
  });

  it('refreshes the timestamp of an unchanged title without rewriting it', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    store.title_put([imported('tt0000001')]);
    clock.mockReturnValue(2000);
    store.title_put([imported('tt0000001')]);
    expect(store.title_get('tt0000001')?.updated_at).toBe(2000);
    expect(store.catalog_query(query).genres).toEqual([option(drama)]);
    store.title_put([imported('tt0000001', {}, [comedy])]);
    expect(store.catalog_query(query).genres).toEqual([option(comedy)]);
  });

  it('lists episodes only for their recorded series with known sequence values first and no inference', () => {
    const series = { id: 'tt0001000', title: 'Series', imdb_id: null, tmdb_id: null };
    const episodes = [
      imported('tt0000001', { kind: 'episode', series, season: null, episode: null }),
      imported('tt0000002', { kind: 'episode', series, season: 2, episode: 1 }),
      imported('tt0000003', { kind: 'episode', series, season: 1, episode: null }),
      imported('tt0000004', { kind: 'episode', series, season: 1, episode: 2 }),
      imported('tt0000005', { kind: 'episode', series, season: 1, episode: 2 }),
      imported('tt0000006', { kind: 'episode', series: { ...series, id: 'tt0001001' }, season: 1, episode: 1 }),
      imported('tt0000007', { kind: 'series', series, season: 1, episode: 1 }),
    ];
    store.title_put(episodes);
    const result = store.episodes_query('tt0001000', 1);
    expect(result.items.map(item => item.id)).toEqual(['tt0000004', 'tt0000005', 'tt0000003', 'tt0000002', 'tt0000001']);
    expect(result.items.at(-1)).toMatchObject({ season: null, episode: null });
    expect(result.has_next).toBe(false);
    store.title_put(Array.from({ length: 25 }, (_, index) => imported(`tt${String(index + 10).padStart(7, '0')}`, { kind: 'episode', series, season: 3, episode: index + 1 })));
    expect(store.episodes_query('tt0001000', 1).items).toHaveLength(24);
    expect(store.episodes_query('tt0001000', 1).has_next).toBe(true);
    expect(store.episodes_query('tt0001000', 2).items).toHaveLength(6);
    expect(store.episodes_query('tt0001000', 3).freshness).toEqual({ updated_at: '', stale: false });
  });

  it('navigates by local episode order across season and page boundaries', () => {
    const series = { id: 'tt0002000', title: 'Series', imdb_id: null, tmdb_id: null };
    const episodes = [
      ...Array.from({ length: 25 }, (_, index) => {
        const episode = index + 1;
        return imported(`tt0002000:0:${episode}`, { kind: 'episode', series, season: 0, episode });
      }),
      imported('tt0002000:2:7', { kind: 'episode', series, season: 2, episode: 7 }),
      imported('tt0002000:4:9', { kind: 'episode', series, season: 4, episode: 9 }),
      imported('tt0002001:0:1', { kind: 'episode', series: { ...series, id: 'tt0002001' }, season: 0, episode: 1 }),
    ];
    store.title_put(episodes);

    const current = store.episode_navigation('tt0002000:0:25');
    expect(current).toMatchObject({ season: 0, seasons: [0, 2, 4], page: 2, has_next: false,
      previous: { id: 'tt0002000:0:24' }, next: { id: 'tt0002000:2:7' } });
    expect(current?.items.map(item => item.id)).toEqual(['tt0002000:0:25']);

    const other_season = store.episode_navigation('tt0002000:0:25', 2, 1);
    expect(other_season).toMatchObject({ season: 2, page: 1, previous: { id: 'tt0002000:0:24' }, next: { id: 'tt0002000:2:7' } });
    expect(other_season?.items.map(item => item.id)).toEqual(['tt0002000:2:7']);

    const first = store.episode_navigation('tt0002000:0:1', 4, 1);
    expect(first).toMatchObject({ season: 4, previous: null, next: { id: 'tt0002000:0:2' } });
    const last = store.episode_navigation('tt0002000:4:9');
    expect(last).toMatchObject({ season: 4, previous: { id: 'tt0002000:2:7' }, next: null });
  });

  it('uses existing rows for sparse episode coordinates and rejects non-episode navigation', () => {
    const series = { id: 'tt0003000', title: 'Series', imdb_id: null, tmdb_id: null };
    store.title_put([
      imported('tt0003000:0:0', { kind: 'episode', series, season: 0, episode: 0 }),
      imported('tt0003000:0:3', { kind: 'episode', series, season: 0, episode: 3 }),
      imported('tt0003000:2:8', { kind: 'episode', series, season: 2, episode: 8 }),
      imported('tt0003001:0:1', { kind: 'episode', series: { ...series, id: 'tt0003001' }, season: 0, episode: 1 }),
    ]);

    expect(store.episode_navigation('tt0003000:0:0')).toMatchObject({ previous: null, next: { id: 'tt0003000:0:3' } });
    expect(store.episode_navigation('tt0003000:0:3')).toMatchObject({ previous: { id: 'tt0003000:0:0' }, next: { id: 'tt0003000:2:8' } });
    expect(store.episode_navigation('tt0003000:0:3', 0, 2)).toMatchObject({ season: 0, page: 2, items: [],
      previous: { id: 'tt0003000:0:0' }, next: { id: 'tt0003000:2:8' } });
    expect(store.episode_navigation('tt0003000:0:3', 99999)).toMatchObject({ season: 99999, items: [], seasons: [0, 2] });
    expect(store.episode_navigation('tt0003000')).toBeNull();
  });
});

describe('artwork ownership', () => {
  it('updates artwork without changing metadata age, genres or personal state and preserves matching ready Cinemeta images', () => {
    const url = `/api/images/${'a'.repeat(64)}`;
    const image = { source: 'cinemeta' as const, role: 'poster' as const, url,
      source_url: 'https://images.metahub.space/poster/medium/tt1111111/img',
      description_url: '', author: '', license: '', license_url: '' };
    const item = imported('tt1111111', { imdb_id: 'tt1111111', artwork: url, images: [image] });
    store.title_put([item]);
    store.personal_update(profile, item.title.id, { rating: 4.5, status: 'watched', saved: true });
    const timestamp = store.title_get(item.title.id)!.updated_at;
    const ready = { ...image, url: `${url}?v=123`, retrieved_at: '2026-01-01T00:00:00.000Z' };
    store.artwork_update(item.title.id, { artwork: ready.url, backdrop: '', images: [ready] });
    expect(store.title_get(item.title.id)!.updated_at).toBe(timestamp);
    expect(store.catalog_query({ ...query, genre: drama.id }).items[0]?.artwork).toBe(ready.url);
    store.title_put([{ ...item, title: { ...item.title, title: 'Updated metadata', synopsis: 'New synopsis' } }]);
    expect(store.title_get(item.title.id)!.value).toMatchObject({ title: 'Updated metadata', synopsis: 'New synopsis',
      artwork: ready.url, images: [ready] });
    expect(store.library_get(profile).entries[item.title.id]).toMatchObject({ rating: 4.5, status: 'watched', saved: true });
  });

  it.each(['source', 'role', 'identity', 'unversioned'] as const)(
    'does not retain artwork with %s mismatch', (change) => {
      const url = `/api/images/${'a'.repeat(64)}`;
      const image = { source: 'cinemeta' as const, role: 'poster' as const, url,
        source_url: 'https://images.metahub.space/poster/medium/tt1111111/img',
        description_url: '', author: '', license: '', license_url: '' };
      const item = imported('tt1111111', { imdb_id: 'tt1111111', artwork: url, images: [image] });
      store.title_put([item]);
      const old = { ...image, url: change === 'unversioned' ? url : `${url}?v=123` };
      store.artwork_update(item.title.id, { artwork: old.url, backdrop: old.url, images: [old] });
      const incoming = { ...item.title,
        imdb_id: change === 'identity' ? 'tt2222222' as const : item.title.imdb_id,
        images: [{ ...image, source_url: change === 'source' ? `${image.source_url}2` : image.source_url,
          role: change === 'role' ? 'still' as const : image.role }],
      };
      store.title_put([{ ...item, title: incoming }]);
      expect(store.title_get(item.title.id)!.value).toEqual(incoming);
    });

  it('scans durable snapshots with a stable cursor, including episodes', () => {
    store.title_put([imported('tt0000002'), imported('tt0000001'), imported('tt0000003', { kind: 'episode' })]);
    expect(store.title_list('', 2).map(title => title.id)).toEqual(['tt0000001', 'tt0000002']);
    expect(store.title_list('tt0000002', 2).map(title => title.id)).toEqual(['tt0000003']);
    expect(store.title_list('tt0000003', 2)).toEqual([]);
    expect(store.artwork_update('tt0000099', { artwork: '', backdrop: '', images: [] })).toBeNull();
  });
});
