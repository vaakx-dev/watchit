import { mkdir, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Attribution } from './types.ts';
import { read_json, write_atomic, write_json } from './files.ts';
import { image_records, title_record, type Credit, type ImageRecord } from './records.ts';
import { README } from './readme.ts';
import type { Title } from '../../src/catalog/types.ts';

const pending = new Map<string, Promise<void>>();
const RETRY_MS = 1000;
const RETRIES = 3;

function wait(delay: number) {
  return new Promise<void>(resolve => setTimeout(resolve, delay));
}

function same_credit(first: Credit, second: Credit) {
  return JSON.stringify({ ...first, retrieved_at: null }) === JSON.stringify({ ...second, retrieved_at: null });
}

async function prepare(location: string) {
  await Promise.all(['titles', 'images', 'manual'].map(folder => mkdir(join(location, folder), { recursive: true })));
  await Promise.all(['', 'titles', 'images'].map(async folder => {
    const directory = join(location, folder);
    for (const name of await readdir(directory)) {
      if (name.endsWith('.tmp')) await rm(join(directory, name), { force: true });
    }
  }));
  await write_atomic(join(location, 'README.md'), README);
}

export function create_attribution(directory: string): Attribution & { enqueue(title: Title): Promise<void>; stop(): Promise<void> } {
  const location = resolve(directory);
  const queue_key = process.platform === 'win32' ? location.toLowerCase() : location;
  const queued = new Map<string, Title>();
  let draining: Promise<void> | undefined;
  let prepared: Promise<void> | undefined;
  let stopped = false;
  let last_error: unknown;

  function ready() {
    return prepared ??= prepare(location).catch((error: unknown) => {
      prepared = undefined;
      throw error;
    });
  }

  async function record(title: Title) {
    const recorded_at = new Date().toISOString();
    const images = image_records(title);
    const snapshot = title_record(title, images, recorded_at);
    const operation = (pending.get(queue_key) ?? Promise.resolve()).then(async () => {
      await ready();
      for (const image of images) {
        const path = join(location, 'images', `${image.key}.json`);
        const previous = await read_json<ImageRecord>(path);
        const unchanged = JSON.stringify(previous);
        const record: ImageRecord = previous ?? {
          key: image.key,
          url: image.url,
          title_ids: [],
          first_recorded_at: recorded_at,
          last_recorded_at: recorded_at,
          credits: [],
        };
        record.title_ids = [...new Set([...record.title_ids, snapshot.id])].sort();
        const credit = record.credits.find(existing => same_credit(existing, image.credit));
        if (credit) credit.retrieved_at = image.credit.retrieved_at ?? credit.retrieved_at;
        else record.credits.push(image.credit);
        if (JSON.stringify(record) === unchanged) continue;
        record.last_recorded_at = recorded_at;
        await write_json(path, record);
      }
      const path = join(location, 'titles', `${encodeURIComponent(snapshot.id)}.json`);
      const previous = await read_json<typeof snapshot>(path);
      if (JSON.stringify({ ...previous, recorded_at }) !== JSON.stringify(snapshot)) await write_json(path, snapshot);
    });
    const settled = operation.catch(() => {});
    pending.set(queue_key, settled);
    try {
      await operation;
    } finally {
      if (pending.get(queue_key) === settled) pending.delete(queue_key);
    }
  }

  async function retry(title: Title) {
    let attempt = 0;
    while (true) {
      try {
        await record(title);
        return;
      } catch (error) {
        if (attempt++ >= RETRIES) {
          last_error = error;
          throw error;
        }
        await wait(RETRY_MS * 2 ** (attempt - 1));
      }
    }
  }

  async function drain() {
    for (const [id, title] of queued) {
      queued.delete(id);
      await retry(title).catch(() => {});
    }
    draining = undefined;
  }

  function enqueue(title: Title) {
    if (stopped) return Promise.reject(new Error('Attribution archive is stopped.'));
    queued.set(title.id, title);
    return draining ??= drain();
  }

  async function stop() {
    stopped = true;
    await draining;
    if (last_error !== undefined) {
      const error = last_error;
      last_error = undefined;
      throw error;
    }
  }

  return { record, enqueue, stop };
}
