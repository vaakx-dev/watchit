import { describe, expect, it } from 'vitest';
import type { CatalogEntry } from '../catalog/types';
import {
  accept,
  can_accept,
  confirm,
  create,
  empty,
  enqueue,
  snapshot,
  reject,
} from './optimism';
import type { LibrarySnapshot, PersonalEntry } from './types';

const title: CatalogEntry = {
  id: 'tt0133093',
  title: 'Movie One',
  year: 2024,
  artwork: '/movie-1.jpg',
  genres: ['Drama'],
  kind: 'movie',
  anime: false,
};

const entry: PersonalEntry = {
  id: title.id,
  rating: null,
  status: null,
  favorite: false,
  recommended: false,
  saved: false,
  last_opened_at: null,
};

function fixture(overrides: Partial<LibrarySnapshot> = {}): LibrarySnapshot {
  return {
    ...empty(),
    entries: { [entry.id]: entry },
    ...overrides,
  };
}

describe('library mutation state', () => {
  it('shows entry and season changes before their responses arrive', () => {
    let state = create(fixture());
    state = enqueue(state, {
      sequence: 1,
      kind: 'entry',
      entry_id: entry.id,
      patch: { status: 'watching', favorite: true, rating: 4 },
    });
    state = enqueue(state, {
      sequence: 2,
      kind: 'season',
      series_id: 'tt0903747',
      season: 2,
      rating: 3.5,
    });

    const optimistic = snapshot(state);
    expect(optimistic.entries[entry.id]).toMatchObject({ status: 'watching', favorite: true, rating: 4 });
    expect(optimistic.seasons).toEqual({ 'tt0903747': { 2: 3.5 } });
    expect(fixture().entries[entry.id]).toEqual(entry);
  });

  it('reapplies later same-title choices after each ordered response', () => {
    let state = create(fixture());
    state = enqueue(state, {
      sequence: 1,
      kind: 'entry',
      entry_id: entry.id,
      patch: { status: 'watching', rating: 3 },
    });
    state = enqueue(state, {
      sequence: 2,
      kind: 'entry',
      entry_id: entry.id,
      patch: { status: 'watched', rating: 4.5 },
    });

    state = confirm(state, 1, fixture({
      entries: { [entry.id]: { ...entry, status: 'watching', rating: 3 } },
    }));
    expect(snapshot(state).entries[entry.id]).toMatchObject({ status: 'watched', rating: 4.5 });

    state = confirm(state, 2, fixture({
      entries: { [entry.id]: { ...entry, status: 'watched', rating: 4.5 } },
    }));
    expect(snapshot(state).entries[entry.id]).toMatchObject({ status: 'watched', rating: 4.5 });
  });

  it('rolls back only a failed operation while keeping newer and independent changes', () => {
    const other = { ...entry, id: 'tt0133094' };
    let state = create(fixture({ entries: { [entry.id]: entry, [other.id]: other } }));
    state = enqueue(state, {
      sequence: 1,
      kind: 'entry',
      entry_id: entry.id,
      patch: { status: 'watching', favorite: true },
    });
    state = enqueue(state, {
      sequence: 2,
      kind: 'entry',
      entry_id: entry.id,
      patch: { status: 'paused' },
    });
    state = enqueue(state, {
      sequence: 3,
      kind: 'entry',
      entry_id: other.id,
      patch: { rating: 5 },
    });

    state = reject(state, 1, 'offline');
    expect(snapshot(state).entries[entry.id]).toMatchObject({ status: 'paused', favorite: false });
    expect(snapshot(state).entries[other.id]?.rating).toBe(5);
    expect(state.error).toBe('offline');

    state = enqueue(state, {
      sequence: 4,
      kind: 'entry',
      entry_id: other.id,
      patch: { favorite: true },
    });
    expect(state.error).toBe('offline');
    state = accept(state, fixture());
    expect(state.error).toBe('offline');
  });

  it('keeps title metadata for saved toggles and does not invent history timestamps', () => {
    let state = create(fixture());
    state = enqueue(state, {
      sequence: 1,
      kind: 'entry',
      entry_id: title.id,
      patch: { saved: true },
      title,
    });
    const saved = snapshot(state);
    expect(saved.saved).toEqual([title]);
    expect(saved.entries[title.id]?.saved).toBe(true);

    state = enqueue(state, {
      sequence: 2,
      kind: 'entry',
      entry_id: title.id,
      patch: { opened: true },
    });
    expect(snapshot(state).entries[title.id]?.last_opened_at).toBeNull();
  });

  it('rejects a read captured before a mutation without losing the optimistic operation', () => {
    let state = create(fixture());
    const read_revision = state.revision;
    state = enqueue(state, {
      sequence: 1,
      kind: 'entry',
      entry_id: entry.id,
      patch: { status: 'watched' },
    });

    expect(can_accept(state, read_revision)).toBe(false);
    const stale_read = fixture({ entries: { [entry.id]: entry } });
    const protected_state = can_accept(state, read_revision)
      ? accept(state, stale_read)
      : state;
    expect(snapshot(protected_state).entries[entry.id]?.status).toBe('watched');
  });
});
