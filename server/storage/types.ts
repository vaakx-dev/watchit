import type {
  CatalogEntry, CatalogKind, CatalogPage, CatalogQuery, EpisodeNavigation, EpisodePage, Title, TrendingKind, TrendingPage, TrendingQuery,
} from '../../src/catalog/types.ts';
import type { CacheSettings, CacheStatus } from '../../src/cache/types.ts';
import type {
  ContinuePage, LibraryPage, LibraryQuery, LibrarySnapshot, PersonalPatch, PlaybackPreference, Rankings, Rating, SeasonWatched, SeriesProgress, Status,
} from '../../src/library/types.ts';
import type { Profile, ProfilePatch } from '../../src/profiles/types.ts';

export type CacheRecord<T> = { value: T; updated_at: number };
export type ImportedTitle = { title: Title; genres: { id: string; label: string }[] };
export type Hidden = { profile: number; statuses: readonly Status[] };

export type AvatarImage = { image: Uint8Array; updated_at: number };

export type ImageRecord = {
  key: string;
  source_url: string;
  content_type: string | null;
  bytes: number;
  fetched_at: number | null;
  accessed_at: number;
};

export interface Store {
  directory: string;
  cache_get<T>(key: string): CacheRecord<T> | null;
  cache_set<T>(key: string, value: T): void;
  catalog_get(id: string): CatalogEntry | null;
  title_put(items: readonly ImportedTitle[]): void;
  title_get(id: string): CacheRecord<Title> | null;
  title_list(after_id: string, limit: number): Title[];
  artwork_update(id: string, images: Pick<Title, 'artwork' | 'backdrop' | 'images'>): Title | null;
  catalog_query(query: Omit<CatalogQuery, 'hide'>, hide?: Hidden): CatalogPage;
  episodes_query(id: string, page: number): EpisodePage;
  episode_navigation(id: string, season?: number, page?: number): EpisodeNavigation | null;
  catalog_count(): number;
  catalog_entries(ids: readonly string[]): CatalogEntry[];
  similar_titles(title: Title, exclude: readonly string[], profile: number | null): CatalogEntry[];
  trending_put(kind: TrendingKind, ids: readonly string[]): void;
  trending_query(query: Omit<TrendingQuery, 'hide'>, hide?: Hidden): TrendingPage;
  profile_list(): Profile[];
  profile_get(id: number): Profile | null;
  profile_create(name: string): Profile;
  profile_update(id: number, patch: ProfilePatch): Profile;
  profile_delete(id: number, confirm: string): Profile[];
  avatar_get(profile: number): AvatarImage | null;
  avatar_put(profile: number, image: Uint8Array): void;
  avatar_delete(profile: number): void;
  avatar_shuffle(profile: number): void;
  pin_check(profile: number, pin: string | undefined, client: string): void;
  pin_set(profile: number, pin: string | null): void;
  session_create(profile: number): string;
  session_profile(token: string): number | null;
  session_delete(token: string): void;
  sessions_revoke(profile: number, keep: string | null): void;
  series_progress(profile: number, series_id: string): SeriesProgress;
  library_query(profile: number, query: LibraryQuery): LibraryPage;
  continue_query(profile: number, kind: CatalogKind, page: number): ContinuePage;
  rankings_get(profile: number, kind: CatalogKind): Rankings;
  ranking_move(profile: number, id: string, before: string | null, kind: CatalogKind): Rankings;
  playback_source(profile: number, id: string): string | null;
  playback_update(profile: number, id: string, source: string | null): PlaybackPreference;
  library_get(profile: number): LibrarySnapshot;
  personal_update(profile: number, id: string, patch: PersonalPatch): LibrarySnapshot;
  season_update(profile: number, series_id: string, season: number, rating: Rating | null): LibrarySnapshot;
  season_watched(profile: number, series_id: string, season: number, watched: boolean): SeasonWatched;
  settings_get(): CacheSettings;
  settings_update(patch: Partial<CacheSettings>): CacheSettings;
  status(): CacheStatus;
  image_get(key: string): ImageRecord | null;
  image_put(record: ImageRecord): void;
  image_bytes(): number;
  image_lru(limit: number): ImageRecord[];
  image_unencoded(after_key: string, limit: number): ImageRecord[];
  image_clear(keys: readonly string[]): void;
  image_list(): ImageRecord[];
  image_delete(key: string): void;
  close(): void;
}
