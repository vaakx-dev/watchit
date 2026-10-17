import { describe, expect, it, vi } from 'vitest';
import type { CatalogQuery } from '../../src/catalog/types.ts';
import type { Images } from '../media/types.ts';
import { image_url } from '../media/urls.ts';
import type { CacheRecord, Store } from '../storage/types.ts';
import { Http } from './http.ts';
import { Source } from './source.ts';
import { Mapping } from './mapping.ts';
import type { Meta } from './schema.ts';

const movie: Meta = {
  id: 'tt0133093', type: 'movie', name: 'The Matrix', releaseInfo: '1999', runtime: '136 min', moviedb_id: 603,
  genres: ['Action', 'Sci-Fi'], description: 'A programmer finds another reality.', director: ['Lana Wachowski'], cast: ['Keanu Reeves'],
  poster: 'https://images.metahub.space/poster/small/tt0133093/img', background: 'https://images.metahub.space/background/medium/tt0133093/img',
};
const series: Meta = {
  ...movie, id: 'tt0903747', type: 'series', name: 'Breaking Bad', releaseInfo: '2008–2013', videos: [
    { id: 'tt0903747:2:1', season: 2, episode: 1, name: 'Later' },
    { id: 'tt0903747:1:1', season: 1, episode: 1, number: 1, name: 'Pilot', released: '2008-01-21',
      description: 'Pilot description', thumbnail: 'https://episodes.metahub.space/tt0903747/1/1/w780.jpg' },
    { season: 0, episode: 1, name: 'Special' },
    { name: 'No coordinates' }, { season: 1, episode: -1 }, { season: 1, episode: 2.5 },
    { season: 1, episode: 100000 }, { season: 1, episode: 2, number: 3 },
    { id: 'tt0000001:1:2', season: 1, episode: 2 },
  ],
};
const query: CatalogQuery = { kind: 'all', page: 1, query: '', genre: '', sort: 'newest' };
function setup(respond: (url: URL) => unknown) {
  const fetcher = vi.fn<typeof fetch>(async input => Response.json(respond(new URL(String(input)))));
  const images: Images = { register: vi.fn(url => `/media/${encodeURIComponent(url)}`), get: vi.fn() };
  return { source: new Source(new Http({ fetch: fetcher, request_interval_ms: 0 }), images), fetcher, images };
}

describe('Cinemeta source', () => {
  it('discovers anime through both Animation catalogs without classifying other animation as anime', async () => {
    const { source, fetcher } = setup(url => url.pathname === '/manifest.json'
      ? { catalogs: ['movie', 'series'].map(type => ({ type, id: 'top', genres: ['Animation'] })) }
      : { metas: [{ ...movie, genres: ['Animation'], country: 'Japan' }, { ...series, genres: ['Animation'], country: 'United States' }] });
    const result = await source.catalog({ ...query, kind: 'anime' });
    expect(fetcher.mock.calls.map(([url]) => String(url)).filter(url => url.includes('/catalog/'))).toEqual([
      'https://v3-cinemeta.strem.io/catalog/movie/top/genre=Animation&skip=0.json',
      'https://v3-cinemeta.strem.io/catalog/series/top/genre=Animation&skip=0.json',
    ]);
    expect(result.titles.map(item => item.title.anime)).toEqual([true, false]);
  });

  it('projects cached catalog and detail responses to the fields used by the importer', async () => {
    const values = new Map<string, CacheRecord<unknown>>();
    const cache: Pick<Store, 'cache_get' | 'cache_set' | 'settings_get'> = {
      cache_get: <T>(key: string) => values.get(key) as CacheRecord<T> | undefined ?? null,
      cache_set: (key, value) => { values.set(key, { value, updated_at: Date.now() }); },
      settings_get: () => ({ metadata_hours: 24, images_days: 30, max_stale_days: 365, image_limit_mb: 1024 }),
    };
    const upstream = { ...series, links: ['unused'], trailers: [{ source: 'NKYea63tQmI', type: 'Trailer', unused: true }], popularities: { unused: 1 },
      videos: [{ ...series.videos![1], rating: 'unused', tvdb_id: 123 }] };
    const fetcher = vi.fn<typeof fetch>(async input => Response.json(String(input).includes('/catalog/') ? { metas: [upstream] } : { meta: upstream }));
    const source = new Source(new Http({ fetch: fetcher, request_interval_ms: 0 }), { register: () => '', get: vi.fn() }, { cache });
    await source.catalog({ ...query, kind: 'series' });
    await source.title(series.id, 'series');
    const catalog = [...values].find(([key]) => key.includes('/catalog/'))?.[1].value as { metas: Meta[] };
    const detail = [...values].find(([key]) => key.includes('/meta/'))?.[1].value as { meta: Meta };
    expect(catalog.metas[0]?.videos).toBeUndefined();
    expect(detail.meta.trailers).toEqual([{ source: 'NKYea63tQmI', type: 'Trailer' }]);
    expect(detail.meta.videos?.[0]).toMatchObject({ season: 1, episode: 1, thumbnail: 'https://episodes.metahub.space/tt0903747/1/1/w780.jpg' });
    expect(JSON.stringify([...values])).not.toContain('unused');
    expect(JSON.stringify([...values])).not.toContain('tvdb_id');
  });

  it('caches source responses and stops when a catalog repeats the preceding page', async () => {
    const values = new Map<string, CacheRecord<unknown>>();
    const cache: Pick<Store, 'cache_get' | 'cache_set' | 'settings_get'> = {
      cache_get: <T>(key: string) => values.get(key) as CacheRecord<T> | undefined ?? null,
      cache_set: (key, value) => { values.set(key, { value, updated_at: Date.now() }); },
      settings_get: () => ({ metadata_hours: 24, images_days: 30, max_stale_days: 365, image_limit_mb: 1024 }),
    };
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ metas: [movie] }));
    const source = new Source(new Http({ fetch: fetcher, request_interval_ms: 0 }), { register: () => '', get: vi.fn() }, { cache });
    expect((await source.catalog({ ...query, kind: 'movie' })).has_next).toBe(true);
    await source.catalog({ ...query, kind: 'movie' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await source.catalog({ ...query, kind: 'movie', page: 2 })).has_next).toBe(false);
    expect([...values.keys()].every(key => key.startsWith('cinemeta:response:v4:'))).toBe(true);
  });

  it('deduplicates concurrent parent detail requests', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const fetcher = vi.fn<typeof fetch>(async () => {
      await gate;
      return Response.json({ meta: series });
    });
    const source = new Source(new Http({ fetch: fetcher, request_interval_ms: 0 }), { register: () => '', get: vi.fn() });
    const first = source.title(series.id, 'series');
    const second = source.title(series.id, 'series');
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledOnce();
    release();
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('accepts partial search metadata without claiming missing detail', async () => {
    const { source } = setup(() => ({ metas: [{ id: movie.id, type: movie.type, name: movie.name, releaseInfo: '1999' }] }));
    const result = await source.catalog({ ...query, kind: 'movie', query: 'matrix' });
    expect(result.titles[0]?.title).toMatchObject({ synopsis: '', cast: '', director: '', genres: [], tmdb_id: null, minutes: null, year: 1999 });
  });

  it('imports movie and series catalogs directly and only registers supplied artwork', async () => {
    const { source, fetcher, images } = setup(url => ({ metas: [url.pathname.includes('/movie/') ? movie : series] }));
    const result = await source.catalog(query);
    expect(result.titles.map(item => item.title.id)).toEqual(['tt0133093', 'tt0903747']);
    expect(result.titles[0]).toMatchObject({ genres: [{ id: 'action' }, { id: 'sci-fi' }], title: {
      year: 1999, minutes: 136, imdb_id: 'tt0133093', tmdb_id: 603, director: 'Lana Wachowski', cast: 'Keanu Reeves',
      source_url: 'https://v3-cinemeta.strem.io/meta/movie/tt0133093.json',
      images: [{ source: 'cinemeta', role: 'poster', terms_url: 'https://www.metahub.space/terms' }, { role: 'backdrop' }],
    } });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(images.get).not.toHaveBeenCalled();
    expect(result.has_next).toBe(true);
  });

  it('uses the observed 50-position skip even when a source page contains fewer entries', async () => {
    const { source, fetcher } = setup(() => ({ metas: [movie] }));
    expect((await source.catalog({ ...query, kind: 'movie', page: 2 })).has_next).toBe(true);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('/top/skip=50.json');
    const empty = setup(() => ({ metas: [] }));
    expect((await empty.source.catalog(query)).has_next).toBe(false);
  });

  it('maps genres through the official manifest and encodes search in both types', async () => {
    const { source, fetcher } = setup(url => url.pathname === '/manifest.json'
      ? { catalogs: [{ type: 'movie', id: 'top', genres: ['Sci-Fi'] }, { type: 'series', id: 'top', genres: ['Sci-Fi'] }] }
      : { metas: [movie] });
    const result = await source.catalog({ ...query, genre: 'sci-fi', query: 'matrix & friends' });
    expect(fetcher.mock.calls.map(([url]) => String(url)).filter(url => url.includes('/catalog/'))).toEqual([
      'https://v3-cinemeta.strem.io/catalog/movie/top/genre=Sci-Fi&search=matrix%20%26%20friends&skip=0.json',
      'https://v3-cinemeta.strem.io/catalog/series/top/genre=Sci-Fi&search=matrix%20%26%20friends&skip=0.json',
    ]);
    expect(result.has_next).toBe(false);
    await source.catalog({ ...query, query: 'matrix', page: 2 });
    expect(fetcher).toHaveBeenCalledTimes(4);
    await source.catalog({ ...query, genre: 'science-fiction', query: 'dune' });
    expect(String(fetcher.mock.calls.at(-1)?.[0])).toContain('/catalog/series/top/genre=Sci-Fi&search=dune&skip=0.json');
  });

  it('does not infer anime from animation and isolates each image registration failure', async () => {
    const images: Images = { register: url => { if (url.includes('/poster/')) throw new Error('Unavailable'); return '/media/background'; }, get: vi.fn() };
    const mapping = new Mapping(images);
    expect(mapping.imported({ ...movie, genres: ['Animation'] })?.title).toMatchObject({ anime: false, artwork: '', backdrop: 'https://live.metahub.space/background/large/tt0133093/img' });
    expect(mapping.imported({ ...movie, genres: ['Anime'] })?.title.anime).toBe(true);
    expect(mapping.imported({ ...movie, genres: ['Animation'], country: 'Japan' })?.title.anime).toBe(true);
    expect(mapping.imported({ ...movie, genres: ['Animation'], country: 'United States, Japan' })?.title.anime).toBe(true);
    expect(mapping.imported({ ...movie, genres: ['Animation'], country: ['Japan'] })?.title.anime).toBe(true);
    expect(mapping.imported({ ...movie, genres: ['Animation'], country: 'United States' })?.title.anime).toBe(false);
    expect(mapping.imported({ ...movie, genres: ['Drama'], country: 'Japan' })?.title.anime).toBe(false);
  });

  it('maps IMDb ratings and popularity, treating blank or out-of-range ratings as unknown', () => {
    const mapping = new Mapping({ register: () => '', get: vi.fn() });
    expect(mapping.imported({ ...movie, imdbRating: '8.7', popularity: 1.5 })).toMatchObject({
      title: { imdb_rating: 8.7, popularity: 1.5 }, present: expect.arrayContaining(['imdb_rating', 'popularity']) });
    expect(mapping.imported({ ...movie, imdbRating: '' })?.title.imdb_rating).toBeNull();
    expect(mapping.imported({ ...movie, imdbRating: '11' })?.title.imdb_rating).toBeNull();
    expect(mapping.imported(movie)?.present).not.toContain('imdb_rating');
    const parent = mapping.imported({ ...series, imdbRating: '9.5' })!;
    expect(mapping.episodes(series, parent).map(item => item.title.imdb_rating)).toEqual([null, null, null]);
  });

  it('keeps only valid, distinct YouTube trailer ids and leaves episodes without trailers', () => {
    const mapping = new Mapping({ register: () => '', get: vi.fn() });
    const trailers = [
      { source: 'NKYea63tQmI', type: 'Trailer' }, { source: 'P0XN3-n-2Lo', type: 'Trailer' }, { source: 'NKYea63tQmI', type: 'Trailer' },
      { source: 'DX2w7kH0p20', type: 'Clip' }, { source: 'short', type: 'Trailer' }, { source: 'NKYea63tQmIx', type: 'Trailer' },
      { source: 'NKYea63tQm"', type: 'Trailer' }, { source: 'javascript:', type: 'Trailer' }, { type: 'Trailer' },
    ];
    expect(mapping.imported({ ...movie, trailers })).toMatchObject({
      title: { trailers: [{ id: 'NKYea63tQmI' }, { id: 'P0XN3-n-2Lo' }] }, present: expect.arrayContaining(['trailers']) });
    expect(mapping.imported(movie)).toMatchObject({ title: { trailers: [] } });
    expect(mapping.imported(movie)?.present).not.toContain('trailers');
    const parent = mapping.imported({ ...series, trailers })!;
    expect(mapping.episodes(series, parent).map(item => item.title.trailers)).toEqual([[], [], []]);
  });

  it('maps live.metahub.space posters locally and backdrops to the full-resolution origin', () => {
    const mapping = new Mapping({ register: url => `/media/${image_url(url)}`, get: vi.fn() });
    const live = { ...movie, poster: movie.poster!.replace('images.', 'live.'), background: movie.background!.replace('images.', 'live.') };
    expect(mapping.imported(live)?.title).toMatchObject({ artwork: `/media/${live.poster}`, backdrop: 'https://live.metahub.space/background/large/tt0133093/img',
      images: [{ role: 'poster', terms_url: 'https://www.metahub.space/terms' }, { role: 'backdrop' }] });
  });

  it('maps only explicit valid episode coordinates and sorts specials, seasons and episodes', async () => {
    const { source } = setup(() => ({ meta: series }));
    const result = await source.title('tt0903747', 'series');
    expect(result.titles.map(item => item.title.id)).toEqual(['tt0903747', 'tt0903747:0:1', 'tt0903747:1:1', 'tt0903747:2:1']);
    expect(result.titles[2]?.title).toMatchObject({ title: 'Pilot', imdb_id: null, season: 1, episode: 1,
      synopsis: 'Pilot description', series: { id: 'tt0903747', imdb_id: 'tt0903747' }, images: [{ role: 'still' }] });
    expect((await source.title('tt0903747:1:1')).title.id).toBe('tt0903747:1:1');
    expect((await source.episodes('tt0903747', 1)).items).toHaveLength(3);
  });

  it('validates identifiers and uses type-specific detail for known titles', async () => {
    const { source, fetcher } = setup(() => ({ meta: movie }));
    await expect(source.title('invalid')).rejects.toMatchObject({ status: 400 });
    expect(fetcher).not.toHaveBeenCalled();
    await source.title(movie.id, 'movie');
    expect(String(fetcher.mock.calls[0]?.[0])).toBe('https://v3-cinemeta.strem.io/meta/movie/tt0133093.json');
  });
});
