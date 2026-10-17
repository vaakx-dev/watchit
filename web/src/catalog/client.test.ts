import { afterEach, describe, expect, it, vi } from 'vitest';
import { remember, responses } from '../cache/responses';
import { read } from './client';

afterEach(() => vi.unstubAllGlobals());

describe('shared catalog reads', () => {
  it('shares an in-flight request and caches its result', async () => {
    const data = { items: [{ id: 'tt0133093' }] };
    const fetcher = vi.fn(async () => new Response(JSON.stringify(data)));
    vi.stubGlobal('fetch', fetcher);
    const first = read('/api/catalog?test=dedup');
    const second = read('/api/catalog?test=dedup');
    expect(first).toBe(second);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(first).resolves.toEqual(data);
    expect(responses.get('/api/catalog?test=dedup')).toEqual(data);
  });

  it('does not let a slow read replace a newer confirmed save in the reload cache', async () => {
    let complete!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { complete = resolve; })));
    const url = '/api/library?test=ordering';
    remember(url, { rating: 1 });
    const reading = read(url);
    remember(url, { rating: 5 });
    complete(new Response(JSON.stringify({ rating: 1 })));
    await reading;
    expect(responses.get(url)).toEqual({ rating: 5 });
  });

  it('returns the cached object when the payload is unchanged', async () => {
    const url = '/api/catalog?test=unchanged';
    const cached = { items: [{ id: 'tt0133093' }] };
    remember(url, cached);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(cached))));
    await expect(read(url)).resolves.toBe(cached);
  });

  it('aborts a shared request only after every reader has left', () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => {
      signals.push(options.signal!);
      return new Promise<Response>(() => {});
    }));
    const first = new AbortController();
    const second = new AbortController();
    void read('/api/catalog?test=abort', first.signal);
    void read('/api/catalog?test=abort', second.signal);
    first.abort();
    expect(signals[0]?.aborted).toBe(false);
    second.abort();
    expect(signals[0]?.aborted).toBe(true);
  });

  it('starts a fresh request for a reader that arrives after an abandoned one', async () => {
    const data = { items: [{ id: 'tt0944947:1:1' }] };
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise<Response>((resolve, reject) => {
      if (options.signal?.aborted) reject(new DOMException('Aborted', 'AbortError'));
      options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      setTimeout(() => resolve(new Response(JSON.stringify(data))), 0);
    })));
    const url = '/api/titles/tt0944947/episodes?test=remount';
    const first = new AbortController();
    const abandoned = read(url, first.signal);
    first.abort();
    await expect(abandoned).rejects.toThrow('Aborted');
    await expect(read(url, new AbortController().signal)).resolves.toEqual(data);
  });

  it('keeps serving a remaining reader when another reader leaves', async () => {
    const data = { items: [] };
    let complete!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { complete = resolve; })));
    const url = '/api/titles/tt0944947/episodes?test=shared';
    const leaving = new AbortController();
    void read(url, leaving.signal).catch(() => undefined);
    const staying = read(url, new AbortController().signal);
    leaving.abort();
    complete(new Response(JSON.stringify(data)));
    await expect(staying).resolves.toEqual(data);
  });
});
