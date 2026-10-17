import type { ImageCredit, Title } from '../../src/catalog/types.ts';
import { TITLE_ID } from '../../src/catalog/identity.ts';

export type Credit = {
  source: ImageCredit['source'] | null;
  role: ImageCredit['role'] | null;
  source_url: string | null;
  description_url: string | null;
  author: string | null;
  license: string | null;
  license_url: string | null;
  terms_url: string | null;
  retrieved_at: string | null;
};

export type ImageRecord = {
  key: string;
  url: string;
  title_ids: string[];
  first_recorded_at: string;
  last_recorded_at: string;
  credits: Credit[];
};

function public_url(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function credit_record(credit?: ImageCredit): Credit {
  return {
    source: credit?.source ?? null,
    role: credit?.role ?? null,
    source_url: public_url(credit?.source_url),
    description_url: public_url(credit?.description_url),
    author: credit?.author || null,
    license: credit?.license || null,
    license_url: public_url(credit?.license_url),
    terms_url: public_url(credit?.terms_url),
    retrieved_at: credit?.retrieved_at || null,
  };
}

function local_image(value: string): { key: string; url: string } | null {
  const pathname = value.split(/[?#]/, 1)[0] ?? '';
  const match = /^\/api\/images\/([a-f0-9]{64})$/.exec(pathname);
  const key = match?.[1];
  return key && match?.[0] === pathname ? { key, url: pathname } : null;
}

export function image_records(title: Title): { key: string; url: string; credit: Credit }[] {
  const entries = title.images.flatMap(credit => {
    const image = local_image(credit.url);
    return image ? [{ ...image, credit: credit_record(credit) }] : [];
  });
  for (const url of [title.artwork, title.backdrop]) {
    const image = local_image(url);
    if (image && !entries.some(entry => entry.key === image.key)) entries.push({ ...image, credit: credit_record() });
  }
  return entries;
}

export function title_record(title: Title, images: ReturnType<typeof image_records>, recorded_at: string) {
  if (TITLE_ID.exec(title.id)?.[0] !== title.id) throw new RangeError('Invalid attribution title ID');
  return {
    id: title.id,
    recorded_at,
    metadata: {
      source: 'cinemeta',
      source_url: public_url(title.source_url),
      license: null,
      license_url: null,
      title: title.title,
      year: title.year,
      kind: title.kind,
      anime: title.anime,
      genres: [...title.genres],
      minutes: title.minutes,
      synopsis: title.synopsis,
      director: title.director,
      cast: title.cast,
      imdb_id: title.imdb_id,
      tmdb_id: title.tmdb_id,
      season: title.season,
      episode: title.episode,
      series: title.series ? { id: title.series.id, title: title.series.title } : null,
    },
    artwork: local_image(title.artwork)?.url ?? null,
    backdrop: local_image(title.backdrop)?.url ?? null,
    images: [...new Map(images.map(image => [image.key, { key: image.key, url: image.url }])).values()],
  };
}
