import type { RankedItem, Rankings } from '../types';

export type Move = { id: string; before: string | null };
type PendingMove = Move & { sequence: number };
export type RankingState = { confirmed: Rankings | null; pending: readonly PendingMove[]; error: string | null };

function renumber(rankings: Rankings): Rankings {
  let rank = 0;
  const tiers = rankings.tiers.map(tier => ({
    ...tier,
    items: tier.items.map((item, index) => {
      rank += 1;
      return { ...item, rank, position: index + 1 };
    }),
  }));
  return { ...rankings, tiers };
}

function tier_of(rankings: Rankings, id: string) {
  return rankings.tiers.find(tier => tier.items.some(item => item.title.id === id));
}

export function move(rankings: Rankings, { id, before }: Move): Rankings {
  const tier = tier_of(rankings, id);
  const item = tier?.items.find(candidate => candidate.title.id === id);
  if (!tier || !item) return rankings;
  const rest = tier.items.filter(candidate => candidate !== item);
  const index = before === null ? rest.length : rest.findIndex(candidate => candidate.title.id === before);
  if (index < 0) return rankings;
  const items: RankedItem[] = [...rest.slice(0, index), item, ...rest.slice(index)];
  return renumber({ ...rankings, tiers: rankings.tiers.map(candidate => candidate === tier ? { ...tier, items } : candidate) });
}

export function before_of(rankings: Rankings, id: string): string | null {
  const items = tier_of(rankings, id)?.items ?? [];
  const index = items.findIndex(item => item.title.id === id);
  return items[index + 1]?.title.id ?? null;
}

export function step(rankings: Rankings, id: string, direction: -1 | 1): Move | null {
  const items = tier_of(rankings, id)?.items ?? [];
  const index = items.findIndex(item => item.title.id === id);
  if (index < 0 || !items[index + direction]) return null;
  return { id, before: items[direction === -1 ? index - 1 : index + 2]?.title.id ?? null };
}

export function shown(state: RankingState): Rankings | null {
  return state.confirmed && state.pending.reduce(move, state.confirmed);
}

export function accept(state: RankingState, rankings: Rankings): RankingState {
  return state.pending.length ? state : { ...state, confirmed: rankings };
}

export function enqueue(state: RankingState, pending: PendingMove): RankingState {
  return { ...state, pending: [...state.pending, pending], error: null };
}

export function confirm(state: RankingState, sequence: number, rankings: Rankings): RankingState {
  return { ...state, confirmed: rankings, pending: state.pending.filter(item => item.sequence !== sequence) };
}

export function reject(state: RankingState, sequence: number, error: string): RankingState {
  return { ...state, pending: state.pending.filter(item => item.sequence !== sequence), error };
}
