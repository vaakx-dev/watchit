import type { DatabaseSync } from 'node:sqlite';
import type { CatalogKind } from '../../src/catalog/types.ts';
import {
  SHELVES, STATUSES, type ContinuePage, type LibraryItem, type LibraryPage, type LibraryQuery, type LibrarySort,
  type Rating, type SeriesProgress, type Shelf, type Status,
} from '../../src/library/types.ts';
import { catalog_entry, KINDS, page_offset, PAGE_SIZE, type CatalogRow } from './catalog.ts';

export type SeriesProgressReader = (profile: number, series_id: string) => SeriesProgress;
export type LibraryRow = CatalogRow & {
  profile_id: number;
  rating: Rating | null;
  status: Status | null;
  favorite: number;
  recommended: number;
  saved: number;
  last_opened_at: string | null;
  opened_at: string | null;
};

export const RANKING_ORDER = 'rating DESC, position IS NULL, position, opened_at DESC, title COLLATE NOCASE, id';
const RECENT_ORDER = 'opened_at DESC, title COLLATE NOCASE, id';
const SHELF_CONDITIONS: Record<Shelf, string> = {
  ...Object.fromEntries(STATUSES.map(status => [status, `status = '${status}'`])) as Record<Status, string>,
  favorite: 'favorite = 1',
  recommended: 'recommended = 1',
  saved: 'saved = 1',
  recent: 'opened_at IS NOT NULL',
};
const ORDERS: Record<LibrarySort, string> = {
  recent: RECENT_ORDER,
  title: 'title COLLATE NOCASE, id',
  newest: 'year DESC, title COLLATE NOCASE, id',
  rating: RANKING_ORDER,
};

export function library_item(row: LibraryRow, series_progress: SeriesProgressReader): LibraryItem {
  return {
    title: catalog_entry(row),
    entry: { id: row.id, rating: row.rating, status: row.status, favorite: Boolean(row.favorite),
      recommended: Boolean(row.recommended), saved: Boolean(row.saved), last_opened_at: row.last_opened_at },
    opened_at: row.opened_at,
    progress: row.kind === 'series' ? series_progress(row.profile_id, row.id) : null,
  };
}

export function create_library(database: DatabaseSync, series_progress: SeriesProgressReader) {
  function page(profile: number, conditions: string, order: string, number: number) {
    const rows = database.prepare(`SELECT * FROM library_titles WHERE profile_id = ? AND ${conditions} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .all(profile, PAGE_SIZE + 1, page_offset(number)) as LibraryRow[];
    return { items: rows.slice(0, PAGE_SIZE).map(row => library_item(row, series_progress)), page: number, has_next: rows.length > PAGE_SIZE };
  }

  return {
    library_query(profile: number, query: LibraryQuery): LibraryPage {
      const counts = database.prepare(`SELECT ${SHELVES.map(shelf => `COUNT(*) FILTER (WHERE ${SHELF_CONDITIONS[shelf]}) AS "${shelf}"`).join(', ')}
        FROM library_titles WHERE profile_id = ? AND ${KINDS[query.kind]}`).get(profile) as Record<Shelf, number>;
      return { ...page(profile, `${SHELF_CONDITIONS[query.shelf]} AND ${KINDS[query.kind]}`, ORDERS[query.sort], query.page),
        total: counts[query.shelf], counts };
    },
    continue_query(profile: number, kind: CatalogKind, number: number): ContinuePage {
      return page(profile, `status IN ('watching', 'paused') AND ${KINDS[kind]}`, RECENT_ORDER, number);
    },
  };
}
