import type { DatabaseSync } from 'node:sqlite';
import type { TrendingKind, TrendingPage, TrendingQuery } from '../../src/catalog/types.ts';
import { catalog_entry, hidden_condition, KINDS, page_offset, PAGE_SIZE, trending_column, type CatalogRow } from './catalog.ts';
import type { Hidden } from './types.ts';
import { validate_id } from './validation.ts';

const HISTORY_DAYS = 30;
type TrendingRow = CatalogRow & { rank: number };

function iso_day(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

export function create_trending(database: DatabaseSync, transaction: <T>(operation: () => T) => T) {
  const queries = {
    history_clear: database.prepare('DELETE FROM trending WHERE kind = ? AND (day = ? OR day < ?)'),
    history_put: database.prepare('INSERT INTO trending (kind, day, rank, id) VALUES (?, ?, ?, ?)'),
    day: database.prepare('SELECT MAX(day) AS day FROM trending WHERE kind = ?'),
  };

  return {
    trending_put(kind: TrendingKind, ids: readonly string[]): void {
      const column = trending_column(kind);
      const clear = database.prepare(`UPDATE catalog SET ${column} = NULL WHERE ${column} IS NOT NULL AND ${KINDS[kind]}`);
      const rank = database.prepare(`UPDATE catalog SET ${column} = ? WHERE id = ?`);
      const now = Date.now();
      const day = iso_day(now);
      transaction(() => {
        queries.history_clear.run(kind, day, iso_day(now - HISTORY_DAYS * 24 * 3600000));
        clear.run();
        ids.forEach((id, index) => {
          validate_id(id);
          queries.history_put.run(kind, day, index + 1, id);
          rank.run(index + 1, id);
        });
      });
    },
    trending_query(query: Omit<TrendingQuery, 'hide'>, hide?: Hidden): TrendingPage {
      const column = trending_column(query.kind);
      const hidden = hide ? hidden_condition(hide) : { sql: '1', parameters: [] };
      const rows = database.prepare(`SELECT catalog.*, ${column} AS rank FROM catalog
        WHERE ${column} IS NOT NULL AND ${KINDS[query.kind]} AND ${hidden.sql}
        ORDER BY ${column}, kind DESC, id LIMIT ? OFFSET ?`)
        .all(...hidden.parameters, PAGE_SIZE + 1, page_offset(query.page)) as TrendingRow[];
      const kinds: TrendingKind[] = query.kind === 'all' ? ['movie', 'series'] : [query.kind];
      const days = kinds.map(kind => (queries.day.get(kind) as { day: string | null }).day).filter(day => day !== null);
      return { items: rows.slice(0, PAGE_SIZE).map(row => ({ ...catalog_entry(row), rank: row.rank })),
        page: query.page, has_next: rows.length > PAGE_SIZE, day: days.sort().at(-1) ?? null };
    },
  };
}
