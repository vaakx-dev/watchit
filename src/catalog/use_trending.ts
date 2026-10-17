import { use_import_page } from './api';
import type { TrendingPage, TrendingQuery } from './types';

export function trending_url({ kind = 'all', page = 1, hide = [] }: Partial<TrendingQuery>) {
  const params = new URLSearchParams({ kind, page: String(page) });
  if (hide.length) params.set('hide', hide.join(','));
  return `/api/trending?${params}`;
}

export function use_trending(query: Partial<TrendingQuery>) {
  return use_import_page<TrendingPage>(trending_url(query), data => data.items);
}
