import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rename, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { image_path } from '../storage/paths.ts';
import type { ImageRecord, Store } from '../storage/types.ts';
import { download_image, MAX_IMAGE_BYTES, remove_file } from './download.ts';
import { encode_image } from './encode.ts';
import { create_scheduler } from './scheduler.ts';
import type { CachedImage, Images, Priority } from './types.ts';
import { create_transport, ImageError } from './transport.ts';
import { image_url } from './urls.ts';

export type ImageOptions = { fetch?: typeof fetch; signal?: AbortSignal };
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MB = 1024 * 1024;
const FULL = 0.9;
const EXPIRY_JITTER = 0.2;
const EVICTION_BATCH = 1000;
const RECOMPRESS_BATCH = 20;
const RECOMPRESS_DELAY_MS = 1000;

export function image_ttl(key: string, images_days: number): number {
  return images_days * DAY_MS * (1 - EXPIRY_JITTER * parseInt(key.slice(0, 8), 16) / 0xffffffff);
}

async function resident(path: string, record: ImageRecord): Promise<boolean> {
  if (record.fetched_at === null || !record.content_type || record.bytes <= 0) return false;
  try {
    const file = await stat(path);
    return file.isFile() && file.size === record.bytes;
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'EACCES')) return false;
    throw error;
  }
}

export function create_images(store: Store, options: ImageOptions = {}): Images & { full(): boolean; recompress(): void; stop(): Promise<void> } {
  const controller = new AbortController();
  const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
  const request = create_transport(options.fetch ?? globalThis.fetch);
  const scheduler = create_scheduler(signal);
  const pending = new Map<string, Promise<CachedImage>>();
  const priorities = new Map<string, Priority>();
  let commits: Promise<void> = Promise.resolve();
  let used: number | undefined;
  let recompressing: Promise<void> | undefined;

  function commit<T>(operation: () => Promise<T>): Promise<T> {
    const result = commits.then(operation);
    commits = result.then(() => {}, () => {});
    return result;
  }

  function used_bytes() {
    return used ??= store.image_bytes();
  }

  function background(key: string) {
    return priorities.get(key) === 'background';
  }

  function touch(record: ImageRecord, stale: boolean): CachedImage {
    if (!background(record.key) && Date.now() - record.accessed_at >= HOUR_MS) store.image_put({ ...record, accessed_at: Date.now() });
    return { path: image_path(store.directory, record.key), content_type: record.content_type!, stale };
  }

  function clear(records: ImageRecord[]) {
    used = used_bytes() - records.reduce((total, record) => total + record.bytes, 0);
    store.image_clear(records.map(record => record.key));
  }

  async function make_space(key: string, growth: number): Promise<void> {
    const limit = store.settings_get().image_limit_mb * MB;
    if (growth > limit) throw new Error('Image exceeds the cache budget');
    if (used_bytes() + growth <= limit) return;
    if (background(key)) throw new Error('Image cache is full');

    while (used_bytes() + growth > limit * FULL) {
      const evicted: ImageRecord[] = [];
      let excess = used_bytes() + growth - limit * FULL;
      for (const record of store.image_lru(EVICTION_BATCH)) {
        if (excess <= 0) break;
        if (record.key === key || pending.has(record.key)) continue;
        evicted.push(record);
        excess -= record.bytes;
      }
      if (!evicted.length) break;
      await Promise.all(evicted.map(record => remove_file(image_path(store.directory, record.key))));
      clear(evicted);
    }
    if (used_bytes() + growth > limit) throw new Error('Image cache is busy or has no free space');
  }

  async function load(key: string): Promise<CachedImage> {
    signal.throwIfAborted();
    const path = image_path(store.directory, key);
    const record = store.image_get(key);
    if (!record) throw new Error('Image not found');
    const source = image_url(record.source_url);
    const settings = store.settings_get();
    const ttl = image_ttl(key, settings.images_days);
    const available = await resident(path, record);
    signal.throwIfAborted();
    const age = record.fetched_at === null ? Infinity : Date.now() - record.fetched_at;
    if (available && age >= 0 && age < ttl) return touch(record, false);
    if (!available && record.fetched_at !== null) clear([record]);
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      const downloaded = await scheduler.schedule(key, priorities.get(key) ?? 'visible', async () => {
        signal.throwIfAborted();
        await mkdir(dirname(path), { recursive: true });
        const original = await download_image(source, temporary, request, Math.min(MAX_IMAGE_BYTES, settings.image_limit_mb * MB), signal);
        signal.throwIfAborted();
        return encode_image(temporary, temporary, original.content_type);
      });
      const fetched_at = Date.now();
      return await commit(async () => {
        signal.throwIfAborted();
        const growth = downloaded.bytes - (available ? record.bytes : 0);
        await make_space(key, growth);
        await rename(temporary, path);
        used = used_bytes() + growth;
        store.image_put({ ...record, ...downloaded, fetched_at, accessed_at: background(key) ? record.accessed_at : Date.now() });
        return { path, content_type: downloaded.content_type, stale: false };
      });
    } catch (error) {
      signal.throwIfAborted();
      if (available && record.fetched_at !== null && age >= 0 && settings.max_stale_days > 0 && Date.now() - record.fetched_at <= ttl + settings.max_stale_days * DAY_MS && await resident(path, record)) {
        signal.throwIfAborted();
        return { ...touch(record, true), ...(error instanceof ImageError ? { error } : {}) };
      }
      throw error;
    } finally {
      await remove_file(temporary);
    }
  }

  async function reencode(record: ImageRecord): Promise<CachedImage> {
    const path = image_path(store.directory, record.key);
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      const encoded = await encode_image(path, temporary, record.content_type!);
      return await commit(async () => {
        signal.throwIfAborted();
        await rename(temporary, path);
        used = used_bytes() + encoded.bytes - record.bytes;
        store.image_put({ ...record, ...encoded });
        return { path, content_type: encoded.content_type, stale: false };
      });
    } finally {
      await remove_file(temporary);
    }
  }

  async function recompress_all() {
    let cursor = '';
    while (!signal.aborted) {
      const batch = store.image_unencoded(cursor, RECOMPRESS_BATCH);
      if (!batch.length) return;
      for (const { key } of batch) {
        cursor = key;
        const record = store.image_get(key);
        if (signal.aborted || pending.has(key) || !record?.content_type || record.content_type === 'image/webp' || record.fetched_at === null) continue;
        const operation = reencode(record).finally(() => {
          pending.delete(key);
          priorities.delete(key);
        });
        pending.set(key, operation);
        await operation.catch(() => {});
      }
      await sleep(RECOMPRESS_DELAY_MS, undefined, { signal });
    }
  }

  return {
    register(source_url) {
      signal.throwIfAborted();
      const source = image_url(source_url);
      const key = createHash('sha256').update(source).digest('hex');
      if (!store.image_get(key)) store.image_put({ key, source_url: source, content_type: null, bytes: 0, fetched_at: null, accessed_at: 0 });
      return `/api/images/${key}`;
    },
    get(key, priority = 'visible') {
      const existing = pending.get(key);
      if (existing) {
        if (priority === 'visible') {
          priorities.set(key, 'visible');
          scheduler.promote(key);
        }
        return existing;
      }
      priorities.set(key, priority);
      const operation = load(key).finally(() => {
        pending.delete(key);
        priorities.delete(key);
      });
      pending.set(key, operation);
      return operation;
    },
    recompress() {
      recompressing ??= recompress_all().catch(() => {});
    },
    full() {
      return used_bytes() >= store.settings_get().image_limit_mb * MB * FULL;
    },
    async stop() {
      controller.abort();
      await Promise.all([scheduler.stop(), Promise.allSettled([...pending.values()]), recompressing]);
      await commits;
    },
  };
}
