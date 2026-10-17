import type { CatalogEntry } from '../catalog/types';
import type { LibrarySnapshot, PersonalEntry, PersonalPatch, Rating } from './types';

export type Change =
  | {
      kind: 'entry';
      entry_id: string;
      patch: PersonalPatch;
      title?: CatalogEntry;
    }
  | {
      kind: 'season';
      series_id: string;
      season: number;
      rating: Rating | null;
    }
  | {
      kind: 'season_watched';
      episode_ids: readonly string[];
      watched: boolean;
    };

export type Mutation = Change & { sequence: number };

export type State = {
  confirmed: LibrarySnapshot;
  pending: readonly Mutation[];
  revision: number;
  error: string | null;
};

export function empty(): LibrarySnapshot {
  return { entries: {}, seasons: {}, saved: [], recent: [], artwork_status: { pending: false, running: false, error: null } };
}

export function create(snapshot: LibrarySnapshot = empty()): State {
  return { confirmed: snapshot, pending: [], revision: 0, error: null };
}

export function snapshot(state: State): LibrarySnapshot {
  return state.pending.reduce(apply, state.confirmed);
}

export function enqueue(state: State, mutation: Mutation): State {
  return { ...state, pending: [...state.pending, mutation], revision: state.revision + 1 };
}

export function confirm(
  state: State,
  sequence: number,
  snapshot: LibrarySnapshot,
): State {
  if (state.pending[0]?.sequence !== sequence) return state;
  return {
    confirmed: snapshot,
    pending: state.pending.slice(1),
    revision: state.revision + 1,
    error: state.error,
  };
}

export function reject(state: State, sequence: number, error: string): State {
  if (state.pending[0]?.sequence !== sequence) return state;
  return { ...state, pending: state.pending.slice(1), revision: state.revision + 1, error: error };
}

export function accept(state: State, snapshot: LibrarySnapshot): State {
  return { ...state, confirmed: snapshot };
}

export function can_accept(state: State, revision: number): boolean {
  return state.revision === revision;
}

function apply(snapshot: LibrarySnapshot, mutation: Mutation): LibrarySnapshot {
  if (mutation.kind === 'entry') return apply_entry(snapshot, mutation.entry_id, mutation.patch, mutation.title);
  if (mutation.kind === 'season') return apply_season(snapshot, mutation.series_id, mutation.season, mutation.rating);
  return apply_season_watched(snapshot, mutation.episode_ids, mutation.watched);
}

function apply_entry(
  snapshot: LibrarySnapshot,
  entry_id: string,
  patch: PersonalPatch,
  title: CatalogEntry | undefined,
): LibrarySnapshot {
  const changes_entry = patch.rating !== undefined || patch.status !== undefined
    || patch.favorite !== undefined || patch.recommended !== undefined || patch.saved !== undefined;
  let next = snapshot;

  if (changes_entry) {
    const previous = snapshot.entries[entry_id] ?? default_entry(entry_id);
    const entry: PersonalEntry = { ...previous };
    if (patch.rating !== undefined) entry.rating = patch.rating;
    if (patch.status !== undefined) entry.status = patch.status;
    if (patch.favorite !== undefined) entry.favorite = patch.favorite;
    if (patch.recommended !== undefined) entry.recommended = patch.recommended;
    if (patch.saved !== undefined) entry.saved = patch.saved;
    next = { ...next, entries: { ...snapshot.entries, [entry_id]: entry } };
  }

  if (patch.saved !== undefined && (title !== undefined || !patch.saved)) {
    next = {
      ...next,
      saved: patch.saved
        ? save_title(next.saved, entry_id, title)
        : next.saved.filter(saved_title => saved_title.id !== entry_id),
    };
  }

  return next;
}

function apply_season(snapshot: LibrarySnapshot, series_id: string, season: number, rating: Rating | null): LibrarySnapshot {
  const previous = snapshot.seasons[series_id];
  if (rating === null) {
    if (previous === undefined || previous[season] === undefined) return snapshot;
    const ratings = { ...previous };
    delete ratings[season];
    const seasons = { ...snapshot.seasons };
    if (Object.keys(ratings).length === 0) delete seasons[series_id];
    else seasons[series_id] = ratings;
    return { ...snapshot, seasons };
  }

  return {
    ...snapshot,
    seasons: {
      ...snapshot.seasons,
      [series_id]: { ...previous, [season]: rating },
    },
  };
}

function apply_season_watched(snapshot: LibrarySnapshot, episode_ids: readonly string[], watched: boolean): LibrarySnapshot {
  const entries = { ...snapshot.entries };
  for (const id of episode_ids) {
    const previous = entries[id] ?? default_entry(id);
    if (watched) entries[id] = { ...previous, status: 'watched' };
    else if (previous.status === 'watched') entries[id] = { ...previous, status: null };
  }
  return { ...snapshot, entries };
}

function save_title(saved: readonly CatalogEntry[], entry_id: string, title: CatalogEntry | undefined): CatalogEntry[] {
  if (title === undefined) return [...saved];
  const index = saved.findIndex(saved_title => saved_title.id === entry_id);
  if (index === -1) return [...saved, title];
  const next = [...saved];
  next[index] = title;
  return next;
}

function default_entry(id: string): PersonalEntry {
  return { id, rating: null, status: null, favorite: false, recommended: false, saved: false, last_opened_at: null };
}
