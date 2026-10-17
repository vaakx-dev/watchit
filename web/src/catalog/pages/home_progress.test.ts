import { expect, it } from 'vitest';
import { play_target, progress_line } from './home_progress';
import type { CatalogEntry, EpisodeEntry } from '../types';
import type { LibraryItem, Status } from '../../library/types';

const now = new Date(2026, 9, 16, 20);
const series: CatalogEntry = { id: 'tt11280740', title: 'Severance', year: 2022, artwork: '', genres: [], kind: 'series', anime: false, imdb_rating: null };
const episode: EpisodeEntry = { ...series, id: 'tt11280740:2:5', title: 'Trojan’s Horse', kind: 'episode', season: 2, episode: 5 };

function item(status: Status, next: EpisodeEntry | null, title = series): LibraryItem {
  return {
    title,
    entry: { id: title.id, rating: null, status, favorite: false, recommended: false, saved: false, last_opened_at: null },
    opened_at: new Date(2026, 8, 25, 20).toISOString(),
    progress: title.kind === 'series' ? { last: null, next, opened_at: null } : null,
  };
}

it('names the next episode of a show in progress', () => {
  expect(progress_line(item('watching', episode), now)).toBe('Next · S2 E5 · Trojan’s Horse');
});

it('says when a paused show was last opened', () => {
  expect(progress_line(item('paused', episode), now)).toBe('Paused · S2 E5 · 3 weeks ago');
});

it('falls back to the status for movies and caught-up shows', () => {
  const movie = { ...series, id: 'tt0133093', title: 'The Matrix', kind: 'movie' } as const;
  expect(progress_line(item('watching', null, movie), now)).toBe('Watching · 3 weeks ago');
  expect(progress_line({ ...item('paused', null), opened_at: null }, now)).toBe('Paused');
});

it('plays the next episode or the movie, otherwise has no play target', () => {
  expect(play_target(item('watching', episode))).toBe('#/watch/tt11280740:2:5');
  expect(play_target(item('watching', null, { ...series, id: 'tt0133093', kind: 'movie' }))).toBe('#/watch/tt0133093');
  expect(play_target(item('watching', null))).toBeNull();
});
