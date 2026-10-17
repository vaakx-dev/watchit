import { useMemo, useState } from 'react';
import type { TorrentResult } from '../types';
import { build_facets } from './facets';
import { matches, NO_FILTERS, type TorrentFilters } from './filter_state';
import { sort_results, type SortKey } from './sort';

export function use_torrent_filters(results: readonly TorrentResult[], season = false) {
  const [filters, set_filters] = useState<TorrentFilters>(NO_FILTERS);
  const [sort, set_sort] = useState<SortKey>('best');
  const facets = useMemo(() => build_facets(results, season), [results, season]);
  const shown = useMemo(() => sort_results(results.filter(result => matches(result, filters)), sort), [results, filters, sort]);
  return { facets, filters, set_filters, sort, set_sort, shown, total: results.length };
}

export type TorrentFilterState = ReturnType<typeof use_torrent_filters>;
