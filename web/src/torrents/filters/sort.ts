import type { TorrentResult } from '../types';

export type SortKey = 'best' | 'seeders' | 'resolution' | 'largest' | 'smallest';

export const SORT_LABELS: Record<SortKey, string> = {
  best: 'Best match',
  seeders: 'Most seeders',
  resolution: 'Highest resolution',
  largest: 'Largest',
  smallest: 'Smallest',
};

const RESOLUTIONS = ['2160p', '1440p', '1080p', '720p', '480p', '360p'];

function resolution_rank(result: TorrentResult) {
  const rank = result.resolution ? RESOLUTIONS.indexOf(result.resolution) : -1;
  return rank < 0 ? RESOLUTIONS.length : rank;
}

const COMPARE: Record<Exclude<SortKey, 'best'>, (a: TorrentResult, b: TorrentResult) => number> = {
  seeders: (a, b) => (b.seeders ?? -1) - (a.seeders ?? -1),
  resolution: (a, b) => resolution_rank(a) - resolution_rank(b),
  largest: (a, b) => (b.size_bytes ?? -1) - (a.size_bytes ?? -1),
  smallest: (a, b) => (a.size_bytes ?? Infinity) - (b.size_bytes ?? Infinity),
};

export function sort_results(results: readonly TorrentResult[], sort: SortKey) {
  return sort === 'best' ? [...results] : [...results].sort(COMPARE[sort]);
}
