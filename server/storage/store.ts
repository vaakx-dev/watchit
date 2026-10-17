import type { CacheSettings } from '../../src/cache/types.ts';
import type { LibrarySnapshot, Rating, Status } from '../../src/library/types.ts';
import { DEFAULTS } from '../../src/cache/policy.ts';
import { catalog_entry, create_catalog, type CatalogRow } from './catalog.ts';
import { data_directory, image_path } from './paths.ts';
import { open_database } from './database.ts';
import { create_library } from './library.ts';
import { create_pins } from './pins.ts';
import { create_playback } from './playback.ts';
import { create_profiles } from './profiles.ts';
import { create_avatars } from './avatars.ts';
import { create_progress } from './progress.ts';
import { create_rankings } from './rankings.ts';
import { create_related } from './related.ts';
import { create_sessions } from './sessions.ts';
import { create_trending } from './trending.ts';
import { validate_id, validate_personal, validate_rating, validate_season, validate_series_id, validate_settings } from './validation.ts';
import type { ImageRecord, Store } from './types.ts';

type PersonalRow = {
  id: string;
  rating: Rating | null;
  watched: number;
  saved: number;
  last_opened_at: string | null;
  status_id: string | null;
  status: Status | null;
  favorite: number | null;
  recommended: number;
};
type SeasonRatingRow = { series_id: string; season: number; rating: Rating };
const SEASON_EPISODES = `(SELECT catalog.id FROM catalog JOIN title_snapshots USING(id)
  WHERE catalog.kind = 'episode' AND title_snapshots.series_id = ? AND title_snapshots.season = ?)`;

export function create_store(directory?: string): Store {
  const location = data_directory(directory);
  const database = open_database(location);
  const queries = {
    cache_get: database.prepare('SELECT value, updated_at FROM metadata_cache WHERE key = ?'),
    cache_set: database.prepare('INSERT INTO metadata_cache (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'),
    catalog_get: database.prepare('SELECT * FROM catalog WHERE id = ?'),
    personal_get: database.prepare('SELECT id, rating, watched, saved, last_opened_at FROM personal WHERE profile_id = ? AND id = ?'),
    personal_put: database.prepare(`INSERT INTO personal (profile_id, id, rating, watched, saved, last_opened_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(profile_id, id) DO UPDATE SET rating = excluded.rating, watched = excluded.watched, saved = excluded.saved,
      last_opened_at = excluded.last_opened_at`),
    personal_status_put: database.prepare(`INSERT INTO personal_status (profile_id, id, status) VALUES (?, ?, ?)
      ON CONFLICT(profile_id, id) DO UPDATE SET status = excluded.status`),
    personal_favorite_put: database.prepare(`INSERT INTO personal_favorites (profile_id, id, favorite) VALUES (?, ?, ?)
      ON CONFLICT(profile_id, id) DO UPDATE SET favorite = excluded.favorite`),
    personal_favorite_delete: database.prepare('DELETE FROM personal_favorites WHERE profile_id = ? AND id = ?'),
    personal_recommended_put: database.prepare('INSERT INTO personal_recommended (profile_id, id) VALUES (?, ?) ON CONFLICT DO NOTHING'),
    personal_recommended_delete: database.prepare('DELETE FROM personal_recommended WHERE profile_id = ? AND id = ?'),
    personal_list: database.prepare(`SELECT personal.id, personal.rating, personal.watched, personal.saved, personal.last_opened_at,
      personal_status.id AS status_id, personal_status.status, personal_favorites.favorite,
      personal_recommended.id IS NOT NULL AS recommended
      FROM personal
      LEFT JOIN personal_status ON personal_status.profile_id = personal.profile_id AND personal_status.id = personal.id
      LEFT JOIN personal_favorites ON personal_favorites.profile_id = personal.profile_id AND personal_favorites.id = personal.id
      LEFT JOIN personal_recommended ON personal_recommended.profile_id = personal.profile_id AND personal_recommended.id = personal.id
      WHERE personal.profile_id = ?
      ORDER BY personal.id`),
    saved: database.prepare(`SELECT catalog.* FROM catalog JOIN personal USING(id)
      WHERE personal.profile_id = ? AND personal.saved = 1 ORDER BY catalog.title COLLATE NOCASE, catalog.id`),
    recent: database.prepare(`SELECT catalog.* FROM catalog JOIN personal USING(id)
      WHERE personal.profile_id = ? AND personal.last_opened_at IS NOT NULL ORDER BY personal.last_opened_at DESC, catalog.id LIMIT 24`),
    season_list: database.prepare('SELECT series_id, season, rating FROM season_ratings WHERE profile_id = ? ORDER BY series_id, season'),
    season_put: database.prepare(`INSERT INTO season_ratings (profile_id, series_id, season, rating) VALUES (?, ?, ?, ?)
      ON CONFLICT(profile_id, series_id, season) DO UPDATE SET rating = excluded.rating`),
    season_delete: database.prepare('DELETE FROM season_ratings WHERE profile_id = ? AND series_id = ? AND season = ?'),
    season_personal_put: database.prepare(`INSERT INTO personal (profile_id, id) SELECT ?, id FROM ${SEASON_EPISODES} WHERE true ON CONFLICT DO NOTHING`),
    season_watch: database.prepare(`INSERT INTO personal_status (profile_id, id, status) SELECT ?, id, 'watched' FROM ${SEASON_EPISODES} WHERE true
      ON CONFLICT(profile_id, id) DO UPDATE SET status = excluded.status`),
    season_unwatch: database.prepare(`INSERT INTO personal_status (profile_id, id, status)
      SELECT profile_id, id, NULL FROM library_entries WHERE profile_id = ? AND status = 'watched' AND id IN (SELECT id FROM ${SEASON_EPISODES})
      ON CONFLICT(profile_id, id) DO UPDATE SET status = excluded.status`),
    settings_get: database.prepare('SELECT key, value FROM settings'),
    settings_put: database.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
    metadata_count: database.prepare("SELECT COUNT(*) AS count FROM metadata_cache WHERE key NOT LIKE 'attribution:%'"),
    cached_images: database.prepare('SELECT COUNT(*) AS image_count, COALESCE(SUM(bytes), 0) AS image_bytes FROM images WHERE fetched_at IS NOT NULL AND bytes > 0'),
    image_get: database.prepare('SELECT * FROM images WHERE key = ?'),
    image_put: database.prepare(`INSERT INTO images (key, source_url, content_type, bytes, fetched_at, accessed_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET source_url = excluded.source_url, content_type = excluded.content_type,
      bytes = excluded.bytes, fetched_at = excluded.fetched_at, accessed_at = excluded.accessed_at`),
    image_bytes: database.prepare('SELECT COALESCE(SUM(bytes), 0) AS bytes FROM images WHERE fetched_at IS NOT NULL AND bytes > 0'),
    image_lru: database.prepare('SELECT * FROM images WHERE fetched_at IS NOT NULL AND bytes > 0 ORDER BY accessed_at, key LIMIT ?'),
    image_unencoded: database.prepare("SELECT * FROM images WHERE key > ? AND fetched_at IS NOT NULL AND bytes > 0 AND content_type <> 'image/webp' ORDER BY key LIMIT ?"),
    image_clear: database.prepare('UPDATE images SET content_type = NULL, bytes = 0, fetched_at = NULL WHERE key = ?'),
    image_list: database.prepare('SELECT * FROM images ORDER BY accessed_at, key'),
    image_delete: database.prepare('DELETE FROM images WHERE key = ?'),
  };

  function transaction<T>(operation: () => T): T {
    database.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      database.exec('COMMIT');
      return result;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  const series_progress = create_progress(database);
  const rankings = create_rankings(database, transaction, series_progress);

  function library_get(profile: number): LibrarySnapshot {
    const entries: LibrarySnapshot['entries'] = {};
    for (const row of queries.personal_list.all(profile) as PersonalRow[]) {
      entries[row.id] = {
        id: row.id,
        rating: row.rating,
        status: row.status_id === null ? row.watched ? 'watched' : null : row.status,
        favorite: Boolean(row.favorite),
        recommended: Boolean(row.recommended),
        saved: Boolean(row.saved),
        last_opened_at: row.last_opened_at,
      };
    }

    const seasons: LibrarySnapshot['seasons'] = {};
    for (const row of queries.season_list.all(profile) as SeasonRatingRow[]) {
      const ratings = seasons[row.series_id] ??= {};
      ratings[row.season] = row.rating;
    }

    return {
      entries,
      seasons,
      saved: (queries.saved.all(profile) as CatalogRow[]).map(catalog_entry),
      recent: (queries.recent.all(profile) as CatalogRow[]).map(catalog_entry),
    };
  }

  function settings_get(): CacheSettings {
    const settings = { ...DEFAULTS };
    for (const row of queries.settings_get.all() as { key: keyof CacheSettings; value: number }[]) {
      if (Object.hasOwn(settings, row.key)) settings[row.key] = row.value;
    }
    return settings;
  }

  function image_list(): ImageRecord[] {
    return queries.image_list.all() as ImageRecord[];
  }

  return {
    directory: location,
    ...create_catalog(database, transaction, settings_get),
    ...create_trending(database, transaction),
    ...create_related(database),
    ...create_library(database, series_progress),
    ...create_playback(database),
    ...create_profiles(database, transaction),
    ...create_avatars(database),
    ...create_pins(database),
    ...create_sessions(database),
    series_progress,
    rankings_get: rankings.rankings_get,
    ranking_move: rankings.ranking_move,
    cache_get<T>(key: string) {
      const row = queries.cache_get.get(key) as { value: string; updated_at: number } | undefined;
      return row ? { value: JSON.parse(row.value) as T, updated_at: row.updated_at } : null;
    },
    cache_set(key, value) {
      const json = JSON.stringify(value);
      if (json === undefined) throw new RangeError('Cache value must be JSON');
      queries.cache_set.run(key, json, Date.now());
    },
    library_get,
    personal_update(profile, id, patch) {
      validate_id(id);
      validate_personal(patch);
      transaction(() => {
        const title = queries.catalog_get.get(id) as CatalogRow | undefined;
        if (!title) throw new Error('Catalog entry not found');
        const previous = queries.personal_get.get(profile, id) as Omit<PersonalRow, 'status_id' | 'status' | 'favorite' | 'recommended'> | undefined;
        queries.personal_put.run(
          profile,
          id,
          patch.rating !== undefined ? patch.rating : previous?.rating ?? null,
          previous?.watched ?? 0,
          patch.saved !== undefined ? Number(patch.saved) : previous?.saved ?? 0,
          patch.opened ? new Date().toISOString() : previous?.last_opened_at ?? null,
        );
        if (title.kind !== 'episode' && patch.rating !== undefined && patch.rating !== (previous?.rating ?? null)) {
          rankings.rating_changed(profile, id, previous?.rating ?? null, patch.rating);
        }
        if (patch.status !== undefined) queries.personal_status_put.run(profile, id, patch.status);
        if (patch.favorite !== undefined) {
          if (patch.favorite) queries.personal_favorite_put.run(profile, id, 1);
          else queries.personal_favorite_delete.run(profile, id);
        }
        if (patch.recommended !== undefined) {
          if (patch.recommended) queries.personal_recommended_put.run(profile, id);
          else queries.personal_recommended_delete.run(profile, id);
        }
      });
      return library_get(profile);
    },
    season_update(profile, series_id, season, rating) {
      validate_series_id(series_id);
      validate_season(season);
      validate_rating(rating);
      transaction(() => {
        const series = queries.catalog_get.get(series_id) as CatalogRow | undefined;
        if (!series || series.kind !== 'series') throw new Error('Series catalog entry not found');
        if (rating === null) queries.season_delete.run(profile, series_id, season);
        else queries.season_put.run(profile, series_id, season, rating);
      });
      return library_get(profile);
    },
    season_watched(profile, series_id, season, watched) {
      validate_series_id(series_id);
      validate_season(season);
      transaction(() => {
        const series = queries.catalog_get.get(series_id) as CatalogRow | undefined;
        if (!series || series.kind !== 'series') throw new Error('Series catalog entry not found');
        if (watched) {
          queries.season_personal_put.run(profile, series_id, season);
          queries.season_watch.run(profile, series_id, season);
        } else {
          queries.season_unwatch.run(profile, series_id, season);
        }
      });
      return { ...library_get(profile), progress: series_progress(profile, series_id) };
    },
    settings_get,
    settings_update(patch) {
      validate_settings(patch);
      transaction(() => {
        for (const [key, value] of Object.entries(patch)) queries.settings_put.run(key, value);
      });
      return settings_get();
    },
    status() {
      const images = queries.cached_images.get() as { image_count: number; image_bytes: number };
      return { settings: settings_get(), ...images, metadata_count: (queries.metadata_count.get() as { count: number }).count };
    },
    image_get(key) {
      return queries.image_get.get(key) as ImageRecord | undefined ?? null;
    },
    image_put(record) {
      image_path(location, record.key);
      queries.image_put.run(record.key, record.source_url, record.content_type, record.bytes, record.fetched_at, record.accessed_at);
    },
    image_bytes() { return (queries.image_bytes.get() as { bytes: number }).bytes; },
    image_lru(limit) { return queries.image_lru.all(limit) as ImageRecord[]; },
    image_unencoded(after_key, limit) { return queries.image_unencoded.all(after_key, limit) as ImageRecord[]; },
    image_clear(keys) {
      transaction(() => {
        for (const key of keys) queries.image_clear.run(key);
      });
    },
    image_list,
    image_delete(key) {
      queries.image_delete.run(key);
    },
    close() { database.close(); },
  };
}
