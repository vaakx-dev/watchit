import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { TITLE_ID } from '../../src/catalog/identity.ts';
import { HttpError, json } from '../http.ts';
import type { Store } from '../storage/types.ts';
import { create_transcoder } from '../transcode/index.ts';
import { create_engine } from './engine.ts';
import { rank_results } from './ranking.ts';
import { send_file } from './raw.ts';
import { torrentio_search } from './torrentio.ts';
import type { SearchKind } from './types.ts';

export type { TorrentResult, TorrentStatus } from './types.ts';
export type Torrents = ReturnType<typeof create_torrents>;

const TORRENT_ROUTE = /^\/api\/torrents\/([a-fA-F0-9]{40})\/(main|\d{1,5})\/(status|raw|play|hls\/(.+))$/;

export function torrent_raw_path(info_hash: string, file: string): string {
  return `/api/torrents/${info_hash.toLowerCase()}/${file}/raw`;
}

function search_kind(id: string, store: Store): SearchKind {
  if (id.includes(':')) return 'series';
  const kind = store.catalog_get(id)?.kind ?? store.title_get(id)?.value.kind;
  return kind === 'series' ? 'series' : 'movie';
}

export function create_torrents(store: Store) {
  const engine = create_engine(store.directory);
  const transcoder = create_transcoder(join(store.directory, 'transcode'));
  const responses = new Set<ServerResponse>();

  async function search(res: ServerResponse, url: URL) {
    const id = url.searchParams.get('title') ?? '';
    if (TITLE_ID.exec(id)?.[0] !== id) throw new HttpError(400, 'Invalid title identifier.');
    const kind = search_kind(id, store);
    const found = await torrentio_search(kind, id);
    for (const item of found) engine.remember(item.result.info_hash, item.trackers);
    json(res, { results: rank_results(found.map(item => item.result), kind) });
  }

  async function route(req: IncomingMessage, res: ServerResponse, url: URL) {
    const method = req.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      throw new HttpError(405, 'Only GET and HEAD are supported.');
    }
    if (url.pathname === '/api/torrents/search') return search(res, url);
    const match = TORRENT_ROUTE.exec(url.pathname);
    if (!match?.[1] || !match[2]) throw new HttpError(404, 'Torrent route not found.');
    const info_hash = match[1].toLowerCase();
    const file = match[2];
    if (match[3] === 'status') return json(res, engine.status(info_hash, file));
    if (match[3] === 'raw') return send_file(req, res, await engine.file(info_hash, file), responses);
    const raw_path = torrent_raw_path(info_hash, file);
    const source_url = `http://127.0.0.1:${req.socket.localPort}${raw_path}`;
    const key = `${info_hash}-${file}`;
    if (match[4]) return transcoder.serve(req, res, key, match[4], source_url);
    await engine.file(info_hash, file);
    const plan = await transcoder.plan(key, source_url);
    const base = raw_path.slice(0, -'raw'.length);
    json(res, plan.mode === 'direct' ? { mode: 'direct', url: raw_path } : { mode: 'hls', url: `${base}hls/index.m3u8`, duration: plan.duration });
  }

  async function close() {
    for (const response of responses) response.destroy();
    responses.clear();
    await transcoder.stop();
    await engine.close();
  }

  return { route, close };
}
