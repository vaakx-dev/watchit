import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Http } from './http.ts';

const START = Date.UTC(2026, 0, 1);
const endpoint = 'https://v3-cinemeta.strem.io/catalog/movie/top.json';
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(START); });
afterEach(() => { vi.useRealTimers(); });

describe('Cinemeta request queue', () => {
  it('retries a short cooldown then serves queued requests in order', async () => {
    const times: number[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      times.push(Date.now() - START);
      return times.length === 1 ? new Response('', { status: 429, headers: { 'Retry-After': '5' } }) : Response.json({ ok: true });
    });
    const http = new Http({ fetch: fetcher });
    const result = Promise.all([http.get(endpoint), http.get(endpoint), http.get(endpoint)]);
    await vi.advanceTimersByTimeAsync(7000);
    await expect(result).resolves.toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(times).toEqual([0, 5000, 6000, 7000]);
  });

  it('prioritizes interactive requests while preserving FIFO within each priority', async () => {
    let release!: () => void;
    const first = new Promise<Response>(resolve => { release = () => resolve(Response.json({ id: 'first' })); });
    const order: string[] = [];
    const fetcher = vi.fn<typeof fetch>()
      .mockImplementationOnce(async () => { order.push('first'); return first; })
      .mockImplementation(async input => { order.push(new URL(String(input)).searchParams.get('id')!); return Response.json({ ok: true }); });
    const http = new Http({ fetch: fetcher, request_interval_ms: 0 });
    const first_request = http.get(`${endpoint}?id=first`, 'background');
    await Promise.resolve();
    const second_request = http.get(`${endpoint}?id=second`, 'background');
    const interactive = http.get(`${endpoint}?id=interactive`, 'interactive');
    release();
    await vi.advanceTimersByTimeAsync(0);
    await expect(Promise.all([first_request, second_request, interactive])).resolves.toHaveLength(3);
    expect(order).toEqual(['first', 'interactive', 'second']);
  });

  it('honors an HTTP-date Retry-After', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': new Date(START + 12000).toUTCString() } }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    const result = new Http({ fetch: fetcher }).get(endpoint);
    await vi.advanceTimersByTimeAsync(11999);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual({ ok: true });
  });

  it('stops after three attempts and retains retry information', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response('', { status: 503 }));
    const failure = expect(new Http({ fetch: fetcher }).get(endpoint)).rejects.toMatchObject({
      status: 503, retry_after: 20, message: 'Cinemeta request failed (HTTP 503).',
    });
    await vi.runAllTimersAsync();
    await failure;
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(Date.now() - START).toBe(15000);
  });

  it('does not hold the queue during a cooldown longer than the total request budget', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response('', { status: 429, headers: { 'Retry-After': '120' } }));
    const http = new Http({ fetch: fetcher });
    const failures = Promise.all([
      expect(http.get(endpoint)).rejects.toMatchObject({ status: 503, retry_after: 120 }),
      expect(http.get(endpoint)).rejects.toMatchObject({ status: 503, retry_after: 120 }),
    ]);
    await vi.runAllTimersAsync();
    await failures;
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(Date.now()).toBe(START);
  });

  it('retains terminal HTTP status without retrying', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 404 }));
    await expect(new Http({ fetch: fetcher }).get(endpoint)).rejects.toMatchObject({ status: 404 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('cancels a cooldown and queued work without another request', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response('', { status: 429 }));
    const http = new Http({ fetch: fetcher, signal: controller.signal });
    const failures = Promise.all([
      expect(http.get(endpoint)).rejects.toMatchObject({ name: 'AbortError' }),
      expect(http.get(endpoint)).rejects.toMatchObject({ name: 'AbortError' }),
    ]);
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await failures;
    await vi.runAllTimersAsync();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('retries connection errors with backoff and retains the underlying error for diagnosis', async () => {
    const failure = new TypeError('fetch failed', { cause: new Error('certificate verification failed') });
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(failure);
    const result = expect(new Http({ fetch: fetcher }).get(endpoint)).rejects.toMatchObject({
      status: 503, message: 'Cinemeta request failed: certificate verification failed.', cause: expect.objectContaining({ cause: failure }),
    });
    await vi.runAllTimersAsync();
    await result;
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(Date.now() - START).toBe(15000);
  });

  it('recovers from a transient connection error', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValue(Response.json({ ok: true }));
    const result = new Http({ fetch: fetcher }).get(endpoint);
    await vi.advanceTimersByTimeAsync(5000);
    await expect(result).resolves.toEqual({ ok: true });
  });

  it('starts the request budget when a queued request is dequeued', async () => {
    let release!: () => void;
    const fetcher = vi.fn<typeof fetch>()
      .mockImplementationOnce(() => new Promise(resolve => { release = () => resolve(Response.json({ id: 'first' })); }))
      .mockResolvedValue(Response.json({ id: 'second' }));
    const http = new Http({ fetch: fetcher, request_interval_ms: 0 });
    const first = http.get(endpoint);
    const second = http.get(endpoint);
    await vi.advanceTimersByTimeAsync(60000);
    release();
    await vi.advanceTimersByTimeAsync(0);
    await expect(Promise.all([first, second])).resolves.toEqual([{ id: 'first' }, { id: 'second' }]);
  });
});
