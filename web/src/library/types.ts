import type { ArtworkStatus, CatalogEntry, CatalogKind, EpisodeEntry, ImportStatus } from '../catalog/types.ts';

export const RATINGS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;
export type Rating = typeof RATINGS[number];

export const STATUSES = ['want', 'watching', 'paused', 'watched', 'dropped'] as const;
export type Status = typeof STATUSES[number];

export type PersonalEntry = {
  id: string;
  rating: Rating | null;
  status: Status | null;
  favorite: boolean;
  recommended: boolean;
  saved: boolean;
  last_opened_at: string | null;
};

export type PersonalPatch = {
  rating?: Rating | null;
  status?: Status | null;
  favorite?: boolean;
  recommended?: boolean;
  saved?: boolean;
  opened?: boolean;
};

export type LibrarySnapshot = {
  entries: Record<string, PersonalEntry>;
  seasons: Record<string, Record<number, Rating>>;
  saved: CatalogEntry[];
  recent: CatalogEntry[];
  artwork_status?: ArtworkStatus;
  imports?: ImportStatus;
};

export const SHELVES = [...STATUSES, 'favorite', 'recommended', 'saved', 'recent'] as const;
export type Shelf = typeof SHELVES[number];

export const LIBRARY_SORTS = ['recent', 'title', 'newest', 'rating'] as const;
export type LibrarySort = typeof LIBRARY_SORTS[number];

export type LibraryQuery = { shelf: Shelf; kind: CatalogKind; sort: LibrarySort; page: number };

export type SeriesProgress = {
  last: EpisodeEntry | null;
  next: EpisodeEntry | null;
  opened_at: string | null;
};

export type SeasonWatched = LibrarySnapshot & { progress: SeriesProgress };

export type LibraryItem = {
  title: CatalogEntry;
  entry: PersonalEntry;
  opened_at: string | null;
  progress: SeriesProgress | null;
};

export type LibraryPage = {
  items: LibraryItem[];
  page: number;
  has_next: boolean;
  total: number;
  counts: Record<Shelf, number>;
  artwork_status?: ArtworkStatus;
};

export type ContinuePage = {
  items: LibraryItem[];
  page: number;
  has_next: boolean;
  artwork_status?: ArtworkStatus;
};

export type RankedItem = LibraryItem & { rank: number; position: number };
export type RankingTier = { rating: Rating; items: RankedItem[] };
export type Rankings = { kind: CatalogKind; tiers: RankingTier[] };

export type PlaybackPreference = { id: string; source: string | null };
