import type { TrendingKind } from '../../src/catalog/types.ts';
import type { ImportedTitle } from '../storage/types.ts';

export const TRENDING_PAGES = 10;
export const TRENDING_REFRESH_MS = 24 * 3600000;

export function trending_ids(items: readonly ImportedTitle[], kind: TrendingKind): string[] {
  const listed = items.filter(item => kind !== 'anime' || item.title.anime);
  const series = listed.filter(item => item.title.kind === 'series');
  const movies = listed.filter(item => item.title.kind === 'movie');
  const length = Math.max(series.length, movies.length);
  return Array.from({ length }, (_, index) => [series[index], movies[index]])
    .flat()
    .filter(item => item !== undefined)
    .map(item => item.title.id);
}
