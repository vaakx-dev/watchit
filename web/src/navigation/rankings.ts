import { parse_kind } from '../catalog/kinds';
import type { CatalogKind } from '../catalog/types';

const RANKING_LAYOUTS = ['ranked', 'tiers'] as const;
export type RankingLayout = typeof RANKING_LAYOUTS[number];

export type RankingsQuery = { kind: CatalogKind; layout: RankingLayout };

export const RANKINGS_DEFAULTS: RankingsQuery = { kind: 'all', layout: 'ranked' };

export function parse_rankings(params: URLSearchParams): RankingsQuery {
  return {
    kind: parse_kind(params.get('type')) ?? RANKINGS_DEFAULTS.kind,
    layout: RANKING_LAYOUTS.find(layout => layout === params.get('layout')) ?? RANKINGS_DEFAULTS.layout,
  };
}

function href(path: string, { kind, layout }: RankingsQuery) {
  const params = new URLSearchParams();
  if (kind !== RANKINGS_DEFAULTS.kind) params.set('type', kind);
  if (layout !== RANKINGS_DEFAULTS.layout) params.set('layout', layout);
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export function rankings_href(query: RankingsQuery) {
  return href('#/rankings', query);
}

export function rate_href(query: RankingsQuery) {
  return href('#/rankings/rate', query);
}
