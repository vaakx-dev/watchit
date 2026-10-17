import { useEffect, useSyncExternalStore } from 'react';
import { TITLE_ID } from '../catalog/identity';
import type { CatalogKind } from '../catalog/types';
import { SHELVES, type Shelf } from '../library/types';
import { discover_href, parse_discover, type DiscoverQuery } from './discover';

export type Route =
  | { view: 'tonight' | 'rankings' | 'downloads' | 'profiles' | 'missing' }
  | { view: 'settings'; section: string | null }
  | { view: 'discover'; query: DiscoverQuery }
  | { view: 'mine'; shelf: Shelf }
  | { view: 'search'; query: string }
  | { view: 'title' | 'watch'; id: string };

export function search_route(query: string) {
  return `#/search?${new URLSearchParams({ q: query })}`;
}

export function discover_route(kind: CatalogKind) {
  return discover_href({ kind });
}

export function mine_route(shelf: Shelf) {
  return shelf === 'recent' ? '#/mine?view=recent' : `#/mine?status=${shelf}`;
}

const LEGACY: Record<string, string> = {
  '/movies': discover_route('movie'),
  '/series': discover_route('series'),
  '/anime': discover_route('anime'),
  '/saved': mine_route('saved'),
  '/history': mine_route('recent'),
};

function split(hash: string) {
  const [pathname = '/', search = ''] = (hash.slice(1) || '/').split('?');
  return { pathname, params: new URLSearchParams(search) };
}

function mine_shelf(params: URLSearchParams): Shelf {
  if (params.get('view') === 'recent') return 'recent';
  return SHELVES.find(shelf => shelf !== 'recent' && shelf === params.get('status')) ?? 'watching';
}

export function legacy_target(hash: string): string | undefined {
  return LEGACY[split(hash).pathname];
}

export function parse_route(hash: string): Route {
  const target = legacy_target(hash);
  if (target) return parse_route(target);
  const { pathname, params } = split(hash);
  if (pathname === '/') return { view: 'tonight' };
  for (const view of ['rankings', 'downloads', 'profiles'] as const) if (pathname === `/${view}`) return { view };
  const settings = /^\/settings(?:\/([a-z]+))?$/.exec(pathname);
  if (settings) return { view: 'settings', section: settings[1] ?? null };
  if (pathname === '/discover') return { view: 'discover', query: parse_discover(params) };
  if (pathname === '/mine') return { view: 'mine', shelf: mine_shelf(params) };
  if (pathname === '/search') return { view: 'search', query: params.get('q') ?? '' };
  const match = /^\/(title|watch)\/([^/]+)$/.exec(pathname);
  const id = match?.[2];
  if (id && TITLE_ID.exec(id)?.[0] === id && (match?.[1] === 'title' || match?.[1] === 'watch')) {
    return { view: match[1], id };
  }
  return { view: 'missing' };
}

function subscribe(notify: () => void) {
  window.addEventListener('hashchange', notify);
  return () => window.removeEventListener('hashchange', notify);
}

export function use_route() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);

  useEffect(() => {
    const target = legacy_target(hash);
    if (target) window.location.replace(target);
  }, [hash]);

  return parse_route(hash);
}
