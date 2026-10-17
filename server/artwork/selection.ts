import type { ImageCredit, Title } from '../../src/catalog/types.ts';
import type { Images } from '../media/types.ts';
import { image_url } from '../media/urls.ts';
import { image_ttl } from '../media/cache.ts';
import { ImageError, RedirectError } from '../media/transport.ts';
import type { Store } from '../storage/types.ts';

type Descriptor = ImageCredit & { source: 'cinemeta'; source_url: string; role: 'poster' | 'still' };

function descriptors(title: Title): Descriptor[] {
  return title.images.filter((image): image is Descriptor => image.source === 'cinemeta' && !!image.source_url && (image.role === 'poster' || image.role === 'still'));
}

function image_key(url: string) {
  return /^\/api\/images\/([a-f0-9]{64})(?:\?v=\d+)?$/.exec(url)?.[1];
}

export function identity(title: Title) {
  return JSON.stringify(descriptors(title).map(({ url: _url, retrieved_at: _retrieved_at, ...image }) => image));
}

function is_permanent(error: Error) {
  if (error instanceof RedirectError) return true;
  return error instanceof ImageError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429;
}

export function fresh(store: Store, title: Title, images_days: number) {
  return descriptors(title).every(image => {
    const key = image_key(image.url);
    const record = key ? store.image_get(key) : null;
    if (!record || record.fetched_at === null || !record.content_type || record.bytes <= 0) return false;
    try { if (record.source_url !== image_url(image.source_url)) return false; } catch { return false; }
    const age = Date.now() - record.fetched_at;
    return age >= 0 && age < image_ttl(record.key, images_days) && image.url === `/api/images/${key}?v=${record.fetched_at}`;
  });
}

export async function select_images(store: Store, images: Images, title: Title, signal: AbortSignal) {
  const replacements = new Map<ImageCredit, ImageCredit>();
  const selected = new Map<Descriptor['role'], ImageCredit>();
  let error: Error | undefined;
  let permanent = true;
  function failed(cause: unknown) {
    const failure = cause instanceof Error ? cause : new Error('Image download failed.');
    permanent &&= is_permanent(failure);
    if (!error || (failure instanceof ImageError && failure.retry_at > (error instanceof ImageError ? error.retry_at : 0))) error = failure;
  }
  for (const image of descriptors(title)) {
    signal.throwIfAborted();
    try {
      const url = images.register(image.source_url);
      const key = image_key(url);
      if (!key) throw new Error('Image registration returned an invalid local URL.');
      const cached = await images.get(key, 'background');
      signal.throwIfAborted();
      const record = store.image_get(key);
      if (record?.fetched_at === null || !record) throw new Error('Image download did not populate the cache.');
      const ready = { ...image, url: `${url}?v=${record.fetched_at}`, retrieved_at: new Date(record.fetched_at).toISOString() };
      replacements.set(image, ready);
      if (!selected.has(image.role)) selected.set(image.role, ready);
      if (cached.stale) failed(cached.error ?? new Error('Image origin unavailable. Cached artwork is stale.'));
    } catch (cause) {
      signal.throwIfAborted();
      failed(cause);
    }
  }
  const poster = selected.get('poster') ?? selected.get('still');
  const still = selected.get('still');
  return {
    patch: {
      artwork: poster?.url ?? title.artwork,
      backdrop: still?.url ?? (poster && (!title.backdrop || title.backdrop === title.artwork) ? poster.url : title.backdrop),
      images: title.images.map(image => replacements.get(image) ?? image),
    },
    error,
    permanent,
  };
}
