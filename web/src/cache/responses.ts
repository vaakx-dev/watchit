import { active_session } from '../profiles/session';

const KEY = 'watchit:responses:2';
const LIMIT = 32;
const MAX_LENGTH = 1_000_000;

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

export function create_responses(storage?: Storage, profile: number | null = null) {
  const key = `${KEY}:${profile}`;
  const entries = new Map<string, unknown>();
  let loaded = false;
  let dirty = false;

  function load() {
    if (loaded) return;
    loaded = true;
    try {
      const saved = storage?.getItem(key);
      if (saved) for (const [url, value] of (JSON.parse(saved) as [string, unknown][]).slice(-LIMIT)) entries.set(url, value);
    } catch {
      entries.clear();
    }
  }

  return {
    get<T>(url: string): T | undefined {
      load();
      const value = entries.get(url);
      if (value !== undefined) {
        entries.delete(url);
        entries.set(url, value);
      }
      return value as T | undefined;
    },
    set(url: string, value: unknown) {
      load();
      entries.delete(url);
      entries.set(url, value);
      if (entries.size > LIMIT) entries.delete(entries.keys().next().value!);
      dirty = true;
    },
    delete(url: string) {
      load();
      dirty = entries.delete(url) || dirty;
    },
    flush() {
      if (!storage || !dirty) return;
      dirty = false;
      const saved: string[] = [];
      let length = 2;
      for (const entry of [...entries].reverse()) {
        const json = JSON.stringify(entry);
        if (length + json.length + 1 > MAX_LENGTH) continue;
        saved.unshift(json);
        length += json.length + 1;
      }
      try { storage.setItem(key, `[${saved.join(',')}]`); } catch { /* Browser caching is optional. */ }
    },
  };
}

function browser_storage() {
  try { return typeof window === 'undefined' ? undefined : window.sessionStorage; }
  catch { return undefined; }
}

export const responses = create_responses(browser_storage(), active_session?.profile ?? null);
const FLUSH_DELAY = 2000;
let timer: ReturnType<typeof setTimeout> | undefined;

export function remember(url: string, value: unknown) {
  responses.set(url, value);
  if (typeof window === 'undefined') return;
  clearTimeout(timer);
  timer = setTimeout(() => responses.flush(), FLUSH_DELAY);
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', () => responses.flush());
