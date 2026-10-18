import { useId, type RefObject } from 'react';
import { SORT_LABELS } from '../../catalog/sort_labels';
import type { CatalogSort, GenreOption } from '../../catalog/types';
import { Switch } from '../../settings/controls/switch';
import { Choices } from '../../ui/choices';
import { Sheet } from '../../ui/sheet/sheet';
import { genre_choices, HIDDEN_LABELS, HIDDEN_STATUSES, toggle_hidden, type FilterChange, type TitleFilters } from './title_filters';

type Props = {
  id: string;
  open: boolean;
  anchor: RefObject<HTMLElement | null>;
  filters: TitleFilters;
  sorts: readonly CatalogSort[];
  genres: readonly GenreOption[];
  total: number | null;
  on_change: FilterChange;
  on_reset: () => void;
  on_close: () => void;
};

function show_label(total: number | null) {
  if (total === null) return 'Show results';
  return total === 1 ? 'Show 1 result' : `Show ${total.toLocaleString()} results`;
}

export function FiltersSheet({ id, open, anchor, filters, sorts, genres, total, on_change, on_reset, on_close }: Props) {
  const switches = useId();

  return <Sheet id={id} title="Filters" open={open} anchor={anchor} on_close={on_close} className="filters-sheet"
    action={<button type="button" className="sheet-action" onClick={on_reset}>Reset</button>}>
    <h3 className="filter-group">Sort</h3>
    <Choices label="Sort" options={sorts.map(sort => ({ value: sort, label: SORT_LABELS[sort] }))} value={filters.sort}
      on_change={sort => on_change({ sort })} />
    {genres.length > 0 && <>
      <h3 className="filter-group">Genre</h3>
      <Choices label="Genre" options={genre_choices(genres, filters.genre)} value={filters.genre}
        on_change={genre => on_change({ genre: genre === filters.genre ? '' : genre })} />
    </>}
    <h3 className="filter-group">Hide</h3>
    {HIDDEN_STATUSES.map(status => <div className="filter-toggle" key={status}>
      <label htmlFor={`${switches}-${status}`}>{HIDDEN_LABELS[status]}</label>
      <Switch id={`${switches}-${status}`} label={`Hide ${HIDDEN_LABELS[status].toLowerCase()}`} checked={filters.hide.includes(status)}
        on_change={() => on_change({ hide: toggle_hidden(filters.hide, status) })} />
    </div>)}
    <button type="button" className="button primary filters-sheet-submit" onClick={on_close}>{show_label(total)}</button>
  </Sheet>;
}
