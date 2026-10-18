import { Choices, type Choice } from '../ui/choices';
import { ToggleChip } from '../ui/filters/filter_chips';
import type { CatalogKind, GenreOption } from '../catalog/types';
import type { DiscoverQuery } from '../navigation/discover';
import { GenreMenu } from './genres/genre_menu';
import { SortMenu } from './sort_menu';

const KINDS: readonly Choice<CatalogKind>[] = [
  { value: 'all', label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'series', label: 'Series' },
  { value: 'anime', label: 'Anime' },
];

export function DiscoverFilters({ query, genres, count, on_change }: {
  query: DiscoverQuery;
  genres: readonly GenreOption[];
  count: string | null;
  on_change: (next: Partial<DiscoverQuery>) => void;
}) {
  return <div className="discover-bar">
    <div className="filter-switch">
      <Choices label="Type" look="segmented" options={KINDS} value={query.kind} on_change={kind => on_change({ kind })} />
    </div>
    <div className="discover-chips">
      <SortMenu value={query.sort} on_change={sort => on_change({ sort })} />
      <GenreMenu genres={genres} value={query.genre} on_change={genre => on_change({ genre })} />
      <ToggleChip label="Hide watched" on={query.hide_watched} on_change={hide_watched => on_change({ hide_watched })} />
    </div>
    {count && <span className="discover-count" aria-live="polite">{count}</span>}
  </div>;
}
