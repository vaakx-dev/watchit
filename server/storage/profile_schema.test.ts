import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { create_store } from './index.ts';

const LEGACY_SCHEMA = `
  CREATE TABLE catalog (id TEXT PRIMARY KEY, title TEXT NOT NULL, year INTEGER, artwork TEXT NOT NULL, genres TEXT NOT NULL,
    kind TEXT NOT NULL, anime INTEGER NOT NULL, search TEXT NOT NULL DEFAULT '');
  CREATE TABLE title_snapshots (id TEXT PRIMARY KEY REFERENCES catalog(id), value TEXT NOT NULL, updated_at INTEGER NOT NULL,
    series_id TEXT, season INTEGER, episode INTEGER);
  CREATE TABLE personal (id TEXT PRIMARY KEY REFERENCES catalog(id), rating REAL, watched INTEGER NOT NULL DEFAULT 0,
    saved INTEGER NOT NULL DEFAULT 0, last_opened_at TEXT);
  CREATE TABLE personal_status (id TEXT PRIMARY KEY REFERENCES personal(id), status TEXT);
  CREATE TABLE personal_favorites (id TEXT PRIMARY KEY REFERENCES personal(id), favorite INTEGER NOT NULL);
  CREATE TABLE season_ratings (series_id TEXT NOT NULL REFERENCES catalog(id), season INTEGER NOT NULL, rating REAL NOT NULL,
    PRIMARY KEY (series_id, season));
  CREATE TABLE ranking_positions (id TEXT PRIMARY KEY REFERENCES personal(id), position INTEGER NOT NULL);
  CREATE TABLE playback_sources (id TEXT PRIMARY KEY REFERENCES catalog(id), source TEXT NOT NULL);
  CREATE VIEW library_entries AS SELECT id FROM personal;
  INSERT INTO catalog (id, title, year, artwork, genres, kind, anime) VALUES
    ('tt0000001', 'Movie', 2020, '', '[]', 'movie', 0), ('tt0000002', 'Series', 2021, '', '[]', 'series', 0);
  INSERT INTO title_snapshots (id, value, updated_at) VALUES ('tt0000001', '{}', 1), ('tt0000002', '{}', 1);
  INSERT INTO personal (id, rating, watched, saved, last_opened_at) VALUES
    ('tt0000001', 4.5, 0, 1, '2026-01-01T00:00:00.000Z'), ('tt0000002', 4.5, 1, 0, NULL);
  INSERT INTO personal_status (id, status) VALUES ('tt0000001', 'watching');
  INSERT INTO personal_favorites (id, favorite) VALUES ('tt0000002', 1);
  INSERT INTO season_ratings (series_id, season, rating) VALUES ('tt0000002', 1, 3);
  INSERT INTO ranking_positions (id, position) VALUES ('tt0000002', 1), ('tt0000001', 2);
  INSERT INTO playback_sources (id, source) VALUES ('tt0000002', 'vidsrc');
`;

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'streamit-profiles-migration-'));
  vi.stubEnv('STREAMIT_DEV_PIN_FILE', join(directory, 'dev-pin.txt'));
  const legacy = new DatabaseSync(join(directory, 'streamit.sqlite'));
  legacy.exec(LEGACY_SCHEMA);
  legacy.close();
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

describe('profile migration', () => {
  it('assigns every existing personal row to dry and creates an empty dev profile', () => {
    const store = create_store(directory);
    const [dry, dev] = store.profile_list();
    expect([dry, dev]).toMatchObject([{ name: 'dry', is_admin: true, has_pin: false }, { name: 'dev', is_admin: true, has_pin: true }]);
    const library = store.library_get(dry!.id);
    expect(library.entries).toMatchObject({
      tt0000001: { rating: 4.5, status: 'watching', saved: true, favorite: false, last_opened_at: '2026-01-01T00:00:00.000Z' },
      tt0000002: { rating: 4.5, status: 'watched', saved: false, favorite: true },
    });
    expect(library.seasons).toEqual({ tt0000002: { 1: 3 } });
    expect(store.rankings_get(dry!.id, 'all').tiers[0]?.items.map(item => item.title.id)).toEqual(['tt0000002', 'tt0000001']);
    expect(store.playback_source(dry!.id, 'tt0000002')).toBe('vidsrc');
    expect(store.library_get(dev!.id)).toEqual({ entries: {}, seasons: {}, saved: [], recent: [] });
    expect(store.playback_source(dev!.id, 'tt0000002')).toBeNull();
    store.close();
  });

  it('runs once and leaves no legacy tables or broken foreign keys', () => {
    create_store(directory).close();
    const store = create_store(directory);
    expect(store.profile_list().map(profile => profile.name)).toEqual(['dry', 'dev']);
    store.close();
    const database = new DatabaseSync(join(directory, 'streamit.sqlite'));
    expect(database.prepare("SELECT name FROM sqlite_schema WHERE name LIKE 'legacy_%'").all()).toEqual([]);
    expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    database.close();
  });
});
