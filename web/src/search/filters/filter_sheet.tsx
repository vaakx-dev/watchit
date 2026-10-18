import { useEffect, useId, useRef } from 'react';
import type { CatalogSort, GenreOption } from '../../catalog/types';
import { HIDDEN_STATUSES } from '../../navigation/discover';
import { Switch } from '../../settings/controls/switch';
import { Choices } from '../../ui/choices';
import { genre_choices, HIDDEN_LABELS, SORT_LABELS, toggle_hidden, type FilterChange, type TitleFilters } from './title_filters';

type Props = {
  open: boolean;
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
  return total === 1 ? 'Show 1 result' : `Show ${total} results`;
}

export function FilterSheet({ open, filters, sorts, genres, total, on_change, on_reset, on_close }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const sheet = dialog.current;
    if (!sheet) return;
    if (open && !sheet.open) sheet.showModal();
    if (!open && sheet.open) sheet.close();
  }, [open]);

  return <dialog ref={dialog} className="filter-sheet" aria-labelledby={`${id}-title`} onClose={on_close}
    onClick={event => { if (event.target === event.currentTarget) on_close(); }}>
    <div className="filter-sheet-body">
      <span className="sheet-handle" aria-hidden="true" />
      <div className="filter-sheet-header">
        <h2 id={`${id}-title`}>Filters</h2>
        <button type="button" onClick={on_reset}>Reset</button>
      </div>
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
        <label htmlFor={`${id}-${status}`}>{HIDDEN_LABELS[status]}</label>
        <Switch id={`${id}-${status}`} label={`Hide ${HIDDEN_LABELS[status].toLowerCase()}`} checked={filters.hide.includes(status)}
          on_change={() => on_change({ hide: toggle_hidden(filters.hide, status) })} />
      </div>)}
      <button type="button" className="button primary filter-sheet-submit" onClick={on_close}>{show_label(total)}</button>
    </div>
  </dialog>;
}
