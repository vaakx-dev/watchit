import { createReadStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { plays_directly } from './browser.ts';
import { vod_playlist } from './playlist.ts';
import { probe } from './probe.ts';
import { hls_recipe } from './recipe.ts';
import { create_session, type Session } from './session.ts';

export type PlaybackPlan = { mode: 'direct' } | { mode: 'hls'; duration: number | null };

type Prepared = { plan: PlaybackPlan; session: Session | null };

const IDLE_CHECK_MS = 15_000;
const SEGMENT_PATH = /^(\d+)\.ts$/;

function not_found(res: ServerResponse) {
  res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found.');
}

async function send_playlist(res: ServerResponse, session: Session) {
  const body = session.segments ? vod_playlist(session.segments) : await session.live_playlist();
  res.writeHead(200, { 'content-type': 'application/vnd.apple.mpegurl', 'cache-control': 'no-cache' }).end(body);
}

async function send_segment(res: ServerResponse, session: Session, index: number) {
  if (session.segments && index >= session.segments.length) return not_found(res);
  res.writeHead(200, { 'content-type': 'video/mp2t', 'cache-control': 'no-cache' });
  res.flushHeaders();
  try {
    await pipeline(createReadStream(await session.segment(index)), res);
  } catch {
    res.destroy();
  }
}

export function create_transcoder(directory: string) {
  const prepared = new Map<string, Promise<Prepared>>();
  const cleared = rm(directory, { recursive: true, force: true });

  async function prepare(key: string, source_url: string): Promise<Prepared> {
    await cleared;
    const media = await probe(source_url);
    if (plays_directly(media)) return { plan: { mode: 'direct' }, session: null };
    const session = create_session(source_url, await hls_recipe(source_url, media), join(directory, key));
    return { plan: { mode: 'hls', duration: media.duration }, session };
  }

  function prepared_for(key: string, source_url: string): Promise<Prepared> {
    const existing = prepared.get(key);
    if (existing) return existing;
    const created = prepare(key, source_url);
    prepared.set(key, created);
    created.catch(() => prepared.delete(key));
    return created;
  }

  async function each_session(action: (session: Session) => Promise<void>) {
    const all = await Promise.allSettled(prepared.values());
    await Promise.all(all.map(result => (result.status === 'fulfilled' && result.value.session ? action(result.value.session) : undefined)));
  }

  const idle_check = setInterval(() => void each_session(session => session.stop_if_idle()), IDLE_CHECK_MS);
  idle_check.unref();

  async function plan(key: string, source_url: string): Promise<PlaybackPlan> {
    return (await prepared_for(key, source_url)).plan;
  }

  async function serve(_req: IncomingMessage, res: ServerResponse, key: string, path: string, source_url: string): Promise<void> {
    const { session } = await prepared_for(key, source_url);
    if (!session) return not_found(res);
    if (path === 'index.m3u8') return send_playlist(res, session);
    const index = SEGMENT_PATH.exec(path)?.[1];
    if (index === undefined) return not_found(res);
    return send_segment(res, session, Number(index));
  }

  async function stop() {
    clearInterval(idle_check);
    await each_session(session => session.stop());
  }

  return { plan, serve, stop };
}
