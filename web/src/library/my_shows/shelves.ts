import type { LibrarySort, Shelf } from '../types';

export type View = 'list' | 'grid';

export const SHELF_LABELS: Record<Shelf, string> = {
  watching: 'Watching',
  want: 'Want',
  paused: 'Paused',
  watched: 'Watched',
  dropped: 'Dropped',
  favorite: 'Favourites',
  recommended: 'Recommended',
  saved: 'Saved',
  recent: 'Recently opened',
};

export const SHELF_ORDER: readonly Shelf[] = ['watching', 'want', 'paused', 'watched', 'dropped', 'favorite', 'recommended', 'saved', 'recent'];

export const EXTRA_SHELVES: readonly Shelf[] = ['favorite', 'recommended', 'saved', 'recent'];

export const SORT_LABELS: Record<LibrarySort, { short: string; long: string }> = {
  recent: { short: 'Recent', long: 'Recently watched' },
  added: { short: 'Added', long: 'Recently added' },
  title: { short: 'A–Z', long: 'Title A–Z' },
  newest: { short: 'Year', long: 'Release year' },
  rating: { short: 'Rating', long: 'Your rating' },
};

export function default_sort(shelf: Shelf): LibrarySort {
  if (shelf === 'watched') return 'rating';
  if (shelf === 'want' || shelf === 'dropped') return 'added';
  return 'recent';
}

export function default_view(shelf: Shelf): View {
  return shelf === 'watched' ? 'grid' : 'list';
}

export function shows_progress(shelf: Shelf) {
  return shelf === 'watching' || shelf === 'paused' || shelf === 'recent';
}
