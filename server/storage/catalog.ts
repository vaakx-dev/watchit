import type { DatabaseSync, SQLInputValue, StatementSync } from 'node:sqlite';
import type { CacheSettings } from '../../src/cache/types.ts';
import type { CatalogEntry, CatalogKind, CatalogQuery, EpisodeEntry, EpisodeNavigation, Freshness, Title } from '../../src/catalog/types.ts';
import { genre_labels, genre_options, genre_sources } from '../catalog/genres.ts';
import type { CacheRecord, Hidden, Store } from './types.ts';
import { keep_artwork } from './artwork.ts';
import { TOP_RATED_ORDER } from './database.ts';
import { validate_id, validate_genre } from './validation.ts';

export const PAGE_SIZE = 24;
const BROWSABLE = "catalog.kind <> 'episode'";
const EPISODE_ORDER = 'title_snapshots.season IS NULL, title_snapshots.season, title_snapshots.episode IS NULL, title_snapshots.episode, catalog.id';
export const EPISODE_RANK = 'title_snapshots.season, title_snapshots.episode, catalog.id';
export const EPISODE_RANK_DESC = 'title_snapshots.season DESC, title_snapshots.episode DESC, catalog.id DESC';
export const RANK_PARAMETERS = '(?, ?, ?)';
export type CatalogRow = Omit<CatalogEntry, 'genres' | 'anime' | 'imdb_rating'> & { genres: string; anime: number; imdb_rating: number | null };
type PageRow = CatalogRow & { updated_at: number };
export type EpisodeRow = PageRow & { season: number | null; episode: number | null };
type CurrentEpisodeRow = { id: string; series_id: string | null; season: number | null; episode: number | null };
type SnapshotRow = { value: string; updated_at: number };
type GenreSource = { id: string; label: string };
type CatalogStore = Pick<Store, 'catalog_get' | 'title_put' | 'title_get' | 'title_list' | 'artwork_update' | 'catalog_query' | 'episodes_query' | 'episode_navigation' | 'catalog_count'>;

export const KINDS: Record<CatalogKind, string> = {
  all: '1', movie: "kind = 'movie'", series: "kind = 'series'", anime: 'anime = 1',
};

export function trending_column(kind: CatalogKind): string {
  return kind === 'anime' ? 'anime_rank' : 'trending_rank';
}

export function catalog_entry(row: CatalogRow): CatalogEntry {
  return { id: row.id, title: row.title, year: row.year, artwork: row.artwork,
    genres: genre_labels(JSON.parse(row.genres) as string[]), kind: row.kind, anime: Boolean(row.anime), imdb_rating: row.imdb_rating };
}

export function hidden_condition({ profile, statuses }: Hidden): { sql: string; parameters: SQLInputValue[] } {
  return { sql: `NOT EXISTS (SELECT 1 FROM library_entries WHERE library_entries.profile_id = ? AND library_entries.id = catalog.id
    AND library_entries.status IN (${statuses.map(() => '?').join(', ')}))`, parameters: [profile, ...statuses] };
}

function catalog_order(query: CatalogQuery): string {
  if (query.sort === 'title') return 'catalog.title COLLATE NOCASE, catalog.id';
  if (query.sort === 'top_rated') return TOP_RATED_ORDER;
  if (query.sort === 'trending') return `catalog.${trending_column(query.kind)} NULLS LAST, catalog.year DESC, catalog.title COLLATE NOCASE, catalog.id`;
  return 'catalog.year DESC, catalog.title COLLATE NOCASE, catalog.id';
}

export function page_offset(page: number): number {
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger((page - 1) * PAGE_SIZE)) {
    throw new RangeError('Invalid catalog page');
  }
  return (page - 1) * PAGE_SIZE;
}

function validate_season(season: number): void {
  if (!Number.isSafeInteger(season) || season < 0 || season > 99999) throw new RangeError('Invalid season');
}

export function episode_entry(row: EpisodeRow): EpisodeEntry {
  return { ...catalog_entry(row), kind: 'episode', season: row.season, episode: row.episode };
}

export function create_catalog(
  database: DatabaseSync,
  transaction: <T>(operation: () => T) => T,
  settings_get: () => CacheSettings,
): CatalogStore {
  const insert = `INSERT INTO catalog (id, title, year, artwork, genres, kind, anime, search, imdb_rating, popularity)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const queries = {
    get: database.prepare('SELECT * FROM catalog WHERE id = ?'),
    put: database.prepare(`${insert} ON CONFLICT(id) DO UPDATE SET title = excluded.title, year = excluded.year,
      artwork = excluded.artwork, genres = excluded.genres, kind = excluded.kind, anime = excluded.anime, search = excluded.search,
      imdb_rating = excluded.imdb_rating, popularity = excluded.popularity`),
    title_get: database.prepare('SELECT value, updated_at FROM title_snapshots WHERE id = ?'),
    title_touch: database.prepare('UPDATE title_snapshots SET updated_at = ? WHERE id = ?'),
    title_list: database.prepare('SELECT value, updated_at FROM title_snapshots WHERE id > ? ORDER BY id LIMIT ?'),
    artwork_title: database.prepare('UPDATE title_snapshots SET value = ? WHERE id = ?'),
    artwork_catalog: database.prepare('UPDATE catalog SET artwork = ? WHERE id = ?'),
    title_put: database.prepare(`INSERT INTO title_snapshots (id, value, updated_at, series_id, season, episode) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at,
      series_id = excluded.series_id, season = excluded.season, episode = excluded.episode`),
    genres_clear: database.prepare('DELETE FROM title_genres WHERE title_id = ?'),
    genre_put: database.prepare(`INSERT INTO title_genres (title_id, genre_id, label) VALUES (?, ?, ?)
      ON CONFLICT(title_id, genre_id) DO UPDATE SET label = excluded.label`),
    count: database.prepare(`SELECT COUNT(*) AS count FROM catalog WHERE ${BROWSABLE}`),
    episodes: database.prepare(`SELECT catalog.*, title_snapshots.updated_at, title_snapshots.season, title_snapshots.episode
      FROM catalog JOIN title_snapshots USING(id) WHERE catalog.kind = 'episode' AND title_snapshots.series_id = ?
      ORDER BY ${EPISODE_ORDER} LIMIT ? OFFSET ?`),
    navigation_current: database.prepare(`SELECT catalog.id, title_snapshots.series_id, title_snapshots.season, title_snapshots.episode
      FROM catalog JOIN title_snapshots USING(id) WHERE catalog.id = ? AND catalog.kind = 'episode'`),
    navigation_seasons: database.prepare(`SELECT DISTINCT title_snapshots.season AS season
      FROM catalog JOIN title_snapshots USING(id)
      WHERE catalog.kind = 'episode' AND title_snapshots.series_id = ? AND title_snapshots.season IS NOT NULL AND title_snapshots.episode IS NOT NULL
      ORDER BY title_snapshots.season`),
    navigation_page: database.prepare(`SELECT catalog.*, title_snapshots.updated_at, title_snapshots.season, title_snapshots.episode
      FROM catalog JOIN title_snapshots USING(id)
      WHERE catalog.kind = 'episode' AND title_snapshots.series_id = ? AND title_snapshots.season = ? AND title_snapshots.episode IS NOT NULL
      ORDER BY ${EPISODE_RANK} LIMIT ? OFFSET ?`),
    navigation_rank: database.prepare(`SELECT COUNT(*) AS count
      FROM catalog JOIN title_snapshots USING(id)
      WHERE catalog.kind = 'episode' AND title_snapshots.series_id = ? AND title_snapshots.season = ? AND title_snapshots.episode IS NOT NULL
        AND (${EPISODE_RANK}) <= ${RANK_PARAMETERS}`),
    navigation_previous: database.prepare(`SELECT catalog.*, title_snapshots.updated_at, title_snapshots.season, title_snapshots.episode
      FROM catalog JOIN title_snapshots USING(id)
      WHERE catalog.kind = 'episode' AND title_snapshots.series_id = ?
        AND title_snapshots.season IS NOT NULL AND title_snapshots.episode IS NOT NULL
        AND (${EPISODE_RANK}) < ${RANK_PARAMETERS}
      ORDER BY ${EPISODE_RANK_DESC} LIMIT 1`),
    navigation_next: database.prepare(`SELECT catalog.*, title_snapshots.updated_at, title_snapshots.season, title_snapshots.episode
      FROM catalog JOIN title_snapshots USING(id)
      WHERE catalog.kind = 'episode' AND title_snapshots.series_id = ?
        AND title_snapshots.season IS NOT NULL AND title_snapshots.episode IS NOT NULL
        AND (${EPISODE_RANK}) > ${RANK_PARAMETERS}
      ORDER BY ${EPISODE_RANK} LIMIT 1`),
  };
  const statements = new Map<string, StatementSync>();
  const facets = new Map<string, GenreSource[]>();
  let count: number | undefined;

  function prepared(sql: string): StatementSync {
    const statement = statements.get(sql) ?? database.prepare(sql);
    statements.set(sql, statement);
    return statement;
  }

  function put_entry(title: Title): void {
    queries.put.run(title.id, title.title, title.year, title.artwork, JSON.stringify(title.genres), title.kind,
      Number(title.anime), title.title.toLowerCase(), title.imdb_rating ?? null, title.popularity ?? null);
  }

  function put_snapshot(title: Title, value: string, updated_at: number): void {
    queries.title_put.run(title.id, value, updated_at, title.series?.id ?? null, title.season, title.episode);
  }

  function freshness(rows: readonly PageRow[]): Freshness {
    if (rows.length === 0) return { updated_at: '', stale: false };
    const updated_at = Math.min(...rows.map(row => row.updated_at));
    const age = Date.now() - updated_at;
    return { updated_at: updated_at ? new Date(updated_at).toISOString() : '',
      stale: updated_at === 0 || age < 0 || age >= settings_get().metadata_hours * 60 * 60 * 1000 };
  }

  return {
    catalog_get(id) {
      validate_id(id);
      const row = queries.get.get(id) as CatalogRow | undefined;
      return row ? catalog_entry(row) : null;
    },
    title_put(items) {
      const updated_at = Date.now();
      transaction(() => {
        for (const item of items) {
          const incoming = item.title;
          validate_id(incoming.id);
          if (incoming.series) validate_id(incoming.series.id);
          for (const entry of incoming.related) validate_id(entry.id);
          const previous = queries.title_get.get(incoming.id) as SnapshotRow | undefined;
          const title = previous ? keep_artwork(incoming, JSON.parse(previous.value) as Title) : incoming;
          const value = JSON.stringify(title);
          if (value === previous?.value) {
            queries.title_touch.run(updated_at, title.id);
            continue;
          }
          put_entry(title);
          put_snapshot(title, value, updated_at);
          queries.genres_clear.run(title.id);
          for (const genre of item.genres) {
            validate_genre(genre.id);
            queries.genre_put.run(title.id, genre.id, genre.label);
          }
          facets.clear();
          count = undefined;
        }
      });
    },
    title_get(id): CacheRecord<Title> | null {
      validate_id(id);
      const snapshot = queries.title_get.get(id) as SnapshotRow | undefined;
      return snapshot ? { value: JSON.parse(snapshot.value) as Title, updated_at: snapshot.updated_at } : null;
    },
    title_list(after_id, limit) {
      if (after_id) validate_id(after_id);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError('Invalid title batch size');
      return (queries.title_list.all(after_id, limit) as SnapshotRow[]).map(row => JSON.parse(row.value) as Title);
    },
    artwork_update(id, artwork) {
      validate_id(id);
      return transaction(() => {
        const row = queries.title_get.get(id) as SnapshotRow | undefined;
        if (!row) return null;
        const title = { ...JSON.parse(row.value) as Title, ...artwork };
        queries.artwork_title.run(JSON.stringify(title), id);
        queries.artwork_catalog.run(title.artwork, id);
        return title;
      });
    },
    catalog_query(query, hide) {
      const offset = page_offset(query.page);
      const conditions = [BROWSABLE];
      const parameters: SQLInputValue[] = [];
      if (query.kind === 'anime') conditions.push('catalog.anime = 1');
      else if (query.kind !== 'all') {
        conditions.push('catalog.kind = ?');
        parameters.push(query.kind);
      }
      if (query.query) {
        conditions.push("catalog.search LIKE ? ESCAPE '\\'");
        parameters.push(`%${query.query.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`);
      }
      const facet = `${query.kind}\n${query.query}`;
      const sources = facets.get(facet) ?? prepared(`SELECT genre_id AS id, MIN(label) AS label FROM title_genres
        JOIN catalog ON catalog.id = title_genres.title_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY genre_id`).all(...parameters) as GenreSource[];
      facets.set(facet, sources);
      const genres = genre_options(sources).sort((left, right) => left.label.localeCompare(right.label, 'en', { sensitivity: 'base' }));
      if (query.genre) {
        validate_genre(query.genre);
        const ids = genre_sources(query.genre);
        conditions.push(`EXISTS (SELECT 1 FROM title_genres WHERE title_id = catalog.id AND genre_id IN (${ids.map(() => '?').join(', ')}))`);
        parameters.push(...ids);
      }
      if (hide) {
        const hidden = hidden_condition(hide);
        conditions.push(hidden.sql);
        parameters.push(...hidden.parameters);
      }
      const order = catalog_order(query);
      const rows = prepared(`SELECT catalog.*, title_snapshots.updated_at
        FROM (SELECT id FROM catalog WHERE ${conditions.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?) AS selected
        JOIN catalog USING(id) JOIN title_snapshots USING(id)
        ORDER BY ${order}`).all(...parameters, PAGE_SIZE + 1, offset) as PageRow[];
      const page = rows.slice(0, PAGE_SIZE);
      return { items: page.map(catalog_entry), page: query.page, has_next: rows.length > PAGE_SIZE,
        genres, freshness: freshness(page) };
    },
    episodes_query(id, page) {
      validate_id(id);
      const rows = queries.episodes.all(id, PAGE_SIZE + 1, page_offset(page)) as EpisodeRow[];
      const items = rows.slice(0, PAGE_SIZE);
      return { items: items.map(episode_entry), page, has_next: rows.length > PAGE_SIZE, freshness: freshness(items) };
    },
    episode_navigation(id, season, page): EpisodeNavigation | null {
      validate_id(id);
      if (season !== undefined) validate_season(season);

      const current = queries.navigation_current.get(id) as CurrentEpisodeRow | undefined;
      if (!current || !current.series_id || current.season === null || current.episode === null) return null;

      const rank = [current.season, current.episode, current.id] as const;
      const selected_season = season ?? current.season;
      let selected_page = page ?? 1;
      if (page === undefined && selected_season === current.season) {
        const position = queries.navigation_rank.get(current.series_id, selected_season, ...rank) as { count: number };
        selected_page = Math.ceil(position.count / PAGE_SIZE);
      }
      const rows = queries.navigation_page.all(current.series_id, selected_season, PAGE_SIZE + 1, page_offset(selected_page)) as EpisodeRow[];
      const items = rows.slice(0, PAGE_SIZE);
      const previous = queries.navigation_previous.get(current.series_id, ...rank) as EpisodeRow | undefined;
      const next = queries.navigation_next.get(current.series_id, ...rank) as EpisodeRow | undefined;
      const seasons = (queries.navigation_seasons.all(current.series_id) as { season: number }[]).map(row => row.season);

      return { items: items.map(episode_entry), page: selected_page, has_next: rows.length > PAGE_SIZE,
        freshness: freshness(items), season: selected_season, seasons,
        previous: previous ? episode_entry(previous) : null, next: next ? episode_entry(next) : null };
    },
    catalog_count() { return count ??= (queries.count.get() as { count: number }).count; },
  };
}
