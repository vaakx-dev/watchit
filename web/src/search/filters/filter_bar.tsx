import { useState } from 'react';
import type { CatalogSort, GenreOption } from '../../catalog/types';
import { KINDS } from '../../library/pages/kinds';
import { HIDDEN_STATUSES, type HiddenStatus } from '../../navigation/discover';
import { Choices } from '../../ui/choices';
import { ChipMenu } from './chip_menu';
import { FilterSheet } from './filter_sheet';
import { active_filters, genre_choices, genre_label, HIDDEN_LABELS, SORT_LABELS, toggle_hidden, type FilterChange, type TitleFilters } from './title_filters';

type Props = {
  filters: TitleFilters;
  defaults: TitleFilters;
  sorts: readonly CatalogSort[];
  genres: readonly GenreOption[];
  total: number | null;
  compact: boolean;
  on_change: FilterChange;
};

function hide_label(hide: readonly HiddenStatus[]) {
  if (hide.length === 1) return `Hide ${HIDDEN_LABELS[hide[0]!].toLowerCase()}`;
  return hide.length ? `Hide ${hide.length}` : 'Hide';
}

function Menus({ filters, defaults, sorts, genres, on_change }: Omit<Props, 'total' | 'compact'>) {
  const genre_options = [{ value: '', label: 'Any genre' }, ...genre_choices(genres, filters.genre)];
  return <div className="filter-menus">
    <ChipMenu label={SORT_LABELS[filters.sort]} active={filters.sort !== defaults.sort}
      options={sorts.map(sort => ({ value: sort, label: SORT_LABELS[sort], checked: sort === filters.sort }))}
      on_select={sort => on_change({ sort: sorts.find(option => option === sort) ?? defaults.sort })} />
    {genres.length > 0 && <ChipMenu label={filters.genre ? genre_label(genres, filters.genre) : 'Genre'} active={filters.genre !== ''}
      options={genre_options.map(option => ({ ...option, checked: option.value === filters.genre }))}
      on_select={genre => on_change({ genre })} />}
    <ChipMenu label={hide_label(filters.hide)} active={filters.hide.length > 0} multiple
      options={HIDDEN_STATUSES.map(status => ({ value: status, label: HIDDEN_LABELS[status], checked: filters.hide.includes(status) }))}
      on_select={status => on_change({ hide: toggle_hidden(filters.hide, HIDDEN_STATUSES.find(item => item === status)!) })} />
  </div>;
}

export function FilterBar({ filters, defaults, sorts, genres, total, compact, on_change }: Props) {
  const [sheet, set_sheet] = useState(false);
  const count = active_filters(filters, defaults.sort);

  return <div className="filter-bar">
    <Choices label="Type" options={KINDS} value={filters.kind} on_change={kind => on_change({ kind })} />
    {compact ? <>
      <button type="button" className="filters-chip" aria-haspopup="dialog" onClick={() => set_sheet(true)}>
        Filters{count > 0 && <span className="filter-badge" aria-label={`${count} active`}>{count}</span>}
      </button>
      <FilterSheet open={sheet} filters={filters} sorts={sorts} genres={genres} total={total} on_change={on_change}
        on_reset={() => on_change({ sort: defaults.sort, genre: defaults.genre, hide: defaults.hide })} on_close={() => set_sheet(false)} />
    </> : <Menus filters={filters} defaults={defaults} sorts={sorts} genres={genres} on_change={on_change} />}
  </div>;
}
