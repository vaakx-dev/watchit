import type { FranchiseEntry, ImportStatus, RelatedTitles, Title } from '../../src/catalog/types.ts';
import type { Store } from '../storage/types.ts';
import type { Franchise } from './wikidata.ts';

const REACH = 7;

type Sources = {
  store: Store;
  franchises: { get(imdb_id: string): { franchise: Franchise | null; pending: boolean } };
  sync: { title(id: string): ImportStatus; titles(ids: readonly string[]): ImportStatus };
};

function lookup(title: Title, franchises: Sources['franchises']) {
  if (!title.imdb_id || title.kind === 'episode') return { franchise: null, pending: false };
  return franchises.get(title.imdb_id);
}

export function related_titles({ store, franchises, sync }: Sources, title: Title, profile: number | null): Omit<RelatedTitles, 'artwork_status'> {
  const { franchise, pending } = lookup(title, franchises);
  const ids = franchise?.ids ?? [];
  const start = Math.max(0, ids.indexOf(title.id) - REACH);
  const shown = ids.slice(start, start + REACH * 2 + 1);
  const entries = new Map(store.catalog_entries(shown).map(entry => [entry.id, entry]));
  const missing = shown.filter(id => !entries.has(id));
  for (const id of missing) sync.title(id);
  const items: FranchiseEntry[] = shown.flatMap((id, offset) => {
    const entry = entries.get(id);
    return entry ? [{ ...entry, position: start + offset + 1, current: id === title.id }] : [];
  });
  return {
    franchise: franchise && items.length > 1 ? { name: franchise.name, items } : null,
    similar: store.similar_titles(title, ids, profile),
    pending: pending || (missing.length > 0 && sync.titles(missing).pending),
  };
}
