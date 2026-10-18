import { send } from '../../catalog/client';
import type { RecentSearches } from '../../generated/library/RecentSearches';

const URL = '/api/searches';

let current: readonly string[] | null = null;
const listeners = new Set<() => void>();

function publish(searches: readonly string[]) {
  current = searches;
  for (const listener of listeners) listener();
}

function save(operation: Promise<RecentSearches>) {
  return operation.then(data => publish(data.searches)).catch(() => undefined);
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function recent_searches() {
  return current;
}

export function set_recent_searches(searches: readonly string[]) {
  publish(searches);
}

export function remember_search(query: string) {
  return save(send<RecentSearches>(URL, 'POST', { query: query.trim() }));
}

export function forget_search(query: string) {
  if (current) publish(current.filter(search => search !== query));
  return save(send<RecentSearches>(`${URL}/${encodeURIComponent(query)}`, 'DELETE'));
}

export function clear_searches() {
  publish([]);
  return save(send<RecentSearches>(URL, 'DELETE'));
}
