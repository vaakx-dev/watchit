import { useEffect, useSyncExternalStore } from 'react';
import { request } from '../../catalog/client';
import type { RecentSearches } from '../../generated/library/RecentSearches';
import { recent_searches, set_recent_searches, subscribe } from './api';

export function use_recent_searches() {
  const searches = useSyncExternalStore(subscribe, recent_searches);

  useEffect(() => {
    const controller = new AbortController();
    request<RecentSearches>('/api/searches', { signal: controller.signal })
      .then(data => set_recent_searches(data.searches))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return searches;
}
