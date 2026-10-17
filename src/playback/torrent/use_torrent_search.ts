import { useEffect, useState } from 'react';
import { request } from '../../catalog/client';
import { result_key, search_url } from './api';
import type { TorrentResult } from './types';

type Search = { results: TorrentResult[] | null; failure: string | null };

export function use_torrent_search(title_id: string | null) {
  const [search, set_search] = useState<Search>({ results: null, failure: null });
  const [chosen, set_chosen] = useState<string | null>(null);
  const [attempt, set_attempt] = useState(0);

  useEffect(() => {
    if (!title_id) return;
    const controller = new AbortController();
    set_search({ results: null, failure: null });
    request<{ results: TorrentResult[] }>(search_url(title_id), { signal: controller.signal })
      .then(data => set_search({ results: data.results, failure: null }))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        set_search({ results: null, failure: cause instanceof Error ? cause.message : 'The server did not respond.' });
      });
    return () => controller.abort();
  }, [title_id, attempt]);

  const results = title_id ? search.results ?? [] : [];
  const selected = results.find(result => result_key(result) === chosen) ?? results[0] ?? null;

  return {
    results: search.results,
    failure: search.failure,
    selected,
    choose: (result: TorrentResult) => set_chosen(result_key(result)),
    retry: () => set_attempt(value => value + 1),
  };
}
