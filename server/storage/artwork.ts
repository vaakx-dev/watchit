import type { Title } from '../../src/catalog/types.ts';

export function keep_artwork(title: Title, previous: Title): Title {
  if (title.id !== previous.id || title.kind !== previous.kind || title.imdb_id !== previous.imdb_id
    || title.series?.id !== previous.series?.id || title.series?.imdb_id !== previous.series?.imdb_id
    || title.season !== previous.season || title.episode !== previous.episode) return title;
  const urls = new Map<string, string>();
  const images = title.images.map(image => {
    if (image.source !== 'cinemeta' || !image.source_url || !image.role) return image;
    const ready = previous.images.find(old => old.source === 'cinemeta' && old.source_url === image.source_url
      && old.role === image.role && /^\/api\/images\/[a-f0-9]{64}\?v=[1-9]\d*$/.test(old.url));
    if (!ready) return image;
    urls.set(image.url, ready.url);
    return { ...image, url: ready.url, retrieved_at: ready.retrieved_at };
  });
  return { ...title, artwork: urls.get(title.artwork) ?? title.artwork,
    backdrop: urls.get(title.backdrop) ?? title.backdrop, images };
}
