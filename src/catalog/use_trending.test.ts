import { expect, it } from 'vitest';
import { trending_url } from './use_trending';

it('asks for all kinds on the first page by default', () => {
  expect(trending_url({})).toBe('/api/trending?kind=all&page=1');
});

it('passes the statuses to hide', () => {
  expect(trending_url({ kind: 'anime', page: 2, hide: ['want', 'watched'] })).toBe('/api/trending?kind=anime&page=2&hide=want%2Cwatched');
});
