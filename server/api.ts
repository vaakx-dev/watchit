import { createReadStream } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import type { CacheSettings } from '../src/cache/types.ts';
import { CATALOG_SORTS, type CatalogKind, type CatalogQuery } from '../src/catalog/types.ts';
import { GENRE_ID, IMDB_ID, TITLE_ID } from '../src/catalog/identity.ts';
import {
  LIBRARY_SORTS, RATINGS, SHELVES, STATUSES, type LibraryQuery, type LibrarySnapshot, type PersonalPatch, type Rating,
} from '../src/library/types.ts';
import { create_artwork } from './artwork/worker.ts';
import { create_attribution } from './attribution/index.ts';
import { CatalogError, create_catalog } from './catalog/index.ts';
import { create_sync } from './catalog/sync.ts';
import { HttpError, json, read_json } from './http.ts';
import { image_ttl } from './media/cache.ts';
import { create_images } from './media/index.ts';
import { ImageError } from './media/transport.ts';
import { with_provider_ids } from './playback/mappings.ts';
import { profile_route, session_profile, signed_in } from './profiles/routes.ts';
import { create_franchises } from './related/franchises.ts';
import { related_titles } from './related/titles.ts';
import { PinError } from './storage/pins.ts';
import { create_store } from './storage/index.ts';
import { create_torrents } from './torrents/index.ts';
import type { Hidden, Store } from './storage/types.ts';

type Services = ReturnType<typeof create_services>;
const NO_IMAGE_CACHE = 'private, no-cache';

function image_cache_control(url: URL, key: string, fetched_at: number | null | undefined, stale: boolean, images_days: number): string {
  if (stale || fetched_at === null || fetched_at === undefined || url.searchParams.get('v') !== String(fetched_at)) return NO_IMAGE_CACHE;
  const remaining = image_ttl(key, images_days) - (Date.now() - fetched_at);
  const seconds = Math.floor(remaining / 1000);
  return seconds > 0 ? `private, max-age=${seconds}, immutable` : NO_IMAGE_CACHE;
}

function create_services() {
  const store = create_store();
  const images = create_images(store);
  const enabled = process.env.STREAMIT_SYNC !== 'off';
  const attribution = create_attribution(join(store.directory, 'attribution'));
  const artwork = create_artwork(store, images, attribution, { enabled: enabled && process.env.STREAMIT_ARTWORK !== 'off' });
  const sync = create_sync(store, images, { enabled, on_titles: ids => {
    for (const id of ids) {
      const title = store.title_get(id)?.value;
      if (title) void attribution.enqueue(title);
    }
  } });
  sync.start();
  artwork.start();
  if (enabled) images.recompress();
  return { store, images, catalog: create_catalog(store), sync, artwork, attribution, franchises: create_franchises(store, { enabled }), torrents: create_torrents(store), requests: new Set<Promise<void>>() };
}

let services: Services | undefined;

function page_number(url: URL) {
  const value = url.searchParams.get('page') ?? '1';
  if (/^[1-9]\d*$/.exec(value)?.[0] !== value || Number(value) > 100000) throw new HttpError(400, 'Invalid page number.');
  return Number(value);
}

function optional_page_number(url: URL): number | undefined {
  return url.searchParams.has('page') ? page_number(url) : undefined;
}

function season_number(url: URL): number | undefined {
  const value = url.searchParams.get('season');
  if (value === null) return undefined;
  if (/^(?:0|[1-9]\d*)$/.exec(value)?.[0] !== value || Number(value) > 99999) throw new HttpError(400, 'Invalid season number.');
  return Number(value);
}

function choice<T extends string>(url: URL, name: string, choices: readonly T[], fallback: T, message: string): T {
  const value = url.searchParams.get(name) ?? fallback;
  const selected = choices.find(item => item === value);
  if (selected === undefined) throw new HttpError(400, message);
  return selected;
}

function catalog_kind(url: URL): CatalogKind {
  return choice(url, 'kind', ['all', 'movie', 'series', 'anime'], 'all', 'Invalid catalog type.');
}

function hidden(req: IncomingMessage, url: URL, store: Store): Hidden | undefined {
  const values = (url.searchParams.get('hide') ?? '').split(',').filter(Boolean);
  const statuses = values.map(value => {
    const status = STATUSES.find(item => item === value);
    if (status === undefined) throw new HttpError(400, 'hide must list want, watching, paused, watched or dropped.');
    return status;
  });
  return statuses.length ? { profile: signed_in(req, store).id, statuses } : undefined;
}

function catalog_query(url: URL): CatalogQuery {
  const sort = choice(url, 'sort', CATALOG_SORTS, 'newest', 'Invalid catalog sort.');
  const query = (url.searchParams.get('query') ?? '').trim();
  if (query.length > 200) throw new HttpError(400, 'Search is limited to 200 characters.');
  const genre = url.searchParams.get('genre') ?? '';
  if (genre && GENRE_ID.exec(genre)?.[0] !== genre) throw new HttpError(400, 'Invalid genre identifier.');
  return { page: page_number(url), query, genre, sort, kind: catalog_kind(url) };
}

function library_query(url: URL): LibraryQuery {
  return {
    shelf: choice(url, 'status', SHELVES, 'watching', 'Invalid library status.'),
    sort: choice(url, 'sort', LIBRARY_SORTS, 'recent', 'Invalid library sort.'),
    kind: catalog_kind(url),
    page: page_number(url),
  };
}

function decoded_segment(segment: string, message: string): string {
  try { return decodeURIComponent(segment); }
  catch { throw new HttpError(400, message); }
}

function title_id(segment: string): string {
  const id = decoded_segment(segment, 'Invalid title identifier.');
  if (TITLE_ID.exec(id)?.[0] !== id) throw new HttpError(400, 'Invalid title identifier.');
  return id;
}

function series_id(segment: string): string {
  const id = decoded_segment(segment, 'Invalid series identifier.');
  if (IMDB_ID.exec(id)?.[0] !== id) throw new HttpError(400, 'Invalid series identifier.');
  return id;
}

function season_coordinate(segment: string): number {
  const value = decoded_segment(segment, 'Invalid season number.');
  if (/^(?:0|[1-9]\d*)$/.exec(value)?.[0] !== value || Number(value) > 99999) {
    throw new HttpError(400, 'Invalid season number.');
  }
  return Number(value);
}

function rating_value(value: unknown): Rating | null {
  if (value === null) return null;
  const rating = RATINGS.find(rating => rating === value);
  if (rating !== undefined) return rating;
  throw new HttpError(400, 'Rating must be 0.5 to 5 in half-star steps, or null to clear it.');
}

function personal_patch(body: Record<string, unknown>): PersonalPatch {
  const patch: PersonalPatch = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === 'rating') {
      patch.rating = rating_value(value);
    } else if (key === 'status') {
      const status = value === null ? null : STATUSES.find(status => status === value);
      if (status === undefined) throw new HttpError(400, 'Status must be want, watching, paused, watched, dropped, or null.');
      patch.status = status;
    } else if (key === 'favorite' || key === 'recommended' || key === 'saved' || key === 'opened') {
      if (typeof value !== 'boolean') throw new HttpError(400, `${key} must be true or false.`);
      patch[key] = value;
    } else {
      throw new HttpError(400, `Unknown personal field: ${key}.`);
    }
  }
  return patch;
}

function season_patch(body: Record<string, unknown>): { rating: Rating | null } | { watched: boolean } {
  if (Object.keys(body).length !== 1 || !(Object.hasOwn(body, 'rating') || Object.hasOwn(body, 'watched'))) {
    throw new HttpError(400, 'Season patch must contain only a rating or a watched field.');
  }
  if (!Object.hasOwn(body, 'watched')) return { rating: rating_value(body.rating) };
  if (typeof body.watched !== 'boolean') throw new HttpError(400, 'watched must be true or false.');
  return { watched: body.watched };
}

function source_patch(body: Record<string, unknown>): string | null {
  if (!Object.hasOwn(body, 'source') || Object.keys(body).length !== 1) throw new HttpError(400, 'Body must contain only a source field.');
  if (body.source !== null && typeof body.source !== 'string') throw new HttpError(400, 'source must be a provider id or null.');
  return body.source;
}

function ranking_patch(body: Record<string, unknown>): string | null {
  if (!Object.hasOwn(body, 'before') || Object.keys(body).length !== 1) throw new HttpError(400, 'Body must contain only a before field.');
  if (body.before === null) return null;
  if (typeof body.before !== 'string') throw new HttpError(400, 'before must be a title identifier or null.');
  return title_id(body.before);
}

function settings_patch(body: Record<string, unknown>): Partial<CacheSettings> {
  const patch: Partial<CacheSettings> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key !== 'metadata_hours' && key !== 'images_days' && key !== 'max_stale_days' && key !== 'image_limit_mb') {
      throw new HttpError(400, `Unknown cache setting: ${key}.`);
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new HttpError(400, `${key} must be a finite number.`);
    patch[key] = value;
  }
  return patch;
}

function library_response(snapshot: LibrarySnapshot, { artwork, sync }: Services) {
  const ids = [...new Set([...snapshot.saved, ...snapshot.recent].map(title => title.id))];
  return { ...snapshot, artwork_status: artwork.request(ids), imports: sync.titles(ids) };
}

function same_origin(req: IncomingMessage) {
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  try { return new URL(origin).host === req.headers.host?.toLowerCase(); }
  catch { return false; }
}

async function dispatch(req: IncomingMessage, res: ServerResponse, url: URL, context: Services) {
  const { store, images, catalog, sync, artwork } = context;
  const navigation_match = /^\/api\/titles\/([^/]+)\/navigation$/.exec(url.pathname);
  const related_match = /^\/api\/titles\/([^/]+)\/related$/.exec(url.pathname);
  const id_match = /^\/api\/titles\/([^/]+)(\/episodes)?$/.exec(url.pathname);
  const personal_match = /^\/api\/library\/([^/]+)$/.exec(url.pathname);
  const season_match = /^\/api\/library\/([^/]+)\/seasons\/([^/]+)$/.exec(url.pathname);
  const playback_match = /^\/api\/library\/([^/]+)\/playback$/.exec(url.pathname);
  const ranking_match = /^\/api\/rankings\/([^/]+)$/.exec(url.pathname);
  const image_match = /^\/api\/images\/([a-f0-9]{64})$/.exec(url.pathname);
  const profile_path = /^\/api\/(?:session|profiles)(?:\/|$)/.test(url.pathname);

  if (url.pathname.startsWith('/api/torrents/')) return context.torrents.route(req, res, url);
  if (req.method === 'GET') {
    if (profile_path) return profile_route(req, res, url, store);
    if (url.pathname === '/api/catalog') {
      const query = catalog_query(url);
      const page = catalog.catalog(query, hidden(req, url, store));
      for (const item of page.items) if (!item.artwork) sync.title(item.id);
      return json(res, { ...page, imports: sync.catalog(query, page.items.length === 0), artwork_status: artwork.request(page.items.map(item => item.id)) });
    }
    if (url.pathname === '/api/trending') {
      const kind = catalog_kind(url);
      const page = store.trending_query({ kind, page: page_number(url) }, hidden(req, url, store));
      return json(res, { ...page, imports: sync.trending(kind), artwork_status: artwork.request(page.items.map(item => item.id)) });
    }
    if (url.pathname === '/api/library/titles') {
      const page = store.library_query(signed_in(req, store).id, library_query(url));
      return json(res, { ...page, artwork_status: artwork.request(page.items.map(item => item.title.id)) });
    }
    if (url.pathname === '/api/library/continue') {
      const page = store.continue_query(signed_in(req, store).id, catalog_kind(url), page_number(url));
      for (const item of page.items) if (item.title.kind === 'series') sync.episodes(item.title.id);
      return json(res, { ...page, artwork_status: artwork.request(page.items.map(item => item.title.id)) });
    }
    if (url.pathname === '/api/rankings') return json(res, store.rankings_get(signed_in(req, store).id, catalog_kind(url)));
    if (url.pathname === '/api/imports') return json(res, sync.status());
    if (url.pathname === '/api/artwork') return json(res, artwork.status());
    if (navigation_match?.[1]) {
      const id = title_id(navigation_match[1]);
      const navigation = catalog.episode_navigation(id, season_number(url), optional_page_number(url));
      return json(res, { ...navigation, imports: sync.title(id), artwork_status: artwork.request(navigation.items.map(item => item.id)) });
    }
    if (related_match?.[1]) {
      const title = catalog.imported(title_id(related_match[1])).value;
      const related = related_titles(context, title, session_profile(req, store)?.id ?? null);
      const ids = [...related.franchise?.items ?? [], ...related.similar].map(item => item.id);
      return json(res, { ...related, artwork_status: artwork.request(ids) });
    }
    if (id_match?.[1]) {
      const id = title_id(id_match[1]);
      if (id_match[2]) {
        const page = catalog.episodes(id, page_number(url));
        return json(res, { ...page, imports: sync.episodes(id), artwork_status: artwork.request(page.items.map(item => item.id)) });
      }
      const result = catalog.title(signed_in(req, store).id, id);
      return json(res, { ...result, imports: sync.title(id), artwork_status: artwork.request([id]), title: await with_provider_ids(result.title, store.directory) });
    }
    if (url.pathname === '/api/library') return json(res, library_response(store.library_get(signed_in(req, store).id), context));
    if (url.pathname === '/api/cache') return json(res, store.status());
    if (image_match?.[1]) {
      if (!store.image_get(image_match[1])) throw new HttpError(404, 'Image not found.');
      const image = await images.get(image_match[1]);
      const record = store.image_get(image_match[1]);
      const etag = `"${image_match[1]}:${record?.fetched_at}:${record?.bytes}"`;
      res.setHeader('Content-Type', image.content_type);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', image_cache_control(url, image_match[1], record?.fetched_at, image.stale, store.settings_get().images_days));
      res.setHeader('ETag', etag);
      if (image.stale) res.setHeader('X-Watchit-Stale', 'true');
      if (req.headers['if-none-match'] === etag) {
        res.statusCode = 304;
        res.end();
        return;
      }
      const stream = createReadStream(image.path);
      stream.on('error', () => {
        if (!res.headersSent) json(res, { error: 'Cached image is unavailable.' }, 503);
        else res.destroy();
      });
      stream.pipe(res);
      return;
    }
  } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
    if (!same_origin(req)) throw new HttpError(403, 'Cross-origin requests are not allowed.');
    if (profile_path) return profile_route(req, res, url, store);
    if (req.method !== 'PATCH') throw new HttpError(404, 'API route not found.');
    if (url.pathname === '/api/cache') {
      store.settings_update(settings_patch(await read_json(req)));
      return json(res, store.status());
    }
    if (playback_match?.[1]) {
      const id = title_id(playback_match[1]);
      const profile = signed_in(req, store).id;
      const source = source_patch(await read_json(req));
      if (!store.catalog_get(id)) catalog.imported(id);
      return json(res, store.playback_update(profile, id, source));
    }
    if (ranking_match?.[1]) {
      const id = title_id(ranking_match[1]);
      return json(res, store.ranking_move(signed_in(req, store).id, id, ranking_patch(await read_json(req)), catalog_kind(url)));
    }
    if (season_match?.[1] && season_match[2]) {
      const profile = signed_in(req, store).id;
      const id = series_id(season_match[1]);
      const season = season_coordinate(season_match[2]);
      const entry = store.catalog_get(id);
      if (!entry || entry.kind !== 'series') throw new HttpError(404, 'Series catalog entry not found.');
      const change = season_patch(await read_json(req));
      if ('rating' in change) return json(res, library_response(store.season_update(profile, id, season, change.rating), context));
      if (sync.episodes(id).pending) {
        res.setHeader('Retry-After', 2);
        throw new HttpError(409, 'Episodes for this season are still importing. Try again shortly.');
      }
      return json(res, library_response(store.season_watched(profile, id, season, change.watched), context));
    }
    if (personal_match?.[1]) {
      const profile = signed_in(req, store).id;
      const id = title_id(personal_match[1]);
      const patch = personal_patch(await read_json(req));
      if (!store.catalog_get(id)) catalog.imported(id);
      return json(res, library_response(store.personal_update(profile, id, patch), context));
    }
  } else {
    res.setHeader('Allow', 'GET, POST, PUT, PATCH, DELETE');
    throw new HttpError(405, 'Only GET, POST, PUT, PATCH and DELETE are supported.');
  }
  throw new HttpError(404, 'API route not found.');
}

export function handle_api(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url ?? '/', 'http://watchit.local');
  if (!url.pathname.startsWith('/api/')) return next();
  void (async () => {
    const context = services ??= create_services();
    const operation = dispatch(req, res, url, context);
    context.requests.add(operation);
    try { await operation; }
    finally { context.requests.delete(operation); }
  })().catch((error: unknown) => {
    if (res.writableEnded || res.destroyed) return;
    const status = error instanceof Error && 'status' in error && typeof error.status === 'number'
      ? error.status : error instanceof RangeError || error instanceof SyntaxError ? 400 : 500;
    if (error instanceof CatalogError && error.retry_after !== undefined) res.setHeader('Retry-After', error.retry_after);
    if (error instanceof PinError && error.retry_after !== undefined) res.setHeader('Retry-After', error.retry_after);
    if (error instanceof ImageError && error.retry_at > Date.now()) res.setHeader('Retry-After', Math.ceil((error.retry_at - Date.now()) / 1000));
    json(res, { error: error instanceof Error ? error.message : 'Request failed.' }, status);
  });
}

export async function close_services() {
  const previous = services;
  services = undefined;
  if (!previous) return;
  await Promise.all([previous.sync.stop(), previous.artwork.stop(), previous.images.stop(), previous.franchises.stop(), previous.torrents.close()]);
  await previous.attribution.stop();
  await Promise.allSettled([...previous.requests]);
  previous.store.close();
}
