import { createHash } from 'node:crypto';
import type { ArtworkStatus, Title } from '../../src/catalog/types.ts';
import type { Attribution } from '../attribution/types.ts';
import type { Images } from '../media/types.ts';
import { ImageError } from '../media/transport.ts';
import type { Store } from '../storage/types.ts';
import { fresh, identity, select_images } from './selection.ts';

type Check = { version?: number; identity: string; retry_at: number; error: string | null; failures?: number };
type Progress = { cursor: string; retry_at: number };
export type ArtworkOptions = { enabled?: boolean; interval_ms?: number; retry_ms?: number };
const PROGRESS_KEY = 'cinemeta:artwork:progress:v1';
const RETRY_MS = 60000;
const INTERVAL_MS = 250;
const DAY_MS = 86400000;
const CONCURRENCY = 2;
const CHECK_VERSION = 2;

function key(id: string) { return `cinemeta:artwork:download:v1:${id}`; }
function archive_key(id: string) { return `attribution:title:v1:${id}`; }
function digest(title: Title) { return createHash('sha256').update(JSON.stringify(title)).digest('hex'); }

export function create_artwork(store: Store, images: Images & { full(): boolean }, attribution: Attribution, options: ArtworkOptions = {}) {
  const enabled = options.enabled ?? true;
  const controller = new AbortController();
  const progress = store.cache_get<Progress>(PROGRESS_KEY)?.value ?? { cursor: '', retry_at: 0 };
  const priority = new Set<string>();
  const active = new Map<string, Promise<void>>();
  const interval = options.interval_ms ?? INTERVAL_MS;
  const retry_ms = options.retry_ms ?? RETRY_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let archiving: Promise<void> | undefined;
  let stopped = false;
  let idle = false;
  let error: string | null = null;

  function check(title: Title) {
    const previous = store.cache_get<Check>(key(title.id))?.value;
    return previous?.version === CHECK_VERSION && previous.identity === identity(title) ? previous : undefined;
  }

  function waiting(title: Title) {
    return (check(title)?.retry_at ?? 0) > Date.now();
  }

  function stale_titles(ids: readonly string[]) {
    const images_days = store.settings_get().images_days;
    return ids.flatMap(id => {
      const title = store.title_get(id)?.value;
      return title && !fresh(store, title, images_days) ? [title] : [];
    });
  }

  function report(ids: readonly string[] | undefined, stale: Title[] | undefined): ArtworkStatus {
    return {
      pending: enabled && !images.full() && (stale ? stale.length > 0 : Boolean(active.size || priority.size || (!idle && store.title_list('', 1).length))),
      running: ids ? ids.some(id => active.has(id)) : active.size > 0,
      error: stale ? stale.map(title => check(title)?.error).find(Boolean) ?? null : error,
    };
  }

  function status(ids?: readonly string[]): ArtworkStatus {
    return report(ids, ids && stale_titles(ids));
  }

  function schedule(delay = interval) {
    if (!enabled || stopped || timer || active.size >= CONCURRENCY) return;
    timer = setTimeout(() => {
      timer = undefined;
      try {
        fill();
      } catch (cause) {
        error = cause instanceof Error ? cause.message : 'Artwork processing failed.';
        progress.retry_at = Date.now() + retry_ms;
        store.cache_set(PROGRESS_KEY, progress);
      }
      schedule(Math.max(idle ? retry_ms : interval, progress.retry_at - Date.now()));
    }, delay);
    timer.unref();
  }

  function archived(title: Title) {
    return store.cache_get<string>(archive_key(title.id))?.value === digest(title);
  }

  async function export_title(title: Title) {
    if (archived(title)) return;
    await attribution.record(title);
    store.cache_set(archive_key(title.id), digest(title));
  }

  async function archive() {
    let cursor = '';
    while (!stopped) {
      const titles = store.title_list(cursor, 100);
      if (!titles.length) return;
      for (const entry of titles) {
        if (stopped) return;
        cursor = entry.id;
        if (archived(entry)) continue;
        const current = store.title_get(entry.id)?.value;
        if (current) await export_title(current);
      }
    }
  }

  function fill() {
    if (stopped || progress.retry_at > Date.now()) return;
    if (images.full()) {
      idle = true;
      return;
    }
    const images_days = store.settings_get().images_days;
    while (active.size < CONCURRENCY) {
      const urgent = priority.values().next().value;
      if (urgent) priority.delete(urgent);
      let title = urgent ? store.title_get(urgent)?.value : undefined;
      if (!urgent) {
        const batch = store.title_list(progress.cursor, 100);
        for (const candidate of batch) {
          progress.cursor = candidate.id;
          if (!active.has(candidate.id) && !fresh(store, candidate, images_days) && !waiting(candidate)) {
            title = candidate;
            break;
          }
        }
        if (!title) {
          idle = batch.length < 100;
          if (idle) progress.cursor = '';
          return;
        }
        store.cache_set(PROGRESS_KEY, progress);
      }
      if (!title || active.has(title.id) || fresh(store, title, images_days) || waiting(title)) continue;
      idle = false;
      const id = title.id;
      const operation = process(title).finally(() => {
        active.delete(id);
        if (timer) clearTimeout(timer);
        timer = undefined;
        schedule(0);
      });
      active.set(id, operation);
    }
  }

  function retry_at(cause: unknown, permanent: boolean, failures: number) {
    if (permanent) return Date.now() + store.settings_get().images_days * DAY_MS;
    const backoff = Math.min(retry_ms * 2 ** failures, DAY_MS);
    return Math.max(Date.now() + backoff, cause instanceof ImageError ? cause.retry_at : 0);
  }

  async function process(title: Title) {
    const fingerprint = identity(title);
    const failures = check(title)?.failures ?? 0;
    let permanent = false;
    try {
      const selected = await select_images(store, images, title, controller.signal);
      if (stopped) return;
      const current = store.title_get(title.id)?.value;
      if (!current) return;
      if (JSON.stringify(current) !== JSON.stringify(title)) { priority.add(current.id); return; }
      if (JSON.stringify({ artwork: current.artwork, backdrop: current.backdrop, images: current.images }) !== JSON.stringify(selected.patch)) {
        const updated = store.artwork_update(title.id, selected.patch);
        if (updated) await export_title(updated);
      }
      if (stopped) return;
      permanent = selected.permanent;
      if (selected.error) throw selected.error;
      store.cache_set<Check>(key(title.id), { version: CHECK_VERSION, identity: fingerprint, retry_at: 0, error: null });
      error = null;
      progress.retry_at = 0;
    } catch (cause) {
      if (stopped) return;
      error = cause instanceof Error ? cause.message : 'Artwork download failed.';
      store.cache_set<Check>(key(title.id), { version: CHECK_VERSION, identity: fingerprint, retry_at: retry_at(cause, permanent, failures), error, failures: failures + 1 });
      if (cause instanceof ImageError && cause.retry_at > progress.retry_at) {
        progress.retry_at = cause.retry_at;
        store.cache_set(PROGRESS_KEY, progress);
      }
    }
  }

  return {
    start() {
      if (!enabled || stopped) return;
      archiving ??= archive().catch((cause: unknown) => {
        if (!stopped) error = cause instanceof Error ? cause.message : 'Attribution export failed.';
      });
      schedule(0);
    },
    request(ids: readonly string[]) {
      const stale = stale_titles(ids);
      if (enabled && !stopped && !images.full()) {
        for (const title of stale) {
          if (!waiting(title)) priority.add(title.id);
        }
        if (priority.size) {
          if (timer) clearTimeout(timer);
          timer = undefined;
          idle = false;
          schedule(0);
        }
      }
      return report(ids, stale);
    },
    status,
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      controller.abort();
      await Promise.all([...active.values(), archiving]);
    },
  };
}
