import type { DatabaseSync } from 'node:sqlite';
import type { PlaybackPreference } from '../../src/library/types.ts';
import { validate_id, validate_source } from './validation.ts';

function preference_id(id: string): string {
  return id.replace(/:.*$/, '');
}

export function create_playback(database: DatabaseSync) {
  const queries = {
    get: database.prepare('SELECT source FROM playback_sources WHERE profile_id = ? AND id = ?'),
    put: database.prepare(`INSERT INTO playback_sources (profile_id, id, source) VALUES (?, ?, ?)
      ON CONFLICT(profile_id, id) DO UPDATE SET source = excluded.source`),
    delete: database.prepare('DELETE FROM playback_sources WHERE profile_id = ? AND id = ?'),
  };

  return {
    playback_source(profile: number, id: string): string | null {
      validate_id(id);
      return (queries.get.get(profile, preference_id(id)) as { source: string } | undefined)?.source ?? null;
    },
    playback_update(profile: number, id: string, source: string | null): PlaybackPreference {
      validate_id(id);
      const target = preference_id(id);
      if (source === null) queries.delete.run(profile, target);
      else {
        validate_source(source);
        queries.put.run(profile, target, source);
      }
      return { id: target, source };
    },
  };
}
