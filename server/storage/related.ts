import type { DatabaseSync } from 'node:sqlite';
import { genre_id } from '../../src/catalog/identity.ts';
import type { CatalogEntry, Title } from '../../src/catalog/types.ts';
import { genre_labels, genre_sources } from '../catalog/genres.ts';
import { catalog_entry, type CatalogRow } from './catalog.ts';

const CANDIDATES = 400;
const SIMILAR = 12;
const SETTLED = ['watched', 'dropped'];
type CandidateRow = CatalogRow & { director: string | null; cast: string | null };

function people(...values: (string | null)[]): Set<string> {
  return new Set(values.flatMap(value => (value ?? '').split(',')).map(name => name.trim().toLowerCase()).filter(Boolean));
}

function overlap<T>(left: ReadonlySet<T>, right: Iterable<T>): number {
  let shared = 0;
  for (const value of right) if (left.has(value)) shared++;
  return shared;
}

function similarity(title: Title, genres: ReadonlySet<string>, crew: ReadonlySet<string>, row: CandidateRow, entry: CatalogEntry) {
  const shared_genres = overlap(genres, entry.genres);
  const shared_people = overlap(crew, people(row.director, row.cast));
  const years = title.year && entry.year ? Math.max(0, 1 - Math.abs(title.year - entry.year) / 25) : 0;
  return shared_genres * 2 + shared_people * 1.5 + years + (entry.imdb_rating ?? 5) / 5 + (entry.anime === title.anime ? 0.5 : 0);
}

export function create_related(database: DatabaseSync) {
  const settled = database.prepare(`SELECT id FROM library_entries WHERE profile_id = ? AND status IN (${SETTLED.map(() => '?').join(', ')})`);

  return {
    catalog_entries(ids: readonly string[]): CatalogEntry[] {
      if (!ids.length) return [];
      const rows = database.prepare(`SELECT * FROM catalog WHERE id IN (${ids.map(() => '?').join(', ')})`).all(...ids) as CatalogRow[];
      return rows.map(catalog_entry);
    },
    similar_titles(title: Title, exclude: readonly string[], profile: number | null): CatalogEntry[] {
      const genres = genre_labels(title.genres);
      const sources = [...new Set(genres.flatMap(label => genre_sources(genre_id(label))))];
      if (!sources.length || title.kind === 'episode') return [];
      const rows = database.prepare(`SELECT candidates.*, json_extract(title_snapshots.value, '$.director') AS director,
          json_extract(title_snapshots.value, '$.cast') AS cast
        FROM (SELECT catalog.* FROM (SELECT title_id, COUNT(*) AS shared FROM title_genres
            WHERE genre_id IN (${sources.map(() => '?').join(', ')}) GROUP BY title_id HAVING COUNT(*) >= ?) matches
          JOIN catalog ON catalog.id = matches.title_id
          WHERE catalog.kind = ?
          ORDER BY matches.shared DESC, catalog.imdb_rating DESC NULLS LAST, catalog.id
          LIMIT ?) candidates
        LEFT JOIN title_snapshots ON title_snapshots.id = candidates.id`).all(...sources, Math.min(2, genres.length), title.kind, CANDIDATES) as CandidateRow[];
      const skipped = new Set([title.id, ...exclude]);
      const done = new Set(profile === null ? [] : (settled.all(profile, ...SETTLED) as { id: string }[]).map(row => row.id));
      const wanted = new Set(genres);
      const crew = people(title.director, title.cast);
      return rows.filter(row => !skipped.has(row.id))
        .map(row => {
          const entry = catalog_entry(row);
          return { entry, done: done.has(row.id), score: similarity(title, wanted, crew, row, entry) };
        })
        .sort((left, right) => Number(left.done) - Number(right.done) || right.score - left.score || left.entry.id.localeCompare(right.entry.id))
        .slice(0, SIMILAR)
        .map(({ entry }) => entry);
    },
  };
}
