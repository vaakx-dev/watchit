import type { TorrentResult } from '../types';
import { facet_values, type FacetKey } from './facets';

export type TorrentFilters = {
  facets: Partial<Record<FacetKey, string[]>>;
  min_gb: number | null;
  max_gb: number | null;
  min_seeders: number | null;
};

export const NO_FILTERS: TorrentFilters = { facets: {}, min_gb: null, max_gb: null, min_seeders: null };

const GB = 1024 ** 3;

export function active_filters(filters: TorrentFilters) {
  const facets = Object.values(filters.facets).filter(values => values.length > 0).length;
  return facets + [filters.min_gb, filters.max_gb, filters.min_seeders].filter(value => value !== null).length;
}

function within_size(result: TorrentResult, { min_gb, max_gb }: TorrentFilters) {
  if (min_gb === null && max_gb === null) return true;
  if (result.size_bytes === null) return false;
  return (min_gb === null || result.size_bytes >= min_gb * GB) && (max_gb === null || result.size_bytes <= max_gb * GB);
}

export function matches(result: TorrentResult, filters: TorrentFilters) {
  const facets = Object.entries(filters.facets) as [FacetKey, string[]][];
  return facets.every(([key, wanted]) => !wanted.length || facet_values(result, key).some(value => wanted.includes(value)))
    && within_size(result, filters)
    && (filters.min_seeders === null || (result.seeders ?? 0) >= filters.min_seeders);
}

export function toggle_facet(filters: TorrentFilters, key: FacetKey, value: string): TorrentFilters {
  const current = filters.facets[key] ?? [];
  const next = current.includes(value) ? current.filter(item => item !== value) : [...current, value];
  return { ...filters, facets: { ...filters.facets, [key]: next } };
}
