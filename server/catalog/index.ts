import { GENRE_ID, TITLE_ID } from '../../src/catalog/identity.ts';
import { CATALOG_SORTS, type CatalogQuery, type Title, type TitleResult } from '../../src/catalog/types.ts';
import type { CacheRecord, Hidden, Store } from '../storage/types.ts';
import { CatalogError } from './http.ts';
import { detail_fresh } from './freshness.ts';
import { genre_labels } from './genres.ts';

export { CatalogError } from './http.ts';
export type { Options as CatalogOptions } from './http.ts';

function validate_id(id: string): void {
  if (TITLE_ID.exec(id)?.[0] !== id) throw new CatalogError('Use a valid title ID.', 400);
}

function validate_page(page: number): void {
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new CatalogError('Invalid page number.', 400);
}

function validate_season(season: number): void {
  if (!Number.isSafeInteger(season) || season < 0 || season > 99999) throw new CatalogError('Invalid season number.', 400);
}

export function create_catalog(store: Store) {
  function imported(id: string): CacheRecord<Title> {
    validate_id(id);
    const record = store.title_get(id);
    if (!record) throw new CatalogError('This title has not been imported into the local catalog.', 404);
    return record;
  }

  function title(profile: number, id: string): TitleResult {
    const record = imported(id);
    const series_id = record.value.kind === 'series' ? record.value.id : record.value.series?.id;
    return {
      title: { ...record.value, genres: genre_labels(record.value.genres), imdb_rating: record.value.imdb_rating ?? null,
        trailers: record.value.trailers ?? [] },
      freshness: {
        updated_at: record.updated_at ? new Date(record.updated_at).toISOString() : '',
        stale: !detail_fresh(store, record.value.id),
      },
      playback_source: store.playback_source(profile, id),
      progress: series_id ? store.series_progress(profile, series_id) : null,
    };
  }

  function catalog(input: CatalogQuery, hide?: Hidden) {
    validate_page(input.page);
    if (!['all', 'movie', 'series', 'anime'].includes(input.kind)) throw new CatalogError('Invalid catalog kind.', 400);
    if (!CATALOG_SORTS.includes(input.sort)) throw new CatalogError('Invalid catalog sort.', 400);
    const query = { ...input, query: input.query.trim(), genre: input.genre.trim() };
    if (query.query.length > 200) throw new CatalogError('Search text must not exceed 200 characters.', 400);
    if (query.genre && !GENRE_ID.test(query.genre)) throw new CatalogError('Use a valid genre ID.', 400);
    return store.catalog_query(query, hide);
  }

  function episodes(id: string, page: number) {
    validate_page(page);
    if (imported(id).value.kind !== 'series') throw new CatalogError('Episodes are only available for a series.', 400);
    return store.episodes_query(id, page);
  }

  function episode_navigation(id: string, season?: number, page?: number) {
    if (season !== undefined) validate_season(season);
    if (page !== undefined) validate_page(page);
    if (imported(id).value.kind !== 'episode') throw new CatalogError('Episode navigation is only available for an episode.', 400);
    const navigation = store.episode_navigation(id, season, page);
    if (!navigation) throw new CatalogError('This episode has no local navigation.', 404);
    return navigation;
  }

  return { catalog, imported, title, episodes, episode_navigation };
}
