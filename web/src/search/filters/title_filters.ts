import type { CatalogKind, CatalogSort, GenreOption } from '../../catalog/types';
import { HIDDEN_STATUSES, type HiddenStatus } from '../../navigation/discover';

export type TitleFilters = { kind: CatalogKind; sort: CatalogSort; genre: string; hide: HiddenStatus[] };

export type FilterChange = (next: Partial<TitleFilters>) => void;

export const SORT_LABELS: Record<CatalogSort, string> = {
  relevance: 'Best match',
  trending: 'Trending',
  top_rated: 'Top rated',
  newest: 'Newest',
  title: 'A–Z',
};

export const HIDDEN_LABELS: Record<HiddenStatus, string> = { watched: 'Watched', dropped: 'Dropped' };

export function active_filters(filters: TitleFilters, default_sort: CatalogSort) {
  return Number(filters.sort !== default_sort) + Number(filters.genre !== '') + filters.hide.length;
}

export function toggle_hidden(hide: readonly HiddenStatus[], status: HiddenStatus) {
  const next = hide.includes(status) ? hide.filter(item => item !== status) : [...hide, status];
  return HIDDEN_STATUSES.filter(item => next.includes(item));
}

export function genre_choices(genres: readonly GenreOption[], selected: string) {
  const shown = genres.filter(genre => !genre.minor || genre.id === selected).map(genre => ({ value: genre.id, label: genre.label }));
  if (selected && !shown.some(genre => genre.value === selected)) shown.push({ value: selected, label: selected });
  return shown;
}

export function genre_label(genres: readonly GenreOption[], selected: string) {
  return genres.find(genre => genre.id === selected)?.label ?? selected;
}
