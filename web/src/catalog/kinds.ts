import type { Choice } from '../ui/choices';
import type { CatalogEntry, CatalogKind } from './types';

const CATALOG_KINDS: readonly CatalogKind[] = ['all', 'movie', 'series', 'anime'];

export const KIND_LABELS: Record<CatalogKind, string> = { all: 'All', movie: 'Movies', series: 'Series', anime: 'Anime' };

export const KIND_CHOICES: readonly Choice<CatalogKind>[] = CATALOG_KINDS.map(value => ({ value, label: KIND_LABELS[value] }));

const PLURALS: Record<CatalogKind, string> = { all: 'titles', movie: 'movies', series: 'series', anime: 'anime' };

export function plural(kind: CatalogKind) {
  return PLURALS[kind];
}

export function parse_kind(value: string | null) {
  return CATALOG_KINDS.find(kind => kind === value);
}

export function kind_label({ kind, anime }: CatalogEntry) {
  if (anime) return 'Anime';
  return kind === 'series' ? 'Series' : 'Movie';
}

export function full_kind_label({ kind, anime }: CatalogEntry) {
  if (kind === 'episode') return '';
  const label = kind === 'movie' ? 'Movie' : 'Series';
  return anime ? `Anime ${label.toLowerCase()}` : label;
}
