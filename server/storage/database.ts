import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { add_avatar_seeds, AVATAR_TABLES } from './avatars.ts';
import { ACCESS_TABLES, migrate_to_admins } from './access_schema.ts';
import { dev_pin_file } from './paths.ts';
import { migrate_to_profiles, PROFILE_TABLES } from './profile_schema.ts';

export const TOP_RATED_ORDER = '(imdb_rating IS NOT NULL AND COALESCE(popularity, 0) >= 0.2) DESC, imdb_rating DESC, year DESC, title COLLATE NOCASE, id';

const CATALOG_RANKINGS = { imdb_rating: 'REAL', popularity: 'REAL', trending_rank: 'INTEGER', anime_rank: 'INTEGER' };
const BROWSE_ORDER = 'year DESC, title COLLATE NOCASE, id';

function add_catalog_rankings(database: DatabaseSync): void {
  const columns = new Set((database.prepare('PRAGMA table_info(catalog)').all() as { name: string }[]).map(column => column.name));
  const missing = Object.entries(CATALOG_RANKINGS).filter(([name]) => !columns.has(name));
  if (!missing.length) return;
  database.exec(`BEGIN IMMEDIATE;
    ${missing.map(([name, type]) => `ALTER TABLE catalog ADD COLUMN ${name} ${type};`).join(' ')}
    COMMIT;`);
}

function add_catalog_search(database: DatabaseSync): void {
  const columns = database.prepare('PRAGMA table_info(catalog)').all() as { name: string }[];
  if (columns.some(column => column.name === 'search')) return;
  database.function('lowercase', { deterministic: true }, value => String(value).toLowerCase());
  database.exec(`BEGIN IMMEDIATE;
    ALTER TABLE catalog ADD COLUMN search TEXT NOT NULL DEFAULT '';
    UPDATE catalog SET search = lowercase(title);
    COMMIT;`);
}

export function open_database(directory: string): DatabaseSync {
  mkdirSync(directory, { recursive: true });
  const database = new DatabaseSync(resolve(directory, 'streamit.sqlite'));
  try {
    database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS metadata_cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS catalog (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        year INTEGER,
        artwork TEXT NOT NULL,
        genres TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('movie', 'series', 'episode')),
        anime INTEGER NOT NULL CHECK (anime IN (0, 1)),
        search TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS title_snapshots (
        id TEXT PRIMARY KEY REFERENCES catalog(id),
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        series_id TEXT,
        season INTEGER,
        episode INTEGER
      );
      CREATE TABLE IF NOT EXISTS title_genres (
        title_id TEXT NOT NULL REFERENCES catalog(id),
        genre_id TEXT NOT NULL,
        label TEXT NOT NULL,
        PRIMARY KEY (title_id, genre_id)
      );
      DROP INDEX IF EXISTS catalog_title;
      DROP INDEX IF EXISTS catalog_year;
      DROP INDEX IF EXISTS catalog_kind;
      CREATE INDEX IF NOT EXISTS catalog_browse_year ON catalog(year DESC, title COLLATE NOCASE, id) WHERE kind <> 'episode';
      CREATE INDEX IF NOT EXISTS catalog_browse_title ON catalog(title COLLATE NOCASE, id) WHERE kind <> 'episode';
      CREATE INDEX IF NOT EXISTS catalog_kind_year ON catalog(kind, year DESC, title COLLATE NOCASE, id);
      CREATE INDEX IF NOT EXISTS catalog_kind_title ON catalog(kind, title COLLATE NOCASE, id);
      CREATE INDEX IF NOT EXISTS catalog_anime_year ON catalog(anime, year DESC, title COLLATE NOCASE, id) WHERE kind <> 'episode';
      CREATE INDEX IF NOT EXISTS catalog_anime_title ON catalog(anime, title COLLATE NOCASE, id) WHERE kind <> 'episode';
      CREATE INDEX IF NOT EXISTS title_genres_genre ON title_genres(genre_id, title_id);
      CREATE INDEX IF NOT EXISTS title_snapshots_series ON title_snapshots(series_id, season, episode, id);
      ${PROFILE_TABLES}
      ${ACCESS_TABLES}
      ${AVATAR_TABLES}
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value REAL NOT NULL
      );
      CREATE TABLE IF NOT EXISTS images (
        key TEXT PRIMARY KEY,
        source_url TEXT NOT NULL,
        content_type TEXT,
        bytes INTEGER NOT NULL CHECK (bytes >= 0),
        fetched_at INTEGER,
        accessed_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS images_access ON images(accessed_at);
      CREATE INDEX IF NOT EXISTS images_lru ON images(accessed_at, key) WHERE fetched_at IS NOT NULL AND bytes > 0;
    `);
    add_catalog_search(database);
    add_catalog_rankings(database);
    migrate_to_profiles(database);
    migrate_to_admins(database, dev_pin_file());
    add_avatar_seeds(database);
    database.exec(`BEGIN IMMEDIATE;
      CREATE INDEX IF NOT EXISTS catalog_top_rated ON catalog(${TOP_RATED_ORDER}) WHERE kind <> 'episode';
      CREATE INDEX IF NOT EXISTS catalog_kind_top_rated ON catalog(kind, ${TOP_RATED_ORDER});
      CREATE INDEX IF NOT EXISTS catalog_anime_top_rated ON catalog(anime, ${TOP_RATED_ORDER}) WHERE kind <> 'episode';
      CREATE INDEX IF NOT EXISTS catalog_browse_trending ON catalog(trending_rank, ${BROWSE_ORDER}) WHERE kind <> 'episode';
      CREATE INDEX IF NOT EXISTS catalog_kind_trending ON catalog(kind, trending_rank, ${BROWSE_ORDER});
      CREATE INDEX IF NOT EXISTS catalog_anime_trending ON catalog(anime, anime_rank, ${BROWSE_ORDER}) WHERE kind <> 'episode';
      CREATE TABLE IF NOT EXISTS trending (
        kind TEXT NOT NULL CHECK (kind IN ('movie', 'series', 'anime')),
        day TEXT NOT NULL,
        rank INTEGER NOT NULL CHECK (rank >= 1),
        id TEXT NOT NULL REFERENCES catalog(id),
        PRIMARY KEY (kind, day, rank)
      );
      CREATE INDEX IF NOT EXISTS trending_title ON trending(id, kind, day);
      DROP VIEW IF EXISTS library_titles;
      DROP VIEW IF EXISTS library_entries;
      CREATE VIEW library_entries AS
        SELECT personal.profile_id, personal.id, personal.rating, personal.saved, personal.last_opened_at,
          COALESCE(personal_favorites.favorite, 0) AS favorite,
          personal_recommended.id IS NOT NULL AS recommended,
          CASE WHEN personal_status.id IS NULL THEN CASE WHEN personal.watched = 1 THEN 'watched' END ELSE personal_status.status END AS status
        FROM personal
        LEFT JOIN personal_status ON personal_status.profile_id = personal.profile_id AND personal_status.id = personal.id
        LEFT JOIN personal_favorites ON personal_favorites.profile_id = personal.profile_id AND personal_favorites.id = personal.id
        LEFT JOIN personal_recommended ON personal_recommended.profile_id = personal.profile_id AND personal_recommended.id = personal.id;
      CREATE VIEW library_titles AS
        WITH opened AS (
          SELECT personal.profile_id, COALESCE(title_snapshots.series_id, personal.id) AS id, MAX(personal.last_opened_at) AS opened_at
          FROM personal JOIN title_snapshots USING(id)
          WHERE personal.last_opened_at IS NOT NULL
          GROUP BY 1, 2
        ), titles AS (SELECT profile_id, id FROM library_entries UNION SELECT profile_id, id FROM opened)
        SELECT titles.profile_id, catalog.*, library_entries.rating, library_entries.status, COALESCE(library_entries.favorite, 0) AS favorite,
          COALESCE(library_entries.recommended, 0) AS recommended,
          COALESCE(library_entries.saved, 0) AS saved, library_entries.last_opened_at, opened.opened_at, ranking_positions.position
        FROM titles
        JOIN catalog ON catalog.id = titles.id
        LEFT JOIN library_entries ON library_entries.profile_id = titles.profile_id AND library_entries.id = titles.id
        LEFT JOIN opened ON opened.profile_id = titles.profile_id AND opened.id = titles.id
        LEFT JOIN ranking_positions ON ranking_positions.profile_id = titles.profile_id AND ranking_positions.id = titles.id
        WHERE catalog.kind <> 'episode';
      COMMIT;`);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}
