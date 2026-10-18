import type { CatalogKind, CatalogSort } from '../catalog/types';
import { DISCOVER_DEFAULTS, type DiscoverQuery } from '../navigation/discover';

const KIND_NAMES: Record<CatalogKind, string> = { all: 'All titles', movie: 'Movies', series: 'Series', anime: 'Anime' };
const KIND_NOUNS: Record<CatalogKind, string> = { all: 'titles', movie: 'movies', series: 'series', anime: 'anime' };
const SORT_PHRASES: Record<CatalogSort, string> = { trending: 'trending', top_rated: 'top rated', newest: 'newest', title: 'A–Z' };

export function narrowed({ kind, sort, genre }: DiscoverQuery) {
  return kind !== DISCOVER_DEFAULTS.kind || sort !== DISCOVER_DEFAULTS.sort || genre !== DISCOVER_DEFAULTS.genre;
}

export function summary({ kind, sort }: DiscoverQuery, genre: string) {
  const subject = genre ? `${genre} ${KIND_NOUNS[kind]}` : KIND_NAMES[kind];
  return `${subject} · ${SORT_PHRASES[sort]}`;
}

export function count_label(total: number) {
  return `${total.toLocaleString()} ${total === 1 ? 'title' : 'titles'}`;
}
