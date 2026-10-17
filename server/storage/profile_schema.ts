import type { DatabaseSync } from 'node:sqlite';

const PROFILE = 'profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE';
const RATING = 'rating * 2 = CAST(rating * 2 AS INTEGER)';

export const PROFILE_TABLES = `
  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS personal (
    ${PROFILE},
    id TEXT NOT NULL REFERENCES catalog(id),
    rating REAL CHECK (rating IS NULL OR (rating BETWEEN 0.5 AND 5 AND ${RATING})),
    watched INTEGER NOT NULL DEFAULT 0 CHECK (watched IN (0, 1)),
    saved INTEGER NOT NULL DEFAULT 0 CHECK (saved IN (0, 1)),
    last_opened_at TEXT,
    PRIMARY KEY (profile_id, id)
  );
  CREATE TABLE IF NOT EXISTS personal_status (
    ${PROFILE},
    id TEXT NOT NULL,
    status TEXT CHECK (status IS NULL OR status IN ('want', 'watching', 'paused', 'watched', 'dropped')),
    PRIMARY KEY (profile_id, id),
    FOREIGN KEY (profile_id, id) REFERENCES personal(profile_id, id)
  );
  CREATE TABLE IF NOT EXISTS personal_favorites (
    ${PROFILE},
    id TEXT NOT NULL,
    favorite INTEGER NOT NULL CHECK (favorite IN (0, 1)),
    PRIMARY KEY (profile_id, id),
    FOREIGN KEY (profile_id, id) REFERENCES personal(profile_id, id)
  );
  CREATE TABLE IF NOT EXISTS personal_recommended (
    ${PROFILE},
    id TEXT NOT NULL,
    PRIMARY KEY (profile_id, id),
    FOREIGN KEY (profile_id, id) REFERENCES personal(profile_id, id)
  );
  CREATE TABLE IF NOT EXISTS season_ratings (
    ${PROFILE},
    series_id TEXT NOT NULL REFERENCES catalog(id),
    season INTEGER NOT NULL CHECK (season BETWEEN 0 AND 99999),
    rating REAL NOT NULL CHECK (rating BETWEEN 0.5 AND 5 AND ${RATING}),
    PRIMARY KEY (profile_id, series_id, season)
  );
  CREATE TABLE IF NOT EXISTS ranking_positions (
    ${PROFILE},
    id TEXT NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY (profile_id, id),
    FOREIGN KEY (profile_id, id) REFERENCES personal(profile_id, id)
  );
  CREATE TABLE IF NOT EXISTS playback_sources (
    ${PROFILE},
    id TEXT NOT NULL REFERENCES catalog(id),
    source TEXT NOT NULL,
    PRIMARY KEY (profile_id, id)
  );
`;

const COLUMNS = {
  personal: 'id, rating, watched, saved, last_opened_at',
  personal_status: 'id, status',
  personal_favorites: 'id, favorite',
  personal_recommended: 'id',
  season_ratings: 'series_id, season, rating',
  ranking_positions: 'id, position',
  playback_sources: 'id, source',
};

function has_profiles(database: DatabaseSync): boolean {
  const columns = database.prepare('PRAGMA table_info(personal)').all() as { name: string }[];
  return columns.some(column => column.name === 'profile_id');
}

function copy_to_profiles(database: DatabaseSync): void {
  const tables = Object.entries(COLUMNS);
  database.exec(`DROP VIEW IF EXISTS library_titles;
    DROP VIEW IF EXISTS library_entries;
    ${tables.map(([table]) => `ALTER TABLE ${table} RENAME TO legacy_${table};`).join('\n')}
    ${PROFILE_TABLES}`);
  const created_at = new Date().toISOString();
  const insert = database.prepare('INSERT INTO profiles (name, created_at) VALUES (?, ?)');
  const dry = insert.run('dry', created_at).lastInsertRowid;
  insert.run('dev', created_at);
  for (const [table, columns] of tables) {
    database.prepare(`INSERT INTO ${table} (profile_id, ${columns}) SELECT ?, ${columns} FROM legacy_${table}`).run(dry);
    database.exec(`DROP TABLE legacy_${table}`);
  }
  if (database.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Profile migration broke a foreign key.');
}

export function migrate_to_profiles(database: DatabaseSync): void {
  if (has_profiles(database)) return;
  database.exec('PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE');
  try {
    copy_to_profiles(database);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  } finally {
    database.exec('PRAGMA foreign_keys = ON');
  }
}
