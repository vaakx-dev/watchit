import { afterEach, expect, it, vi } from 'vitest';
import { create_transport, ImageError } from './transport.ts';

const POSTER = 'https://images.metahub.space/poster/small/tt0133093/img';
const BACKDROP = 'https://images.metahub.space/background/medium/tt0903747/img';
const EPISODE = 'https://episodes.metahub.space/tt0903747/1/1/w780.jpg';
const TMDB = 'https://image.tmdb.org/t/p/w780/example.jpg';
const NOW = Date.UTC(2026, 0, 1);
const signal = new AbortController().signal;

afterEach(() => vi.restoreAllMocks());

it.each([
  { status: 429, header: '120', delay: 120000 },
  { status: 503, header: new Date(NOW + 180000).toUTCString(), delay: 180000 },
  { status: 429, header: undefined, delay: 60000 },
  { status: 429, header: 'invalid', delay: 60000 },
  { status: 429, header: '-1', delay: 60000 },
])('pauses different keys on one origin for $status with Retry-After $header', async ({ status, header, delay }) => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(NOW);
  const cancel = vi.fn();
  const fetch_image = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(new ReadableStream({ cancel }), { status, headers: header ? { 'Retry-After': header } : {} }))
    .mockImplementation(async () => new Response('image'));
  const request = create_transport(fetch_image);
  await expect(request(POSTER, signal)).rejects.toMatchObject({ status, origin: 'https://images.metahub.space', retry_at: NOW + delay });
  expect(cancel).toHaveBeenCalledTimes(1);
  clock.mockReturnValue(NOW + delay - 1);
  await expect(request(BACKDROP, signal)).rejects.toBeInstanceOf(ImageError);
  await expect(request(POSTER, signal)).rejects.toMatchObject({ retry_at: NOW + delay });
  expect(fetch_image).toHaveBeenCalledTimes(1);
  await request(EPISODE, signal);
  expect(fetch_image).toHaveBeenCalledTimes(2);
  clock.mockReturnValue(NOW + delay);
  await request(BACKDROP, signal);
  expect(fetch_image).toHaveBeenCalledTimes(3);
});

it('checks destination origins during redirects without extending their pause', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  const fetch_image = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 503, headers: { 'Retry-After': '120' } }))
    .mockResolvedValueOnce(new Response(null, { status: 301, headers: { Location: TMDB } }));
  const request = create_transport(fetch_image);
  await expect(request(TMDB, signal)).rejects.toMatchObject({ status: 503, retry_at: NOW + 120000 });
  await expect(request(EPISODE, signal)).rejects.toMatchObject({ origin: 'https://image.tmdb.org', retry_at: NOW + 120000 });
  expect(fetch_image.mock.calls.map(([url]) => url)).toEqual([TMDB, EPISODE]);
});

it('does not shorten a pause when an earlier concurrent request fails later', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  let release!: (response: Response) => void;
  const fetch_image = vi.fn<typeof fetch>()
    .mockImplementationOnce(() => new Promise(resolve => { release = resolve; }))
    .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '300' } }));
  const request = create_transport(fetch_image);
  const first = request(POSTER, signal);
  await expect(request(BACKDROP, signal)).rejects.toMatchObject({ retry_at: NOW + 300000 });
  release(new Response(null, { status: 503, headers: { 'Retry-After': '60' } }));
  await expect(first).rejects.toMatchObject({ retry_at: NOW + 300000 });
  await expect(request(POSTER, signal)).rejects.toMatchObject({ retry_at: NOW + 300000 });
  expect(fetch_image).toHaveBeenCalledTimes(2);
});

it('preserves shutdown cancellation while an origin is paused', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  const fetch_image = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 429 }));
  const request = create_transport(fetch_image);
  await expect(request(POSTER, signal)).rejects.toMatchObject({ status: 429 });
  const shutdown = new AbortController();
  shutdown.abort(new Error('Shutdown'));
  await expect(request(BACKDROP, shutdown.signal)).rejects.toThrow('Shutdown');
  expect(fetch_image).toHaveBeenCalledTimes(1);
});
