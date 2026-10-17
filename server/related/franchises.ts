import type { CacheRecord, Store } from '../storage/types.ts';
import { fetch_franchise, type Franchise } from './wikidata.ts';

const KEY = 'wikidata:franchise:v1:';
const DAY_MS = 24 * 3600000;
const FOUND_MS = 30 * DAY_MS;
const MISSING_MS = 7 * DAY_MS;
const FAILED_MS = 3600000;
const GAP_MS = 1000;

type Cached = Franchise & { failed?: boolean };

function fresh({ value, updated_at }: CacheRecord<Cached>) {
  const lifetime = value.failed ? FAILED_MS : value.ids.length ? FOUND_MS : MISSING_MS;
  return Date.now() - updated_at < lifetime;
}

export function create_franchises(store: Store, options: { enabled: boolean }) {
  const controller = new AbortController();
  const queue: string[] = [];
  let running: Promise<void> | undefined;

  async function refresh(imdb_id: string) {
    const previous = store.cache_get<Cached>(`${KEY}${imdb_id}`)?.value;
    const value: Cached = await fetch_franchise(imdb_id, controller.signal)
      .catch(() => ({ name: previous?.name ?? null, ids: previous?.ids ?? [], failed: true }));
    if (!controller.signal.aborted) store.cache_set(`${KEY}${imdb_id}`, value);
  }

  async function drain() {
    while (queue.length && !controller.signal.aborted) {
      await refresh(queue[0]!);
      queue.shift();
      await new Promise(resolve => setTimeout(resolve, GAP_MS));
    }
  }

  return {
    get(imdb_id: string): { franchise: Franchise | null; pending: boolean } {
      const record = store.cache_get<Cached>(`${KEY}${imdb_id}`);
      if (options.enabled && !(record && fresh(record)) && !queue.includes(imdb_id)) {
        queue.push(imdb_id);
        running ??= drain().finally(() => { running = undefined; });
      }
      return { franchise: record?.value ?? null, pending: options.enabled && !record };
    },
    async stop() {
      controller.abort();
      await running;
    },
  };
}
