import type { CatalogKind, CatalogQuery, ImportStatus, TrendingKind } from '../../src/catalog/types.ts';
import type { ImportedTitle, Store } from '../storage/types.ts';
import type { Images } from '../media/types.ts';
import { CatalogError, Http, type Options } from './http.ts';
import { Source, type SourceRequestOptions } from './source.ts';
import { merge_catalog } from './publication.ts';
import { DETAIL_KEY, detail_fresh } from './freshness.ts';
import { TRENDING_PAGES, TRENDING_REFRESH_MS, trending_ids } from './trending.ts';

type CatalogJob = { type: 'catalog'; query: CatalogQuery; discovery: boolean };
type JobPriority = 0 | 1 | 2;
type JobBase = {
  key: string;
  page: number;
  complete: boolean;
  updated_at: number;
  priority: JobPriority;
  retry_at: number;
  error: string | null;
};
type DetailJob = { type: 'title' | 'episodes'; id: string };
type TrendingJob = { type: 'trending'; kind: TrendingKind };
type JobData = CatalogJob | DetailJob | TrendingJob;
type Job = JobData & JobBase;
type JobInput = JobData & Omit<JobBase, 'priority' | 'retry_at' | 'error'>;
type PersistedJob = JobInput & {
  retry_at?: number;
  error?: string | null;
};
type PersistedState = { jobs?: PersistedJob[]; error?: string | null; next_retry_at?: number | null };
type State = { jobs: Job[]; error: string | null; next_retry_at: number | null };
export type SyncOptions = Options & { enabled?: boolean; batch_interval_ms?: number; on_titles?: (ids: readonly string[]) => void | Promise<void> };
const KEY = 'cinemeta:imports:v2';
const RETRY_MS = 60000;
const IDLE_INTERVAL_MS = 60000;
const DISCOVERY_REFRESH_MS = 7 * 24 * 3600000;

function default_priority(job: Pick<Job, 'type'> & Partial<Pick<CatalogJob, 'discovery'>>): JobPriority {
  if (job.type === 'catalog') return job.discovery ? 0 : 1;
  if (job.type === 'trending') return 0;
  return 2;
}

function finished_detail(job: Job): boolean {
  return (job.type === 'title' || job.type === 'episodes') && job.complete && !job.error;
}

function trending_due(job: Job): boolean {
  return job.type === 'trending' && Date.now() - job.updated_at >= TRENDING_REFRESH_MS;
}

function load_state(store: Store): State {
  const saved = store.cache_get<PersistedState>(KEY)?.value;
  return {
    jobs: (saved?.jobs ?? []).map(job => ({
      ...job,
      priority: default_priority(job),
      retry_at: job.retry_at ?? 0,
      error: job.error ?? null,
    })).filter(job => !finished_detail(job)),
    error: saved?.error ?? null,
    next_retry_at: saved?.next_retry_at ?? null,
  };
}

export function create_sync(store: Store, images: Images, options: SyncOptions = {}) {
  const enabled = options.enabled ?? true;
  const controller = new AbortController();
  const http = new Http({ ...options, request_interval_ms: options.request_interval_ms ?? 1000, signal: controller.signal });
  const source = new Source(http, images, { cache: store });
  const state = load_state(store);
  const active = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;
  let stopped = false;
  const interval = options.batch_interval_ms ?? 30000;

  function persist() { store.cache_set(KEY, state); }
  function due(job: Job) {
    const metadata_ms = store.settings_get().metadata_hours * 3600000;
    const refresh_ms = job.type === 'catalog' && job.discovery ? Math.max(DISCOVERY_REFRESH_MS, metadata_ms) : metadata_ms;
    return Date.now() - job.updated_at >= refresh_ms;
  }
  function refresh_due(job: Job) {
    if (job.type === 'catalog') return due(job);
    if (job.type === 'trending') return trending_due(job);
    const id = job.id;
    return store.cache_get(`${DETAIL_KEY}${id}`) ? !detail_fresh(store, id, job.type) : due(job);
  }
  function pending(job: Job) { return !job.complete || (job.type === 'catalog' && job.discovery && due(job)) || trending_due(job); }
  function paused() { return state.next_retry_at !== null && state.next_retry_at > Date.now(); }
  function ready(job: Job) {
    return pending(job) && !active.has(job.key) && job.retry_at <= Date.now() && (job.priority > 0 || !paused());
  }

  function insert_at_priority_tail(job: Job) {
    const index = state.jobs.findIndex(item => item.priority < job.priority);
    state.jobs.splice(index < 0 ? state.jobs.length : index, 0, job);
  }

  function rotate(job: Job) {
    const index = state.jobs.indexOf(job);
    if (index < 0) return;
    state.jobs.splice(index, 1);
    insert_at_priority_tail(job);
  }

  function demote(job: Job) {
    const priority = default_priority(job);
    if (job.priority === priority) return;
    job.priority = priority;
    rotate(job);
  }

  function prune() { state.jobs = state.jobs.filter(job => !finished_detail(job)); }

  function next_job(current?: Job): Job | undefined {
    let selected: Job | undefined;
    for (const job of state.jobs) {
      if (!ready(job) || (current && job.key === current.key)) continue;
      if (current) {
        if (job.priority <= current.priority) continue;
      }
      if (!selected || job.priority > selected.priority) selected = job;
    }
    return selected;
  }

  async function yield_to_priority(current: Job) {
    if (stopped) return;
    await Promise.resolve();
    const next = next_job(current);
    if (next) await run_job(next);
  }

  function request_options(job: Job): SourceRequestOptions {
    return {
      priority: job.priority > 0 ? 'interactive' : 'background',
      before_request: () => yield_to_priority(job),
    };
  }

  function status(key?: string): ImportStatus {
    const jobs = state.jobs.filter(job => !key || job.key === key);
    const blocked = paused() && (!key || jobs.some(job => job.priority === 0));
    const error = jobs.map(job => job.error).find(Boolean) ?? (!key || blocked ? state.error : null);
    const retries = jobs.map(job => job.retry_at).filter(retry_at => retry_at > Date.now());
    const retry_at = retries.length ? Math.min(...retries) : 0;
    const next_retry_at = Math.max(retry_at, blocked ? state.next_retry_at ?? 0 : 0);
    return {
      enabled,
      pending: enabled && jobs.some(pending),
      running: enabled && (key ? active.has(key) : active.size > 0),
      imported: store.catalog_count(),
      error,
      next_retry_at: next_retry_at > Date.now() ? new Date(next_retry_at).toISOString() : null,
    };
  }

  function wake(priority: JobPriority) {
    if (!enabled || stopped || running) return;
    if (priority > 0 && timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (!timer) schedule(priority > 0 ? 0 : interval);
  }

  function ensure(job: JobInput, priority: JobPriority) {
    if (!enabled || stopped) return;
    const existing = state.jobs.find(item => item.key === job.key);
    let wake_needed = false;
    if (!existing) {
      insert_at_priority_tail({ ...job, priority, retry_at: 0, error: null });
      persist();
      wake_needed = true;
    } else {
      let changed = false;
      if (priority > existing.priority) {
        existing.priority = priority;
        state.jobs.splice(state.jobs.indexOf(existing), 1);
        insert_at_priority_tail(existing);
        changed = true;
        wake_needed = true;
      }
      if (existing.complete && refresh_due(existing)) {
        existing.complete = false;
        existing.page = 1;
        existing.retry_at = 0;
        existing.error = null;
        changed = true;
        wake_needed = true;
      }
      if (changed) persist();
    }
    if (wake_needed || (!timer && !running && existing && pending(existing))) wake(priority);
  }

  function snapshot(id: string) { return JSON.stringify(store.title_get(id)?.value); }

  async function publish(job: Job, items: readonly ImportedTitle[], details: boolean, verified_at = Date.now()) {
    if (!items.length) return;
    const ids = items.map(item => item.title.id);
    const previous = ids.map(snapshot);
    store.title_put(items);
    const retrying = job.error !== null;
    const changed = ids.filter((id, index) => retrying || snapshot(id) !== previous[index]);
    if (changed.length) await options.on_titles?.(changed);
    if (details) {
      for (const item of items) store.cache_set(`${DETAIL_KEY}${item.title.id}`, { kind: item.title.kind, verified_at });
      const published = new Set(ids);
      for (const other of state.jobs) {
        if ((other.type === 'title' || other.type === 'episodes') && published.has(other.id) && detail_fresh(store, other.id, other.type)) {
          other.complete = true;
          other.updated_at = Date.now();
          other.retry_at = 0;
          other.error = null;
        }
      }
    }
  }

  function origin_failure(error: unknown) {
    return error instanceof CatalogError && ![400, 404].includes(error.status);
  }

  async function run_job(job: Job) {
    if (stopped || !ready(job)) return;
    active.add(job.key);
    let publishing = false;
    try {
      if (job.complete) {
        job.page = 1;
        job.complete = false;
      }
      const requests = request_options(job);
      if (job.type === 'catalog') {
        const result = await source.with_request_options(requests, () => source.catalog({ ...job.query, page: job.page }));
        if (stopped) return;
        publishing = true;
        await publish(job, result.titles.map(item => merge_catalog(item, store.title_get(item.title.id)?.value)), false);
        for (const item of result.titles) {
          const missing_filter = job.query.query.length > 0 && (
            (job.query.kind === 'anime' && !item.present.includes('anime'))
            || (job.query.genre.length > 0 && !item.present.includes('genres'))
          );
          if (!missing_filter || detail_fresh(store, item.title.id)) continue;
          if (stopped) return;
          publishing = false;
          const detail = await source.with_request_options(requests, () => source.title(item.title.id, item.title.kind === 'movie' ? 'movie' : 'series')).catch((error: unknown) => {
            if (error instanceof CatalogError && error.status === 404) return null;
            throw error;
          });
          if (!detail) continue;
          if (stopped) return;
          publishing = true;
          await publish(job, detail.titles, true, detail.verified_at);
        }
        job.complete = !result.has_next;
      } else if (job.type === 'trending') {
        const ids: string[] = [];
        for (let page = 1; page <= TRENDING_PAGES; page++) {
          const result = await source.with_request_options(requests, () => source.catalog({ kind: job.kind, page, query: '', genre: '', sort: 'trending' }));
          if (stopped) return;
          publishing = true;
          const items = result.titles.map(item => merge_catalog(item, store.title_get(item.title.id)?.value));
          await publish(job, items, false);
          publishing = false;
          ids.push(...trending_ids(items, job.kind));
          if (!result.has_next) break;
        }
        store.trending_put(job.kind, [...new Set(ids)]);
        job.complete = true;
      } else {
        const id = job.id;
        const record = store.title_get(id)?.value;
        const kind = job.type === 'episodes' ? 'series' : record?.kind === 'movie' || record?.kind === 'series' ? record.kind : undefined;
        if (!detail_fresh(store, id, job.type)) {
          const result = await source.with_request_options(requests, () => source.title(id, kind));
          if (stopped) return;
          publishing = true;
          await publish(job, result.titles, true, result.verified_at);
        }
        job.complete = true;
      }
      job.page++;
      job.updated_at = Date.now();
      job.error = null;
      job.retry_at = 0;
      if (!state.jobs.some(item => item !== job && item.error)) state.error = null;
      demote(job);
      rotate(job);
      prune();
      persist();
    } catch (error) {
      if (!publishing && stopped && error instanceof Error && error.name === 'AbortError') return;
      const message = error instanceof Error ? error.message : 'Catalog import failed.';
      job.error = message;
      state.error = message;
      if (!publishing && error instanceof CatalogError && [400, 404].includes(error.status)) {
        job.complete = true;
        job.updated_at = Date.now();
        job.retry_at = 0;
      } else if (origin_failure(error)) {
        const retry_after = error instanceof CatalogError ? error.retry_after ?? 0 : 0;
        job.retry_at = Date.now() + Math.max(RETRY_MS, retry_after * 1000);
        state.next_retry_at = Math.max(state.next_retry_at ?? 0, job.retry_at);
      } else {
        job.retry_at = Date.now() + RETRY_MS;
      }
      demote(job);
      persist();
    } finally {
      active.delete(job.key);
    }
  }

  function next_delay() {
    const now = Date.now();
    const next = next_job();
    if (next && next.priority > 0) return 0;
    if (state.next_retry_at && state.next_retry_at > now) return state.next_retry_at - now;
    if (next) return interval;
    const retry = state.jobs
      .filter(job => pending(job) && job.retry_at > now)
      .map(job => job.retry_at)
      .sort((left, right) => left - right)[0];
    return retry ? retry - now : IDLE_INTERVAL_MS;
  }

  function schedule(delay = interval) {
    if (!enabled || stopped || timer || running) return;
    timer = setTimeout(() => {
      timer = undefined;
      const task = Promise.resolve().then(async () => {
        if (state.next_retry_at && state.next_retry_at <= Date.now()) {
          state.next_retry_at = null;
          persist();
        }
        const processed = new Set<string>();
        while (!stopped) {
          const job = next_job();
          if (!job || job.priority === 0 || processed.has(job.key)) break;
          processed.add(job.key);
          await run_job(job);
        }
        if (!stopped && !processed.size) {
          const job = next_job();
          if (job) await run_job(job);
        }
      });
      running = task.catch((error: unknown) => {
        if (stopped) return;
        state.error = error instanceof Error ? error.message : 'Catalog import failed.';
        state.next_retry_at = Date.now() + RETRY_MS;
        persist();
      }).finally(() => {
        running = undefined;
        if (!stopped) schedule(next_delay());
      });
    }, Math.max(0, delay));
    timer.unref();
  }

  function detail(id: string, type: 'title' | 'episodes') {
    const key = `${type}:${id}`;
    const known = store.catalog_get(id);
    if (type === 'episodes' && (id.includes(':') || (known && known.kind !== 'series'))) return status(key);
    if (!detail_fresh(store, id, type)) {
      ensure({ key, type, id, page: 1, complete: false, updated_at: 0 }, 2);
    }
    return status(key);
  }

  function jobs_status(keys: ReadonlySet<string>): ImportStatus {
    const jobs = state.jobs.filter(job => keys.has(job.key));
    return { ...status(), pending: enabled && jobs.some(pending), running: enabled && jobs.some(job => active.has(job.key)) };
  }

  function browse_status(empty: boolean, key?: string): ImportStatus {
    const result = status(key);
    return { ...result, pending: empty && result.pending };
  }

  return {
    start() {
      if (!enabled || stopped) return;
      for (const kind of ['movie', 'series', 'anime'] as const) {
        ensure({ key: `discover:${kind}`, type: 'catalog', discovery: true,
          query: { kind, page: 1, query: '', genre: '', sort: 'newest' }, page: 1, complete: false, updated_at: 0 }, 0);
        ensure({ key: `trending:${kind}`, type: 'trending', kind, page: 1, complete: false, updated_at: 0 }, 0);
      }
      if (timer) { clearTimeout(timer); timer = undefined; }
      if (!running) schedule(0);
    },
    catalog(query: CatalogQuery, empty: boolean) {
      if (!query.query.trim() && !query.genre) {
        if (query.kind !== 'anime') return browse_status(empty);
        const key = 'discover:anime';
        ensure({ key, type: 'catalog', discovery: true, query: { ...query, page: 1 }, page: 1, complete: false, updated_at: 0 }, empty ? 1 : 0);
        return browse_status(empty, key);
      }
      const normalized = { ...query, query: query.query.trim(), page: 1, sort: 'newest' as const };
      const key = `search:${JSON.stringify([normalized.kind, normalized.query, normalized.genre])}`;
      ensure({ key, type: 'catalog', discovery: false, query: normalized, page: 1, complete: false, updated_at: 0 }, 1);
      return status(key);
    },
    title(id: string) { return detail(id, 'title'); },
    episodes(id: string) { return detail(id, 'episodes'); },
    titles(ids: readonly string[]) { return jobs_status(new Set(ids.map(id => `title:${id}`))); },
    trending(kind: CatalogKind) {
      return jobs_status(new Set(kind === 'all' ? ['trending:movie', 'trending:series'] : [`trending:${kind}`]));
    },
    status,
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      controller.abort();
      await running;
    },
  };
}
