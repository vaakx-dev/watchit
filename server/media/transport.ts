import { image_url } from './urls.ts';

const MAX_REDIRECTS = 3;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const RATE_LIMIT_MS = 60000;

export class ImageError extends Error {
  constructor(readonly origin: string, readonly status: number, readonly retry_at: number) {
    super(`Image origin returned ${status}`);
    this.name = 'ImageError';
  }
}

export class RedirectError extends Error {
  constructor(status: number, detail: string) {
    super(`Image origin returned ${status}: ${detail}`);
    this.name = 'RedirectError';
  }
}

export type Transport = (source: string, signal: AbortSignal) => Promise<Response>;

function retry_at(response: Response) {
  const now = Date.now();
  const value = response.headers.get('retry-after')?.trim();
  if (value) {
    let time = NaN;
    if (/^\d+(?:\.\d+)?$/.test(value)) time = now + Number(value) * 1000;
    else if (/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i.test(value)) time = Date.parse(value);
    if (Number.isFinite(time)) return Math.max(now, time);
  }
  return response.status === 429 ? now + RATE_LIMIT_MS : 0;
}

export function create_transport(fetch_image: typeof fetch): Transport {
  const pauses = new Map<string, ImageError>();

  return async (source, signal) => {
    let url = image_url(source);
    for (let redirects = 0; ; redirects++) {
      signal.throwIfAborted();
      const origin = new URL(url).origin;
      const paused = pauses.get(origin);
      if (paused && paused.retry_at > Date.now()) throw paused;
      pauses.delete(origin);
      const response = await fetch_image(url, {
        redirect: 'manual',
        credentials: 'omit',
        signal,
        headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif', 'User-Agent': 'Watchit/0.1 (local image cache)' },
      });
      try {
        signal.throwIfAborted();
        if (response.redirected || (response.url && image_url(response.url) !== url)) throw new Error(`Image origin returned ${response.status}`);
        if (!REDIRECTS.has(response.status)) {
          if (response.ok) return response;
          const failure = new ImageError(origin, response.status, retry_at(response));
          const current = pauses.get(origin);
          if (current && current.retry_at > failure.retry_at) throw current;
          if (failure.retry_at > Date.now()) pauses.set(origin, failure);
          throw failure;
        }
        const location = response.headers.get('location');
        if (!location || redirects >= MAX_REDIRECTS) throw new RedirectError(response.status, 'redirect limit or missing location');
        try { url = image_url(location, url); } catch { throw new RedirectError(response.status, 'unsafe redirect'); }
      } catch (error) {
        await response.body?.cancel().catch(() => {});
        throw error;
      }
      await response.body?.cancel();
    }
  };
}
