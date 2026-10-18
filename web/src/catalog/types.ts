import type { CatalogKind } from '../generated/catalog/CatalogKind';
import type { CatalogResponse } from '../generated/catalog/CatalogResponse';
import type { EpisodesResponse } from '../generated/catalog/EpisodesResponse';
import type { NavigationResponse } from '../generated/catalog/NavigationResponse';
import type { TrendingResponse } from '../generated/catalog/TrendingResponse';
import type { Status } from '../library/types.ts';

export type { ArtworkStatus } from '../generated/artwork/ArtworkStatus';
export type { CatalogKind } from '../generated/catalog/CatalogKind';
export type { CatalogEntry } from '../generated/catalog/CatalogEntry';
export type { EpisodeEntry } from '../generated/catalog/EpisodeEntry';
export type { Franchise } from '../generated/catalog/Franchise';
export type { FranchiseEntry } from '../generated/catalog/FranchiseEntry';
export type { Freshness } from '../generated/catalog/Freshness';
export type { GenreOption } from '../generated/catalog/GenreOption';
export type { ImageCredit } from '../generated/catalog/ImageCredit';
export type { ImportStatus } from '../generated/catalog/ImportStatus';
export type { MediaKind } from '../generated/catalog/MediaKind';
export type { RelatedTitles } from '../generated/catalog/RelatedTitles';
export type { Title } from '../generated/catalog/Title';
export type { TitleResult } from '../generated/catalog/TitleResult';
export type { Trailer } from '../generated/catalog/Trailer';
export type { TrendingEntry } from '../generated/catalog/TrendingEntry';

export type TrendingKind = Exclude<CatalogKind, 'all'>;
export const CATALOG_SORTS = ['relevance', 'newest', 'title', 'trending', 'top_rated'] as const;
export type CatalogSort = typeof CATALOG_SORTS[number];

export type CatalogPage = CatalogResponse;
export type TrendingPage = TrendingResponse;
export type EpisodePage = EpisodesResponse;
export type EpisodeNavigation = NavigationResponse;

export type CatalogQuery = {
  page: number;
  query: string;
  kind: CatalogKind;
  genre: string;
  sort: CatalogSort;
  hide?: Status[];
};

export type TrendingQuery = { kind: CatalogKind; page: number; hide: Status[] };

export type ApiError = { error: string };
