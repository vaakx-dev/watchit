import { CATALOG_SORTS, type CatalogKind, type CatalogQuery } from '../catalog/types';

export type DiscoverQuery = Pick<CatalogQuery, 'kind' | 'sort' | 'genre'> & { hide_watched: boolean };

export const DISCOVER_DEFAULTS: DiscoverQuery = { kind: 'all', sort: 'trending', genre: '', hide_watched: true };

const KINDS: readonly CatalogKind[] = ['movie', 'series', 'anime'];

export function parse_discover(params: URLSearchParams): DiscoverQuery {
  return {
    kind: KINDS.find(kind => kind === params.get('type')) ?? DISCOVER_DEFAULTS.kind,
    sort: CATALOG_SORTS.find(sort => sort === params.get('sort')) ?? DISCOVER_DEFAULTS.sort,
    genre: params.get('genre') ?? DISCOVER_DEFAULTS.genre,
    hide_watched: params.get('watched') !== 'show',
  };
}

export function discover_href(query: Partial<DiscoverQuery>) {
  const { kind, sort, genre, hide_watched } = { ...DISCOVER_DEFAULTS, ...query };
  const params = new URLSearchParams();
  if (kind !== DISCOVER_DEFAULTS.kind) params.set('type', kind);
  if (sort !== DISCOVER_DEFAULTS.sort) params.set('sort', sort);
  if (genre) params.set('genre', genre);
  if (!hide_watched) params.set('watched', 'show');
  const search = params.toString();
  return search ? `#/discover?${search}` : '#/discover';
}
