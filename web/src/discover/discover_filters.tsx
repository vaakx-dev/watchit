import { Choices } from '../ui/choices';
import { ToggleChip } from '../ui/filters/filter_chips';
import { KIND_CHOICES } from '../catalog/kinds';
import type { CatalogSort, GenreOption } from '../catalog/types';
import { DISCOVER_DEFAULTS, type DiscoverQuery } from '../navigation/discover';
import { GenreMenu } from './genres/genre_menu';
import { SortMenu } from './sort_menu';

const SORTS: readonly CatalogSort[] = ['trending', 'top_rated', 'newest', 'title'];

export function DiscoverFilters({ query, genres, count, on_change }: {
  query: DiscoverQuery;
  genres: readonly GenreOption[];
  count: string | null;
  on_change: (next: Partial<DiscoverQuery>) => void;
}) {
  return <div className="discover-bar">
    <div className="filter-switch">
      <Choices label="Type" look="segmented" options={KIND_CHOICES} value={query.kind} on_change={kind => on_change({ kind })} />
    </div>
    <div className="discover-chips">
      <SortMenu sorts={SORTS} value={query.sort} fallback={DISCOVER_DEFAULTS.sort} on_change={sort => on_change({ sort })} />
      <GenreMenu genres={genres} value={query.genre} on_change={genre => on_change({ genre })} />
      <ToggleChip label="Hide watched" on={query.hide_watched} on_change={hide_watched => on_change({ hide_watched })} />
    </div>
    {count && <span className="discover-count" aria-live="polite">{count}</span>}
  </div>;
}
