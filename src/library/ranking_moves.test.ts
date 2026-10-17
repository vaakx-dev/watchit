import { describe, expect, it } from 'vitest';
import { accept, before_of, confirm, enqueue, move, reject, shown, step, type RankingState } from './ranking_moves';
import type { RankedItem, Rankings } from './types';

function item(id: string, rank: number, position: number): RankedItem {
  return {
    title: { id, title: id, year: 2024, artwork: '', genres: [], kind: 'movie', anime: false },
    entry: { id, rating: null, status: null, favorite: false, recommended: false, saved: false, last_opened_at: null },
    opened_at: null, progress: null, rank, position,
  };
}

const base: Rankings = {
  kind: 'all',
  tiers: [
    { rating: 5, items: [item('a', 1, 1), item('b', 2, 2), item('c', 3, 3)] },
    { rating: 4, items: [item('d', 4, 1), item('e', 5, 2)] },
  ],
};

function order(value: Rankings | null) {
  return value?.tiers.map(tier => tier.items.map(entry => `${entry.rank}:${entry.title.id}`));
}

describe('ranking moves', () => {
  it('places a title above another in its tier and renumbers ranks', () => {
    expect(order(move(base, { id: 'c', before: 'a' }))).toEqual([['1:c', '2:a', '3:b'], ['4:d', '5:e']]);
    expect(move(base, { id: 'c', before: 'a' }).tiers[0]?.items.map(entry => entry.position)).toEqual([1, 2, 3]);
  });

  it('moves a title to the bottom of its tier', () => {
    expect(order(move(base, { id: 'a', before: null }))).toEqual([['1:b', '2:c', '3:a'], ['4:d', '5:e']]);
  });

  it('ignores a move across tiers or for an unknown title', () => {
    expect(move(base, { id: 'a', before: 'd' })).toBe(base);
    expect(move(base, { id: 'x', before: null })).toBe(base);
  });

  it('finds the title below and the keyboard step moves', () => {
    expect(before_of(base, 'b')).toBe('c');
    expect(before_of(base, 'c')).toBeNull();
    expect(step(base, 'b', -1)).toEqual({ id: 'b', before: 'a' });
    expect(step(base, 'a', 1)).toEqual({ id: 'a', before: 'c' });
    expect(step(base, 'b', 1)).toEqual({ id: 'b', before: null });
    expect(step(base, 'a', -1)).toBeNull();
    expect(step(base, 'e', 1)).toBeNull();
  });
});

describe('optimistic ranking state', () => {
  const start: RankingState = { confirmed: base, pending: [], error: null };

  it('shows pending moves on top of the confirmed order', () => {
    const state = enqueue(start, { id: 'c', before: 'a', sequence: 1 });
    expect(order(shown(state))?.[0]).toEqual(['1:c', '2:a', '3:b']);
  });

  it('rolls back only the failed move and keeps later ones', () => {
    let state = enqueue(start, { id: 'c', before: 'a', sequence: 1 });
    state = enqueue(state, { id: 'e', before: 'd', sequence: 2 });
    state = reject(state, 1, 'Server error');
    expect(order(shown(state))).toEqual([['1:a', '2:b', '3:c'], ['4:e', '5:d']]);
    expect(state.error).toBe('Server error');
  });

  it('takes the server order when a move is confirmed', () => {
    const saved = move(base, { id: 'b', before: 'a' });
    let state = enqueue(start, { id: 'b', before: 'a', sequence: 1 });
    state = confirm(state, 1, saved);
    expect(state.pending).toEqual([]);
    expect(shown(state)).toBe(saved);
  });

  it('ignores fetched rankings while moves are pending', () => {
    const fetched = move(base, { id: 'a', before: null });
    const pending = enqueue(start, { id: 'c', before: 'a', sequence: 1 });
    expect(accept(pending, fetched)).toBe(pending);
    expect(accept(start, fetched).confirmed).toBe(fetched);
  });

  it('clears the last error when the next move starts', () => {
    const failed = reject(enqueue(start, { id: 'c', before: 'a', sequence: 1 }), 1, 'Server error');
    expect(enqueue(failed, { id: 'b', before: 'a', sequence: 2 }).error).toBeNull();
  });
});
