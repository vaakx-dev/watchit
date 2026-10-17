import type { PersonalEntry, SeriesProgress } from '../library/types';
import type { EpisodeEntry, EpisodeNavigation } from './types';

type Numbered = Pick<EpisodeEntry, 'season' | 'episode'>;

export function season_label(season: number) {
  return season === 0 ? 'Specials' : `Season ${season}`;
}

export function episode_code({ season, episode }: Numbered, current_season?: number | null) {
  const parts = [season === null || season === current_season ? '' : `S${season}`, episode === null ? '' : `E${episode}`];
  return parts.filter(Boolean).join(' ');
}

export function play_label(next: EpisodeEntry, last: EpisodeEntry | null) {
  return `${last ? 'Continue' : 'Play'} ${episode_code(next)}`;
}

export function navigation_anchor(progress: SeriesProgress | null, episodes: readonly EpisodeEntry[]) {
  const numbered = episodes.filter(item => item.season !== null && item.episode !== null);
  return progress?.next ?? progress?.last ?? numbered.find(item => item.season !== 0) ?? numbered[0] ?? null;
}

export function watched_summary(navigation: EpisodeNavigation, entries: Record<string, PersonalEntry>) {
  if (navigation.page > 1 || navigation.has_next || !navigation.items.length) return null;
  const watched = navigation.items.filter(item => entries[item.id]?.status === 'watched').length;
  return `${watched} of ${navigation.items.length} watched`;
}
