import { CATALOG_SORTS, type CatalogKind, type CatalogQuery } from '../catalog/types';

export const HIDDEN_STATUSES = ['watched', 'dropped'] as const;
export type HiddenStatus = typeof HIDDEN_STATUSES[number];

export type DiscoverQuery = Pick<CatalogQuery, 'kind' | 'sort' | 'genre' | 'page'> & { hide: HiddenStatus[] };

export const DISCOVER_DEFAULTS: DiscoverQuery = { kind: 'all', sort: 'trending', genre: '', hide: [], page: 1 };

const KINDS: readonly CatalogKind[] = ['movie', 'series', 'anime'];

export function parse_discover(params: URLSearchParams): DiscoverQuery {
  const hide = params.get('hide')?.split(',') ?? [];
  const page = Number(params.get('page'));
  return {
    kind: KINDS.find(kind => kind === params.get('type')) ?? DISCOVER_DEFAULTS.kind,
    sort: CATALOG_SORTS.find(sort => sort === params.get('sort')) ?? DISCOVER_DEFAULTS.sort,
    genre: params.get('genre') ?? DISCOVER_DEFAULTS.genre,
    hide: HIDDEN_STATUSES.filter(status => hide.includes(status)),
    page: Number.isInteger(page) && page > 1 ? page : DISCOVER_DEFAULTS.page,
  };
}

export function discover_href(query: Partial<DiscoverQuery>) {
  const { kind, sort, genre, hide, page } = { ...DISCOVER_DEFAULTS, ...query };
  const params = new URLSearchParams();
  if (kind !== DISCOVER_DEFAULTS.kind) params.set('type', kind);
  if (sort !== DISCOVER_DEFAULTS.sort) params.set('sort', sort);
  if (genre) params.set('genre', genre);
  if (hide.length) params.set('hide', hide.join(','));
  if (page > 1) params.set('page', String(page));
  const search = params.toString().replaceAll('%2C', ',');
  return search ? `#/discover?${search}` : '#/discover';
}
