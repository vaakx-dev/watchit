import { useCallback, useEffect, useState } from 'react';
import { responses } from '../cache/responses';
import { HttpError, read, request } from './client';
export { request } from './client';
import type { ArtworkStatus, CatalogEntry, CatalogPage, CatalogQuery, EpisodeNavigation, EpisodePage, ImportStatus, RelatedTitles, TitleResult } from './types';

const MAX_FAILURES = 3;

type Progress = { imports?: ImportStatus; artwork_status?: ArtworkStatus };

type Resource<T> =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: string };

export function awaiting_items(resource: Resource<Pick<CatalogPage, 'items' | 'imports'>>) {
  return resource.status === 'loading' || (resource.status === 'ready' && resource.data.items.length === 0
    && resource.data.imports?.pending === true && !resource.data.imports.error);
}

function initial<T>(url: string | null, cache: boolean): Resource<T> {
  if (!url) return { status: 'idle' };
  const data = cache ? responses.get<T>(url) : undefined;
  return data === undefined ? { status: 'loading' } : { status: 'ready', data };
}

export function use_resource<T extends object>(url: string | null, { cache = true } = {}) {
  const [revision, set_revision] = useState(0);
  const [result, set_result] = useState(() => ({ url, resource: initial<T>(url, cache), failures: 0 }));

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    set_result(previous => previous.url === url && previous.resource.status === 'ready' ? previous : { url, resource: initial<T>(url, cache), failures: 0 });
    void (cache ? read<T>(url, controller.signal) : request<T>(url, { signal: controller.signal })).then(data => {
      if (controller.signal.aborted) return;
      set_result(previous => {
        if (previous.url !== url || previous.resource.status !== 'ready' || previous.resource.data !== data) return { url, resource: { status: 'ready', data }, failures: 0 };
        return previous.failures ? { ...previous, failures: 0 } : previous;
      });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      set_result(previous => {
        const failures = previous.url === url ? previous.failures + 1 : 1;
        return previous.url === url && previous.resource.status === 'ready' && failures < MAX_FAILURES && !(error instanceof HttpError && error.status === 404)
          ? { ...previous, failures }
          : { url, resource: { status: 'error', error: error instanceof Error ? error.message : 'Could not load data.' }, failures };
      });
    });
    return () => controller.abort();
  }, [url, revision, cache]);

  const resource = result.url === url ? result.resource : initial<T>(url, cache);
  const retry = useCallback(() => set_revision(value => value + 1), []);
  return { resource, retry };
}

export function poll_delay(attempt: number, empty = false) {
  return empty ? 2500 : Math.min(1500 * 2 ** attempt, 30000);
}

export function awaiting_update(data: Progress, items: readonly Pick<CatalogEntry, 'artwork'>[]) {
  if (!items.length) return data.imports?.pending === true;
  return data.artwork_status?.pending === true && items.some(item => !item.artwork);
}

export function awaiting_refresh(data: Pick<TitleResult, 'freshness' | 'imports'>) {
  return data.freshness.stale && data.imports?.pending === true && !data.imports.error;
}

export function use_visible() {
  const [visible, set_visible] = useState(() => !document.hidden);
  useEffect(() => {
    const update = () => set_visible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
}

function page_items(data: { items: CatalogEntry[] }) {
  return data.items;
}

function title_items(data: TitleResult) {
  return [data.title];
}

export function use_import_page<T extends Progress>(url: string | null, items: (data: T) => readonly Pick<CatalogEntry, 'artwork'>[],
  refreshing: (data: T) => boolean = () => false) {
  const result = use_resource<T>(url);
  const { resource, retry } = result;
  const visible = use_visible();
  const [poll, set_poll] = useState({ url, attempt: 0 });
  const attempt = poll.url === url ? poll.attempt : 0;
  const shown = resource.status === 'ready' ? items(resource.data) : [];
  const waiting = resource.status === 'ready' && (awaiting_update(resource.data, shown) || refreshing(resource.data));
  const empty = shown.length === 0;

  useEffect(() => {
    if (!waiting || !visible) return;
    const timer = setTimeout(() => {
      set_poll({ url, attempt: empty ? 0 : attempt + 1 });
      retry();
    }, poll_delay(attempt, empty));
    return () => clearTimeout(timer);
  }, [waiting, visible, empty, poll, attempt, url, retry]);
  return result;
}

export function use_catalog(options: Partial<CatalogQuery> | null) {
  const params = new URLSearchParams();
  if (options) {
    params.set('page', String(options.page ?? 1));
    params.set('kind', options.kind ?? 'all');
    params.set('sort', options.sort ?? 'newest');
    if (options.query) params.set('query', options.query);
    if (options.genre) params.set('genre', options.genre);
    if (options.hide?.length) params.set('hide', options.hide.join(','));
  }
  return use_import_page<CatalogPage>(options ? `/api/catalog?${params}` : null, page_items);
}

export function use_title(id?: string) {
  return use_import_page<TitleResult>(id ? `/api/titles/${encodeURIComponent(id)}` : null, title_items, awaiting_refresh);
}

function related_items(data: RelatedTitles) {
  return [...data.franchise?.items ?? [], ...data.similar];
}

export function use_related(id: string) {
  return use_import_page<RelatedTitles>(`/api/titles/${encodeURIComponent(id)}/related`, related_items, data => data.pending);
}

export function use_episode_navigation(id: string | null, selection?: { season: number; page: number }) {
  const params = new URLSearchParams();
  if (selection) {
    params.set('season', String(selection.season));
    params.set('page', String(selection.page));
  }
  return use_import_page<EpisodeNavigation>(id ? `/api/titles/${encodeURIComponent(id)}/navigation?${params}` : null, page_items);
}

export function use_first_episodes(series_id: string | null) {
  return use_import_page<EpisodePage>(series_id ? `/api/titles/${encodeURIComponent(series_id)}/episodes?page=1` : null, page_items);
}
