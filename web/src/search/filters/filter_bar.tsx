import { useId, useRef, useState } from 'react';
import type { CatalogSort, GenreOption } from '../../catalog/types';
import { GenreMenu } from '../../discover/genres/genre_menu';
import { SortMenu } from '../../discover/sort_menu';
import { KINDS } from '../../library/pages/kinds';
import { Choices } from '../../ui/choices';
import { ToggleChip } from '../../ui/filters/filter_chips';
import { FiltersSheet } from './filters_sheet';
import { active_filters, HIDDEN_LABELS, HIDDEN_STATUSES, toggle_hidden, type FilterChange, type TitleFilters } from './title_filters';

type Props = {
  filters: TitleFilters;
  defaults: TitleFilters;
  sorts: readonly CatalogSort[];
  genres: readonly GenreOption[];
  total: number | null;
  compact: boolean;
  on_change: FilterChange;
};

function FiltersChip({ filters, defaults, ...sheet }: Omit<Props, 'compact'>) {
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, set_open] = useState(false);
  const count = active_filters(filters, defaults);

  return <>
    <button type="button" ref={anchor} className="filter-chip filters-chip" data-set={count > 0 || undefined} popoverTarget={id}
      aria-controls={id} aria-haspopup="dialog" aria-expanded={open} onClick={event => { event.preventDefault(); set_open(!open); }}>
      Filters{count > 0 && <span className="filter-badge" aria-label={`${count} active`}>{count}</span>}
    </button>
    <FiltersSheet id={id} open={open} anchor={anchor} filters={filters} {...sheet} on_close={() => set_open(false)}
      on_reset={() => sheet.on_change({ sort: defaults.sort, genre: defaults.genre, hide: defaults.hide })} />
  </>;
}

export function FilterBar({ compact, ...props }: Props) {
  const { filters, defaults, sorts, genres, on_change } = props;
  return <div className="filter-bar">
    <Choices label="Type" options={KINDS} value={filters.kind} on_change={kind => on_change({ kind })} />
    {compact ? <FiltersChip {...props} /> : <div className="filter-menus">
      <SortMenu sorts={sorts} value={filters.sort} fallback={defaults.sort} on_change={sort => on_change({ sort })} />
      <GenreMenu genres={genres} value={filters.genre} on_change={genre => on_change({ genre })} />
      {HIDDEN_STATUSES.map(status => <ToggleChip key={status} label={`Hide ${HIDDEN_LABELS[status].toLowerCase()}`} on={filters.hide.includes(status)}
        on_change={() => on_change({ hide: toggle_hidden(filters.hide, status) })} />)}
    </div>}
  </div>;
}
