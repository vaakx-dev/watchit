import { useLayoutEffect, useRef, useState } from 'react';
import { Choices, type Choice } from '../../ui/choices';
import { useRowScroll } from '../../ui/use_row_scroll';
import { Check } from 'lucide-react';
import { SORT_LABELS } from '../sort_labels';
import type { CatalogKind, CatalogQuery, CatalogSort, GenreOption } from '../types';

const HIDDEN_STATUSES = ['watched', 'dropped'] as const;
type HiddenStatus = typeof HIDDEN_STATUSES[number];

export type SearchFilters = Pick<CatalogQuery, 'kind' | 'sort' | 'genre' | 'page'> & { hide: HiddenStatus[] };

export const SEARCH_DEFAULTS: SearchFilters = { kind: 'all', sort: 'trending', genre: '', hide: [], page: 1 };

const KINDS: readonly Choice<CatalogKind>[] = [
  { value: 'all', label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'series', label: 'Series' },
  { value: 'anime', label: 'Anime' },
];

const SORTS: readonly Choice<CatalogSort>[] = (['trending', 'top_rated', 'newest', 'title'] as const).map(value => ({ value, label: SORT_LABELS[value] }));

const HIDDEN_LABELS: Record<HiddenStatus, string> = { watched: 'Watched', dropped: 'Dropped' };

type Change = (next: Partial<SearchFilters>) => void;

function Genres({ genres, value, on_change }: { genres: readonly GenreOption[]; value: string; on_change: Change }) {
  const row = useRef<HTMLDivElement>(null);
  const selected = genres.find(genre => genre.id === value);
  const [more, set_more] = useState(selected?.minor ?? false);
  const major = genres.filter(genre => !genre.minor);
  const minor = genres.filter(genre => genre.minor && (more || genre === selected));
  const options = [...major, ...minor].map(genre => ({ value: genre.id, label: genre.label }));
  if (value && !selected) options.push({ value, label: value });

  useRowScroll(row);

  useLayoutEffect(() => {
    const chip = row.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (row.current && chip) row.current.scrollLeft = chip.offsetLeft - (row.current.clientWidth - chip.offsetWidth) / 2;
  }, [value]);

  return <div className="genre-choices" ref={row} data-loading={genres.length === 0 || undefined}>
    <Choices label="Genre" options={options} value={value} on_change={id => on_change({ genre: id === value ? '' : id })}>
      {genres.some(genre => genre.minor) && <button type="button" className="more-genres" aria-expanded={more} onClick={() => set_more(!more)}>
        {more ? 'Fewer genres' : 'More genres'}
      </button>}
    </Choices>
  </div>;
}

function Hidden({ value, on_change }: { value: HiddenStatus[]; on_change: Change }) {
  function toggle(status: HiddenStatus) {
    const next = value.includes(status) ? value.filter(item => item !== status) : [...value, status];
    on_change({ hide: HIDDEN_STATUSES.filter(item => next.includes(item)) });
  }

  return <div className="choices chips" role="group" aria-label="Hide">
    {HIDDEN_STATUSES.map(status => <button type="button" key={status} aria-pressed={value.includes(status)} onClick={() => toggle(status)}>
      {value.includes(status) && <Check />}{HIDDEN_LABELS[status]}
    </button>)}
  </div>;
}

export function CollectionFilters({ filters, genres, on_change }: { filters: SearchFilters; genres: readonly GenreOption[]; on_change: Change }) {
  return <div className="discover-filters">
    <span className="filter-label" aria-hidden="true">Type</span>
    <Choices label="Type" look="segmented" options={KINDS} value={filters.kind} on_change={kind => on_change({ kind })} />
    <span className="filter-label" aria-hidden="true">Sort</span>
    <Choices label="Sort" look="segmented" options={SORTS} value={filters.sort} on_change={sort => on_change({ sort })} />
    <span className="filter-label" aria-hidden="true">Genre</span>
    <Genres genres={genres} value={filters.genre} on_change={on_change} />
    <span className="filter-label" aria-hidden="true">Hide</span>
    <Hidden value={filters.hide} on_change={on_change} />
  </div>;
}
