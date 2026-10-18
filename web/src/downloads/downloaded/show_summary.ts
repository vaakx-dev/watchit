import type { ShowGroup } from './library_groups';

export function count(value: number, one: string, many: string) {
  return `${value} ${value === 1 ? one : many}`;
}

export function episode_count(show: ShowGroup) {
  return count(show.episodes, 'episode', 'episodes');
}

export function season_count(show: ShowGroup) {
  return count(show.seasons.length, 'season', 'seasons');
}
