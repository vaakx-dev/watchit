import { describe, expect, it } from 'vitest';
import { episode_code, navigation_anchor, play_label, season_label, watched_summary } from './episodes';
import type { PersonalEntry } from '../library/types';
import type { EpisodeEntry, EpisodeNavigation, ImportStatus } from './types';

const imports: ImportStatus = { enabled: true, pending: false, running: false, imported: 0, error: null, next_retry_at: null };

function episode(season: number | null, number: number | null): EpisodeEntry {
  return { id: `tt1:${season}:${number}`, title: `Episode ${number}`, year: 2026, artwork: '', genres: [], kind: 'episode', anime: false, imdb_rating: null, season, episode: number };
}

function navigation(items: EpisodeEntry[], page = 1, has_next = false): EpisodeNavigation {
  return { items, page, has_next, freshness: { updated_at: '', stale: false }, imports, artwork_status: { pending: false, running: false, error: null }, season: 1, seasons: [1], previous: null, next: null };
}

const watched: PersonalEntry = { id: 'tt1:1:1', rating: null, status: 'watched', favorite: false, recommended: false, saved: false, last_opened_at: null };

describe('episode labels', () => {
  it('names seasons and specials', () => {
    expect(season_label(2)).toBe('Season 2');
    expect(season_label(0)).toBe('Specials');
  });

  it('drops the season when it matches the one being watched', () => {
    expect(episode_code(episode(1, 4))).toBe('S1 E4');
    expect(episode_code(episode(1, 5), 1)).toBe('E5');
    expect(episode_code(episode(2, 1), 1)).toBe('S2 E1');
    expect(episode_code(episode(null, 3))).toBe('E3');
  });
});

describe('series progress', () => {
  it('continues after the last opened episode or starts at the next one', () => {
    expect(play_label(episode(1, 4), episode(1, 3))).toBe('Continue S1 E4');
    expect(play_label(episode(1, 1), null)).toBe('Play S1 E1');
  });

  it('anchors the season list on progress, then on the first numbered regular episode', () => {
    const specials = [episode(0, 1), episode(null, null), episode(1, 1)];
    expect(navigation_anchor({ last: episode(1, 3), next: episode(1, 4), opened_at: null }, specials)?.id).toBe('tt1:1:4');
    expect(navigation_anchor({ last: episode(2, 8), next: null, opened_at: null }, specials)?.id).toBe('tt1:2:8');
    expect(navigation_anchor(null, specials)?.id).toBe('tt1:1:1');
    expect(navigation_anchor(null, [episode(null, null), episode(0, 2)])?.id).toBe('tt1:0:2');
    expect(navigation_anchor(null, [])).toBeNull();
  });

  it('counts watched episodes only when the whole season is loaded', () => {
    const items = [episode(1, 1), episode(1, 2)];
    expect(watched_summary(navigation(items), { [watched.id]: watched })).toBe('1 of 2 watched');
    expect(watched_summary(navigation(items, 1, true), {})).toBeNull();
    expect(watched_summary(navigation(items, 2), {})).toBeNull();
    expect(watched_summary(navigation([]), {})).toBeNull();
  });
});
