import type { DatabaseSync } from 'node:sqlite';
import type { SeriesProgress } from '../../src/library/types.ts';
import { episode_entry, EPISODE_RANK, EPISODE_RANK_DESC, RANK_PARAMETERS, type EpisodeRow } from './catalog.ts';

const EPISODES = `SELECT catalog.*, title_snapshots.updated_at, title_snapshots.season, title_snapshots.episode
  FROM catalog JOIN title_snapshots USING(id)
  WHERE catalog.kind = 'episode' AND title_snapshots.series_id = ?
    AND title_snapshots.season IS NOT NULL AND title_snapshots.episode IS NOT NULL`;
type OpenedRow = EpisodeRow & { season: number; episode: number; opened_at: string };
type Position = { id: string; season: number; episode: number };

export function create_progress(database: DatabaseSync) {
  const queries = {
    last: database.prepare(`SELECT catalog.*, title_snapshots.updated_at, title_snapshots.season, title_snapshots.episode,
        personal.last_opened_at AS opened_at
      FROM personal JOIN title_snapshots USING(id) JOIN catalog USING(id)
      WHERE personal.profile_id = ? AND catalog.kind = 'episode' AND title_snapshots.series_id = ? AND personal.last_opened_at IS NOT NULL
        AND title_snapshots.season IS NOT NULL AND title_snapshots.episode IS NOT NULL
      ORDER BY personal.last_opened_at DESC LIMIT 1`),
    furthest: database.prepare(`SELECT catalog.id, title_snapshots.season, title_snapshots.episode
      FROM library_entries JOIN title_snapshots USING(id) JOIN catalog USING(id)
      WHERE library_entries.profile_id = ? AND catalog.kind = 'episode' AND title_snapshots.series_id = ?
        AND title_snapshots.season IS NOT NULL AND title_snapshots.episode IS NOT NULL
        AND (catalog.id = ? OR (library_entries.status = 'watched' AND title_snapshots.season > 0))
      ORDER BY ${EPISODE_RANK_DESC} LIMIT 1`),
    next: database.prepare(`${EPISODES} AND (${EPISODE_RANK}) > ${RANK_PARAMETERS} ORDER BY ${EPISODE_RANK} LIMIT 1`),
    first: database.prepare(`${EPISODES} ORDER BY title_snapshots.season = 0, ${EPISODE_RANK} LIMIT 1`),
  };

  return function series_progress(profile: number, series_id: string): SeriesProgress {
    const last = queries.last.get(profile, series_id) as OpenedRow | undefined;
    const furthest = queries.furthest.get(profile, series_id, last?.id ?? null) as Position | undefined;
    const next = (furthest ? queries.next.get(series_id, furthest.season, furthest.episode, furthest.id) : queries.first.get(series_id)) as EpisodeRow | undefined;
    return { last: last ? episode_entry(last) : null, next: next ? episode_entry(next) : null, opened_at: last?.opened_at ?? null };
  };
}
