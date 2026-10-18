import type { CatalogKind, CatalogSort, GenreOption } from '../../catalog/types';

export const HIDDEN_STATUSES = ['watched', 'dropped'] as const;
export type HiddenStatus = typeof HIDDEN_STATUSES[number];

export type TitleFilters = { kind: CatalogKind; sort: CatalogSort; genre: string; hide: HiddenStatus[] };

export type FilterChange = (next: Partial<TitleFilters>) => void;

export const HIDDEN_LABELS: Record<HiddenStatus, string> = { watched: 'Watched', dropped: 'Dropped' };

export function active_filters(filters: TitleFilters, defaults: TitleFilters) {
  return Number(filters.sort !== defaults.sort) + Number(filters.genre !== defaults.genre) + filters.hide.length;
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
