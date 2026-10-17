import type { Choice } from '../../ui/choices';
import type { CatalogEntry, CatalogKind } from '../../catalog/types';

export const KINDS: readonly Choice<CatalogKind>[] = [
  { value: 'all', label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'series', label: 'Series' },
  { value: 'anime', label: 'Anime' },
];

const NOUNS: Record<CatalogKind, [string, string]> = {
  all: ['title', 'titles'],
  movie: ['movie', 'movies'],
  series: ['series', 'series'],
  anime: ['anime', 'anime'],
};

export function plural(kind: CatalogKind) {
  return NOUNS[kind][1];
}

export function count_label(count: number, kind: CatalogKind) {
  const [one, many] = NOUNS[kind];
  return `${count} ${count === 1 ? one : many}`;
}

export function kind_label(title: CatalogEntry) {
  if (title.anime) return 'Anime';
  if (title.kind === 'series') return 'Series';
  return 'Movie';
}
