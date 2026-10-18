import { expect, it } from 'vitest';
import { play_target, progress_line } from './home_progress';
import type { CatalogEntry, EpisodeEntry } from '../types';
import type { LibraryItem, Status } from '../../library/types';

const series: CatalogEntry = { id: 'tt11280740', title: 'Severance', year: 2022, artwork: '', genres: [], kind: 'series', anime: false, imdb_rating: null };
const episode: EpisodeEntry = { ...series, id: 'tt11280740:2:5', title: 'Trojan’s Horse', kind: 'episode', season: 2, episode: 5, synopsis: '' };
const halfway = { position_seconds: 1500, duration_seconds: 2580 };

function item(status: Status, next: EpisodeEntry | null, title = series, resume: LibraryItem['resume'] = null): LibraryItem {
  const series_title = title.kind === 'series';
  return {
    title,
    entry: { id: title.id, rating: null, status, favorite: false, recommended: false, saved: false, last_opened_at: null },
    opened_at: null,
    resume: series_title ? null : resume,
    progress: series_title ? { last: null, next, resume, opened_at: null } : null,
  };
}

it('shows the time left in the next episode, or its title before it starts', () => {
  expect(progress_line(item('watching', episode, series, halfway))).toBe('S2 E5 · 18 min left');
  expect(progress_line(item('watching', episode))).toBe('S2 E5 · Trojan’s Horse');
});

it('says when a show or movie is paused', () => {
  expect(progress_line(item('paused', episode, series, halfway))).toBe('S2 E5 · Paused');
  expect(progress_line(item('paused', null))).toBe('Paused');
});

it('falls back to the time left or the status for movies and caught-up shows', () => {
  const movie = { ...series, id: 'tt0133093', title: 'The Matrix', kind: 'movie' } as const;
  expect(progress_line(item('watching', null, movie, halfway))).toBe('18 min left');
  expect(progress_line(item('watching', null, movie))).toBe('Watching');
});

it('plays the next episode or the movie, otherwise has no play target', () => {
  expect(play_target(item('watching', episode))).toBe('#/watch/tt11280740:2:5');
  expect(play_target(item('watching', null, { ...series, id: 'tt0133093', kind: 'movie' }))).toBe('#/watch/tt0133093');
  expect(play_target(item('watching', null))).toBeNull();
});
