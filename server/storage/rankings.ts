import type { DatabaseSync } from 'node:sqlite';
import type { CatalogKind } from '../../src/catalog/types.ts';
import type { RankingTier, Rankings, Rating } from '../../src/library/types.ts';
import { KINDS } from './catalog.ts';
import { library_item, RANKING_ORDER, type LibraryRow, type SeriesProgressReader } from './library.ts';

export function create_rankings(
  database: DatabaseSync,
  transaction: <T>(operation: () => T) => T,
  series_progress: SeriesProgressReader,
) {
  const queries = {
    rating: database.prepare('SELECT rating FROM library_titles WHERE profile_id = ? AND id = ?'),
    tier: database.prepare(`SELECT id FROM library_titles WHERE profile_id = ? AND rating = ? AND id <> ? ORDER BY ${RANKING_ORDER}`),
    put: database.prepare(`INSERT INTO ranking_positions (profile_id, id, position) VALUES (?, ?, ?)
      ON CONFLICT(profile_id, id) DO UPDATE SET position = excluded.position`),
    delete: database.prepare('DELETE FROM ranking_positions WHERE profile_id = ? AND id = ?'),
  };

  function tier(profile: number, rating: Rating, except: string): string[] {
    return (queries.tier.all(profile, rating, except) as { id: string }[]).map(row => row.id);
  }

  function write(profile: number, ids: readonly string[]): void {
    ids.forEach((id, index) => queries.put.run(profile, id, index + 1));
  }

  function rankings_get(profile: number, kind: CatalogKind): Rankings {
    const rows = database.prepare(`SELECT * FROM library_titles WHERE profile_id = ? AND rating IS NOT NULL AND ${KINDS[kind]} ORDER BY ${RANKING_ORDER}`)
      .all(profile) as (LibraryRow & { rating: Rating })[];
    const tiers: RankingTier[] = [];
    let current: RankingTier | undefined;
    for (const [index, row] of rows.entries()) {
      if (current?.rating !== row.rating) {
        current = { rating: row.rating, items: [] };
        tiers.push(current);
      }
      current.items.push({ ...library_item(row, series_progress), rank: index + 1, position: current.items.length + 1 });
    }
    return { kind, tiers };
  }

  return {
    rankings_get,
    rating_changed(profile: number, id: string, previous: Rating | null, rating: Rating | null): void {
      if (rating === null) {
        queries.delete.run(profile, id);
        return;
      }
      const others = tier(profile, rating, id);
      write(profile, previous !== null && rating < previous ? [id, ...others] : [...others, id]);
    },
    ranking_move(profile: number, id: string, before: string | null, kind: CatalogKind): Rankings {
      transaction(() => {
        const rating = (queries.rating.get(profile, id) as { rating: Rating | null } | undefined)?.rating;
        if (!rating) throw new RangeError('Only rated movies and series can be ranked.');
        const ids = tier(profile, rating, id);
        const index = before === null ? ids.length : ids.indexOf(before);
        if (index < 0) throw new RangeError('Titles can only be moved within their rating tier.');
        ids.splice(index, 0, id);
        write(profile, ids);
      });
      return rankings_get(profile, kind);
    },
  };
}
