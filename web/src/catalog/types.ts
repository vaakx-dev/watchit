import type { SeriesProgress, Status } from '../library/types.ts';
import type { SavedPosition } from '../playback/progress/api.ts';

export type MediaKind = 'movie' | 'series' | 'episode';
export type CatalogKind = 'all' | 'movie' | 'series' | 'anime';
export type TrendingKind = Exclude<CatalogKind, 'all'>;
export const CATALOG_SORTS = ['newest', 'title', 'trending', 'top_rated'] as const;
export type CatalogSort = typeof CATALOG_SORTS[number];
export type ImdbId = `tt${number}`;

export type CatalogEntry = {
  id: string;
  title: string;
  year: number | null;
  artwork: string;
  genres: string[];
  kind: MediaKind;
  anime: boolean;
  imdb_rating?: number | null;
};

export type GenreOption = { id: string; label: string; minor: boolean };

export type ImageCredit = {
  source?: 'cinemeta';
  role?: 'poster' | 'backdrop' | 'still';
  source_url?: string;
  terms_url?: string;
  retrieved_at?: string;
  url: string;
  description_url: string;
  author: string;
  license: string;
  license_url: string;
};

export type Trailer = { id: string };

export type EpisodeEntry = CatalogEntry & {
  kind: 'episode';
  season: number | null;
  episode: number | null;
};

export type Title = CatalogEntry & {
  backdrop: string;
  minutes: number | null;
  synopsis: string;
  director: string;
  cast: string;
  imdb_id: ImdbId | null;
  tmdb_id: number | null;
  season: number | null;
  episode: number | null;
  series: { id: string; title: string; imdb_id: ImdbId | null; tmdb_id: number | null } | null;
  related: CatalogEntry[];
  images: ImageCredit[];
  source_url: string;
  provider_ids?: { one_anime?: string };
  popularity?: number | null;
  trailers?: Trailer[];
};

export type Freshness = { updated_at: string; stale: boolean };

export type ImportStatus = {
  enabled: boolean;
  pending: boolean;
  running: boolean;
  imported: number;
  error: string | null;
  next_retry_at: string | null;
};

export type ArtworkStatus = { pending: boolean; running: boolean; error: string | null };

export type CatalogPage = {
  items: CatalogEntry[];
  page: number;
  has_next: boolean;
  genres: GenreOption[];
  freshness: Freshness;
  imports?: ImportStatus;
  artwork_status?: ArtworkStatus;
};

export type TitleResult = {
  title: Title;
  freshness: Freshness;
  playback_source: string | null;
  progress: SeriesProgress | null;
  position?: SavedPosition | null;
  imports?: ImportStatus;
  artwork_status?: ArtworkStatus;
};
export type FranchiseEntry = CatalogEntry & { position: number; current: boolean };
export type RelatedTitles = {
  franchise: { name: string | null; items: FranchiseEntry[] } | null;
  similar: CatalogEntry[];
  pending: boolean;
  artwork_status?: ArtworkStatus;
};
export type TrendingEntry = CatalogEntry & { rank: number };
export type TrendingPage = {
  items: TrendingEntry[];
  page: number;
  has_next: boolean;
  day: string | null;
  imports?: ImportStatus;
  artwork_status?: ArtworkStatus;
};
export type EpisodePage = { items: EpisodeEntry[]; page: number; has_next: boolean; freshness: Freshness; imports?: ImportStatus; artwork_status?: ArtworkStatus };
export type EpisodeNavigation = EpisodePage & {
  season: number;
  seasons: number[];
  previous: EpisodeEntry | null;
  next: EpisodeEntry | null;
};

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
