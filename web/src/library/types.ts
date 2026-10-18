import type { CatalogKind } from '../catalog/types.ts';
import type { Rating } from '../generated/library/Rating';
import type { Status } from '../generated/library/Status';

export type { ContinuePage } from '../generated/library/ContinuePage';
export type { LibraryItem } from '../generated/library/LibraryItem';
export type { LibraryPage } from '../generated/library/LibraryPage';
export type { LibrarySnapshot } from '../generated/library/LibrarySnapshot';
export type { PersonalEntry } from '../generated/library/PersonalEntry';
export type { PersonalPatch } from '../generated/library/PersonalPatch';
export type { PlaybackPreference } from '../generated/library/PlaybackPreference';
export type { RankedItem } from '../generated/library/RankedItem';
export type { RankingTier } from '../generated/library/RankingTier';
export type { Rankings } from '../generated/library/Rankings';
export type { SeasonWatched } from '../generated/library/SeasonWatched';
export type { UnratedTitles } from '../generated/library/UnratedTitles';
export type { SeriesProgress } from '../generated/catalog/SeriesProgress';
export type { Rating, Status };

export const RATINGS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const satisfies readonly Rating[];

export const STATUSES = ['want', 'watching', 'paused', 'watched', 'dropped'] as const satisfies readonly Status[];

export const SHELVES = [...STATUSES, 'favorite', 'recommended', 'saved', 'recent'] as const;
export type Shelf = typeof SHELVES[number];

export const LIBRARY_SORTS = ['recent', 'added', 'title', 'newest', 'rating'] as const;
export type LibrarySort = typeof LIBRARY_SORTS[number];

export type LibraryQuery = { shelf: Shelf; kind: CatalogKind; sort: LibrarySort; page: number };
